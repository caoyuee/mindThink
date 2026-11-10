/**
 * MCP Server 传输层（D5 阶段一：Server 实时桥接）
 *
 * 职责边界（红线：协议业务逻辑不进 Rust）：
 * 1. loopback TCP listener（127.0.0.1 随机端口），仅接受 POST /mcp
 *    （MCP Streamable HTTP 的 JSON 变体：无 id 请求回 202，有 id 等待响应回 200）
 * 2. Bearer token 鉴权（每次启动轮换，取自 /dev/urandom）+ Host 校验（防 DNS rebinding）
 * 3. 端口 + token 写入 userData/mcp-discovery.json（外部 client 发现文件）
 * 4. JSON-RPC 消息桥接到 webview：emit "mcp-request" 转发，
 *    webview invoke "mcp_respond" 回传（pending map + 30s 超时）
 *
 * 协议处理（initialize / tools/list / resources/read / tools/call 与批准门控）
 * 全部在 webview 的 packages/core/src/core/mcp-server.ts 实现。
 */
use crate::commands::{AppError, AppResult};
use serde::Serialize;
use serde_json::Value;
use std::collections::HashMap;
use std::io::{Read, Write};
use std::net::{TcpListener, TcpStream};
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::{mpsc, Arc, Mutex};
use std::time::Duration;
use tauri::{AppHandle, Emitter, Manager};

const MAX_BODY_BYTES: usize = 1024 * 1024;
const MAX_HEADER_BYTES: usize = 16 * 1024;
const REQUEST_TIMEOUT: Duration = Duration::from_secs(30);
const DISCOVERY_FILE: &str = "mcp-discovery.json";

/// 暴露给外部 MCP client 的发现信息（写盘 + 返回给设置页）。
#[derive(Debug, Serialize, Clone)]
pub struct McpServerInfo {
    pub port: u16,
    pub token: String,
}

/// 发现文件内容（userData/mcp-discovery.json）。
#[derive(Serialize)]
struct McpDiscovery {
    port: u16,
    token: String,
    pid: u32,
    started_at: u64,
}

/// webview 桥接载荷。
#[derive(Serialize, Clone)]
struct McpRequestPayload {
    rid: u64,
    message: Value,
}

/// 服务端共享状态（lib.rs `app.manage` 持有）。
pub struct McpServerState {
    shared: Arc<Shared>,
}

impl Default for McpServerState {
    fn default() -> Self {
        Self {
            shared: Arc::new(Shared::new()),
        }
    }
}

struct Shared {
    running: AtomicBool,
    port: Mutex<Option<u16>>,
    token: Mutex<String>,
    /// rid → 回传通道（webview mcp_respond 写入，serve 线程读取）。
    pending: Mutex<HashMap<u64, mpsc::SyncSender<Value>>>,
    next_rid: AtomicU64,
}

impl Shared {
    fn new() -> Self {
        Self {
            running: AtomicBool::new(false),
            port: Mutex::new(None),
            token: Mutex::new(String::new()),
            pending: Mutex::new(HashMap::new()),
            next_rid: AtomicU64::new(1),
        }
    }

    /// 锁被毒化一律视为「服务未运行」（fail-closed）。
    fn port(&self) -> Option<u16> {
        *self.port.lock().ok()?
    }

    fn token(&self) -> Option<String> {
        self.token.lock().ok().map(|token| token.clone())
    }

    fn current_info(&self) -> Option<McpServerInfo> {
        if !self.running.load(Ordering::SeqCst) {
            return None;
        }
        Some(McpServerInfo {
            port: self.port()?,
            token: self.token()?,
        })
    }
}

/// 生成会话 token。优先 /dev/urandom；无该设备的平台回退到
/// 「纳秒时间 ^ 进程号」（loopback + Bearer 双重约束下风险可接受）。
fn generate_token() -> String {
    #[cfg(unix)]
    {
        if let Ok(mut file) = std::fs::File::open("/dev/urandom") {
            let mut bytes = [0_u8; 32];
            if file.read_exact(&mut bytes).is_ok() {
                return bytes.iter().map(|byte| format!("{byte:02x}")).collect();
            }
        }
    }
    let nanos = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_nanos())
        .unwrap_or(0);
    format!("{:032x}", nanos ^ (u128::from(std::process::id()) << 64))
}

fn discovery_path(app: &AppHandle) -> Result<std::path::PathBuf, AppError> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|error| AppError::InvalidArgument(error.to_string()))?;
    Ok(dir.join(DISCOVERY_FILE))
}

fn write_discovery_file(app: &AppHandle, discovery: &McpDiscovery) -> AppResult<()> {
    let path = discovery_path(app)?;
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    let json = serde_json::to_string_pretty(discovery)?;
    std::fs::write(path, json)?;
    Ok(())
}

fn delete_discovery_file(app: &AppHandle) {
    if let Ok(path) = discovery_path(app) {
        let _ = std::fs::remove_file(path);
    }
}

/// 启动 MCP server（幂等：已在运行则直接返回当前信息）。
#[tauri::command]
pub async fn mcp_start(
    app: AppHandle,
    state: tauri::State<'_, McpServerState>,
) -> AppResult<McpServerInfo> {
    let shared = &state.shared;
    if let Some(info) = shared.current_info() {
        return Ok(info);
    }
    let token = generate_token();
    let listener =
        TcpListener::bind(("127.0.0.1", 0)).map_err(|error| AppError::Io(error.to_string()))?;
    let port = listener
        .local_addr()
        .map_err(|error| AppError::Io(error.to_string()))?
        .port();

    match (shared.port.lock(), shared.token.lock()) {
        (Ok(mut port_slot), Ok(mut token_slot)) => {
            *port_slot = Some(port);
            *token_slot = token.clone();
        }
        _ => return Err(AppError::Io("MCP 状态锁被占用".to_string())),
    }
    shared.running.store(true, Ordering::SeqCst);

    write_discovery_file(
        &app,
        &McpDiscovery {
            port,
            token: token.clone(),
            pid: std::process::id(),
            started_at: std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .map(|d| d.as_secs())
                .unwrap_or(0),
        },
    )?;

    // accept 线程：阻塞 accept 由 mcp_stop「自连一次」解锁
    let thread_shared = Arc::clone(shared);
    let thread_app = app.clone();
    std::thread::spawn(move || {
        while thread_shared.running.load(Ordering::SeqCst) {
            match listener.accept() {
                Ok((stream, _)) => {
                    let conn_shared = Arc::clone(&thread_shared);
                    let conn_app = thread_app.clone();
                    std::thread::spawn(move || {
                        let _ = serve_connection(&stream, &conn_shared, &|rid, message| {
                            conn_app
                                .emit("mcp-request", McpRequestPayload { rid, message })
                                .is_ok()
                        });
                    });
                }
                Err(_) => std::thread::sleep(Duration::from_millis(10)),
            }
        }
    });

    Ok(McpServerInfo { port, token })
}

/// 停止 MCP server（幂等）。清理发现文件并解除全部挂起请求。
#[tauri::command]
pub async fn mcp_stop(app: AppHandle, state: tauri::State<'_, McpServerState>) -> AppResult<()> {
    let shared = &state.shared;
    if !shared.running.swap(false, Ordering::SeqCst) {
        return Ok(());
    }
    // 自连一次，唤醒阻塞在 accept 的线程
    if let Some(port) = shared.port() {
        let _ = TcpStream::connect(("127.0.0.1", port));
    }
    // 解除全部挂起请求（通道 drop → serve 线程 recv 失败 → 回超时错误）
    if let Ok(mut pending) = shared.pending.lock() {
        pending.clear();
    }
    delete_discovery_file(&app);
    Ok(())
}

/// 查询当前状态（设置页展示端口/token 用）。
#[tauri::command]
pub async fn mcp_status(
    state: tauri::State<'_, McpServerState>,
) -> AppResult<Option<McpServerInfo>> {
    Ok(state.shared.current_info())
}

/// webview 回传一条 MCP JSON-RPC 响应。
#[tauri::command]
pub async fn mcp_respond(
    state: tauri::State<'_, McpServerState>,
    rid: u64,
    message: Value,
) -> AppResult<()> {
    let sender = state
        .shared
        .pending
        .lock()
        .map_err(|_| AppError::Io("MCP 状态锁被占用".to_string()))?
        .remove(&rid);
    match sender {
        Some(sender) => {
            // 接收端可能已超时离开，发送失败不视为错误
            let _ = sender.send(message);
            Ok(())
        }
        None => Err(AppError::NotFound(format!("无挂起的 MCP 请求 rid={rid}"))),
    }
}

/// 处理一条连接。`dispatch` 把 (rid, message) 交给 webview（生产 = emit，测试可注入）。
fn serve_connection(
    stream: &TcpStream,
    shared: &Arc<Shared>,
    dispatch: &dyn Fn(u64, &Value) -> bool,
) -> std::io::Result<()> {
    let mut stream = stream;
    stream.set_read_timeout(Some(Duration::from_secs(10)))?;
    stream.set_write_timeout(Some(Duration::from_secs(10)))?;
    let response = match read_request(stream) {
        Err(error) => http_response(error.status, error.reason, &error.body),
        Ok(request) => match authorize(shared, &request) {
            Err(error) => http_response(error.status, error.reason, &error.body),
            Ok(body) => match serde_json::from_slice::<Value>(&body) {
                Ok(message) => serve_message(shared, dispatch, message),
                Err(error) => http_parse_error(error),
            },
        },
    };
    stream.write_all(response.as_bytes())?;
    stream.flush()
}

struct HttpError {
    status: u16,
    reason: &'static str,
    body: String,
}

struct ParsedRequest {
    /// 已拆分的头行（不含请求行，全部小写键）。
    headers: Vec<(String, String)>,
    body: Vec<u8>,
}

fn http_response(status: u16, reason: &str, body: &str) -> String {
    format!(
        "HTTP/1.1 {status} {reason}\r\nContent-Type: application/json; charset=utf-8\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body}",
        body.len()
    )
}

fn http_parse_error(error: serde_json::Error) -> String {
    let body = serde_json::json!({
        "jsonrpc": "2.0",
        "id": null,
        "error": { "code": -32700, "message": format!("MCP 消息不是有效 JSON: {error}") }
    })
    .to_string();
    http_response(400, "Bad Request", &body)
}

/// 读取并校验 HTTP 请求行/头，返回头与请求体。
fn read_request(stream: &TcpStream) -> Result<ParsedRequest, HttpError> {
    let mut stream = stream;
    let mut data = Vec::new();
    let mut buffer = [0_u8; 4096];
    let header_end = loop {
        let count = stream.read(&mut buffer).map_err(internal_error)?;
        if count == 0 {
            return Err(bad_request("请求头不完整"));
        }
        data.extend_from_slice(&buffer[..count]);
        if data.len() > MAX_HEADER_BYTES {
            return Err(HttpError {
                status: 431,
                reason: "Request Header Fields Too Large",
                body: "请求头过大".to_string(),
            });
        }
        if let Some(index) = data.windows(4).position(|window| window == b"\r\n\r\n") {
            break index + 4;
        }
    };
    let headers_text =
        std::str::from_utf8(&data[..header_end]).map_err(|_| bad_request("请求头必须是 UTF-8"))?;
    let mut lines = headers_text.split("\r\n");
    if lines.next() != Some("POST /mcp HTTP/1.1") {
        return Err(HttpError {
            status: 404,
            reason: "Not Found",
            body: "仅支持 POST /mcp".to_string(),
        });
    }
    let mut headers = Vec::new();
    for line in lines {
        if line.is_empty() {
            continue;
        }
        if let Some((name, value)) = line.split_once(':') {
            headers.push((name.trim().to_ascii_lowercase(), value.trim().to_string()));
        }
    }
    // 防 DNS rebinding：loopback 服务只接受本机 Host
    let host_ok = headers.iter().any(|(name, value)| {
        name == "host" && (value.starts_with("127.0.0.1") || value.starts_with("localhost"))
    });
    if !host_ok {
        return Err(HttpError {
            status: 403,
            reason: "Forbidden",
            body: "仅允许本机访问".to_string(),
        });
    }
    let content_length = headers
        .iter()
        .find(|(name, _)| name == "content-length")
        .and_then(|(_, value)| value.parse::<usize>().ok())
        .ok_or_else(|| bad_request("缺少有效 Content-Length"))?;
    if content_length > MAX_BODY_BYTES {
        return Err(HttpError {
            status: 413,
            reason: "Content Too Large",
            body: "请求体超过 1 MiB".to_string(),
        });
    }
    while data.len() - header_end < content_length {
        let count = stream.read(&mut buffer).map_err(internal_error)?;
        if count == 0 {
            return Err(bad_request("请求体不完整"));
        }
        data.extend_from_slice(&buffer[..count]);
    }
    Ok(ParsedRequest {
        headers,
        body: data[header_end..header_end + content_length].to_vec(),
    })
}

/// Bearer token 校验（非常量时间比较；token 为 64 位十六进制，时序侧信道不构成本机威胁）。
fn authorize(shared: &Arc<Shared>, request: &ParsedRequest) -> Result<(), HttpError> {
    let expected = shared
        .token()
        .ok_or_else(|| HttpError {
            status: 503,
            reason: "Service Unavailable",
            body: "MCP server 未就绪".to_string(),
        })?;
    let provided = request
        .headers
        .iter()
        .find(|(name, _)| name == "authorization")
        .and_then(|(_, value)| value.strip_prefix("Bearer "));
    match provided {
        Some(token) if token == expected => Ok(()),
        _ => Err(HttpError {
            status: 401,
            reason: "Unauthorized",
            body: "缺少或错误的 Bearer token".to_string(),
        }),
    }
}

/// 处理一条已鉴权的 JSON-RPC 消息。
fn serve_message(
    shared: &Arc<Shared>,
    dispatch: &dyn Fn(u64, &Value) -> bool,
    message: Value,
) -> String {
    // notification（无 id 或 id 为 null）：转发 webview 后按协议回 202，不等待响应
    let has_id = message
        .get("id")
        .map(|id| !id.is_null())
        .unwrap_or(false);
    if !has_id {
        let rid = shared.next_rid.fetch_add(1, Ordering::SeqCst);
        let _ = dispatch(rid, &message);
        return "HTTP/1.1 202 Accepted\r\nContent-Length: 0\r\nConnection: close\r\n\r\n".to_string();
    }
    let rid = shared.next_rid.fetch_add(1, Ordering::SeqCst);
    let (sender, receiver) = mpsc::sync_channel::<Value>(1);
    if let Ok(mut pending) = shared.pending.lock() {
        pending.insert(rid, sender);
    }
    let dispatched = dispatch(rid, &message);
    let reply = if dispatched {
        receiver
            .recv_timeout(REQUEST_TIMEOUT)
            .map(|value| value.to_string())
            .unwrap_or_else(|_| timeout_error(&message))
    } else {
        // emit 失败（无 webview 可达）：直接回桥接错误
        timeout_error(&message)
    };
    if let Ok(mut pending) = shared.pending.lock() {
        pending.remove(&rid);
    }
    http_response(200, "OK", &reply)
}

/// 桥接超时/失败时的 JSON-RPC 错误响应体。
fn timeout_error(request: &Value) -> String {
    let id = request.get("id").cloned().unwrap_or(Value::Null);
    serde_json::json!({
        "jsonrpc": "2.0",
        "id": id,
        "error": { "code": -32000, "message": "应用内处理超时或不可达" }
    })
    .to_string()
}

fn bad_request(message: &str) -> HttpError {
    HttpError {
        status: 400,
        reason: "Bad Request",
        body: message.to_string(),
    }
}

fn internal_error(error: std::io::Error) -> HttpError {
    HttpError {
        status: 500,
        reason: "Internal Server Error",
        body: error.to_string(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::{Read as _, Write as _};
    use std::net::TcpStream;

    fn test_shared(token: &str) -> Arc<Shared> {
        let shared = Arc::new(Shared::new());
        *shared.port.lock().unwrap() = Some(0);
        *shared.token.lock().unwrap() = token.to_string();
        shared.running.store(true, Ordering::SeqCst);
        shared
    }

    /// 与 serve_connection 完整走一次 HTTP 交换；`on_request` 可在
    /// dispatch 时模拟 webview 回传（返回 None 表示不响应）。
    fn exchange(
        shared: &Arc<Shared>,
        request: String,
        on_request: Option<Box<dyn Fn(u64, Value) -> Option<Value> + Send + 'static>>,
    ) -> String {
        let listener = TcpListener::bind(("127.0.0.1", 0)).expect("bind test listener");
        let address = listener.local_addr().expect("read listener address");
        let server_shared = Arc::clone(shared);
        let server = std::thread::spawn(move || {
            let (stream, _) = listener.accept().expect("accept test connection");
            let dispatch = move |rid: u64, message: &Value| -> bool {
                match &on_request {
                    Some(callback) => {
                        let reply = callback(rid, message.clone());
                        if let Some(reply) = reply {
                            if let Ok(mut pending) = server_shared.pending.lock() {
                                if let Some(sender) = pending.remove(&rid) {
                                    let _ = sender.send(reply);
                                    return true;
                                }
                            }
                        }
                        false
                    }
                    None => false,
                }
            };
            serve_connection(&stream, &server_shared, &dispatch)
                .expect("serve test connection");
        });
        let mut client = TcpStream::connect(address).expect("connect test client");
        client.write_all(request.as_bytes()).expect("write request");
        client.shutdown(std::net::Shutdown::Write).expect("finish");
        let mut response = String::new();
        client.read_to_string(&mut response).expect("read response");
        server.join().expect("join test server");
        response
    }

    fn post(body: &str, token: &str) -> String {
        format!(
            "POST /mcp HTTP/1.1\r\nHost: 127.0.0.1:1234\r\nAuthorization: Bearer {token}\r\nContent-Length: {}\r\n\r\n{body}",
            body.len()
        )
    }

    #[test]
    fn token_is_generated_and_hex() {
        let token = generate_token();
        assert!(token.len() >= 32, "token 应有足够熵");
        assert!(token.chars().all(|c| c.is_ascii_hexdigit()));
        // 两次生成不重复（时间/熵源不同）
        assert_ne!(token, generate_token());
    }

    #[test]
    fn rejects_missing_bearer_token() {
        let shared = test_shared("tok123");
        let body = r#"{"jsonrpc":"2.0","id":1,"method":"ping"}"#;
        let request = format!(
            "POST /mcp HTTP/1.1\r\nHost: 127.0.0.1:1234\r\nContent-Length: {}\r\n\r\n{body}",
            body.len()
        );
        let response = exchange(&shared, request, None);
        assert!(response.starts_with("HTTP/1.1 401 Unauthorized"), "{response}");
    }

    #[test]
    fn rejects_wrong_bearer_token() {
        let shared = test_shared("tok123");
        let response = exchange(&shared, post(r#"{"jsonrpc":"2.0","id":1}"#, "wrong"), None);
        assert!(response.starts_with("HTTP/1.1 401 Unauthorized"));
    }

    #[test]
    fn rejects_foreign_host_header() {
        let shared = test_shared("tok123");
        let body = r#"{"jsonrpc":"2.0","id":1,"method":"ping"}"#;
        let request = format!(
            "POST /mcp HTTP/1.1\r\nHost: evil.example.com\r\nAuthorization: Bearer tok123\r\nContent-Length: {}\r\n\r\n{body}",
            body.len()
        );
        let response = exchange(&shared, request, None);
        assert!(response.starts_with("HTTP/1.1 403 Forbidden"), "{response}");
    }

    #[test]
    fn rejects_non_mcp_routes() {
        let shared = test_shared("tok123");
        let response = exchange(
            &shared,
            "GET / HTTP/1.1\r\nHost: 127.0.0.1:1234\r\nContent-Length: 0\r\n\r\n".to_string(),
            None,
        );
        assert!(response.starts_with("HTTP/1.1 404 Not Found"));
    }

    #[test]
    fn forwards_id_request_and_returns_webview_reply() {
        let shared = test_shared("tok123");
        let response = exchange(
            &shared,
            post(r#"{"jsonrpc":"2.0","id":7,"method":"ping"}"#, "tok123"),
            Some(Box::new(|_rid, message| {
                assert_eq!(message["method"], "ping");
                Some(serde_json::json!({ "jsonrpc": "2.0", "id": 7, "result": {} }))
            })),
        );
        assert!(response.starts_with("HTTP/1.1 200 OK"), "{response}");
        assert!(response.contains("\"result\":{}"));
        // pending 已清理
        assert!(shared.pending.lock().unwrap().is_empty());
    }

    #[test]
    fn times_out_when_webview_does_not_reply() {
        let shared = test_shared("tok123");
        // 不模拟回传 → 等待 30s 超时。测试里把超时改短不可行（const），
        // 用 dispatch 返回 false 的路径立即触发「不可达」错误。
        let response = exchange(
            &shared,
            post(r#"{"jsonrpc":"2.0","id":9,"method":"ping"}"#, "tok123"),
            Some(Box::new(|_rid, _message| false)),
        );
        assert!(response.starts_with("HTTP/1.1 200 OK"), "{response}");
        assert!(response.contains("-32000"));
    }

    #[test]
    fn accepts_notification_without_reply() {
        let shared = test_shared("tok123");
        let response = exchange(
            &shared,
            post(r#"{"jsonrpc":"2.0","method":"notifications/initialized"}"#, "tok123"),
            None,
        );
        assert!(response.starts_with("HTTP/1.1 202 Accepted"), "{response}");
    }

    #[test]
    fn answers_parse_error_with_json_rpc_error() {
        let shared = test_shared("tok123");
        let response = exchange(&shared, post("{bad json", "tok123"), None);
        assert!(response.starts_with("HTTP/1.1 400 Bad Request"));
        assert!(response.contains("-32700"));
    }
}
