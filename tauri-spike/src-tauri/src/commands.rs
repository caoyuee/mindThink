/**
 * Tauri 自定义命令
 *
 * 设计要点:
 * 1. 所有命令 async + Result<T, AppError> 返回
 * 2. AppError 实现 Serialize, 可以直接送到前端
 * 3. 文件 IO 走 tokio::fs, 不阻塞主线程
 * 4. 大文件读取未来可加 streaming, 当前 spike 阶段同步即可
 */
use base64::Engine;
use serde::{Serialize, Serializer};
use std::path::PathBuf;
use tauri::Manager;
use thiserror::Error;

/// 统一应用错误。前端可序列化为字符串。
#[derive(Debug, Error)]
pub enum AppError {
    #[error("IO error: {0}")]
    Io(String),

    #[error("Path not allowed: {0}")]
    PathNotAllowed(String),

    #[error("Invalid argument: {0}")]
    InvalidArgument(String),

    #[error("File not found: {0}")]
    NotFound(String),
}

impl From<std::io::Error> for AppError {
    fn from(err: std::io::Error) -> Self {
        match err.kind() {
            std::io::ErrorKind::NotFound => AppError::NotFound(err.to_string()),
            std::io::ErrorKind::PermissionDenied => AppError::PathNotAllowed(err.to_string()),
            _ => AppError::Io(err.to_string()),
        }
    }
}

impl From<serde_json::Error> for AppError {
    fn from(err: serde_json::Error) -> Self {
        AppError::InvalidArgument(err.to_string())
    }
}

/// 实现 Serialize, 前端 invoke 后可直接拿到结构化错误。
impl Serialize for AppError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        serializer.serialize_str(&self.to_string())
    }
}

pub type AppResult<T> = Result<T, AppError>;

/// 校验路径格式并限制到用户可操作的目录。
fn validate_path(app: &tauri::AppHandle, path: &str) -> AppResult<PathBuf> {
    let trimmed = path.trim();
    if trimmed.is_empty() {
        return Err(AppError::InvalidArgument("路径不能为空".to_string()));
    }
    let p = PathBuf::from(trimmed);
    if !p.is_absolute() {
        return Err(AppError::InvalidArgument(format!("相对路径不允许: {path}")));
    }
    if p.components()
        .any(|component| matches!(component, std::path::Component::ParentDir))
    {
        return Err(AppError::PathNotAllowed(format!(
            "路径不能包含父目录跳转: {path}"
        )));
    }

    let allowed = [
        app.path().home_dir(),
        app.path().document_dir(),
        app.path().download_dir(),
        app.path().desktop_dir(),
        app.path().app_data_dir(),
        app.path().app_local_data_dir(),
        app.path().temp_dir(),
    ];
    let is_allowed = allowed.iter().flatten().any(|root| p.starts_with(root));
    if !is_allowed {
        return Err(AppError::PathNotAllowed(path.to_string()));
    }
    Ok(p)
}

fn validate_url(url: &str) -> AppResult<&str> {
    let trimmed = url.trim();
    if trimmed.is_empty() || !(trimmed.starts_with("https://") || trimmed.starts_with("http://")) {
        return Err(AppError::InvalidArgument("仅支持 http(s) URL".to_string()));
    }
    Ok(trimmed)
}

/**
 * 读取文本文件
 */
#[tauri::command]
pub async fn read_text_file(app: tauri::AppHandle, path: String) -> AppResult<String> {
    let p = validate_path(&app, &path)?;
    let content = tokio::fs::read_to_string(&p).await?;
    Ok(content)
}

/**
 * 写入文本文件(覆盖)
 */
#[tauri::command]
pub async fn write_text_file(
    app: tauri::AppHandle,
    path: String,
    content: String,
) -> AppResult<()> {
    let p = validate_path(&app, &path)?;
    // 确保父目录存在
    if let Some(parent) = p.parent() {
        tokio::fs::create_dir_all(parent).await?;
    }
    tokio::fs::write(&p, content.as_bytes()).await?;
    Ok(())
}

/**
 * 检查文件是否存在
 */
#[tauri::command]
pub async fn file_exists(app: tauri::AppHandle, path: String) -> AppResult<bool> {
    let p = validate_path(&app, &path)?;
    Ok(tokio::fs::try_exists(&p).await?)
}

/**
 * 创建文件备份，目标文件已存在时覆盖。
 */
#[tauri::command]
pub async fn copy_file(
    app: tauri::AppHandle,
    source: String,
    destination: String,
) -> AppResult<()> {
    let source_path = validate_path(&app, &source)?;
    let destination_path = validate_path(&app, &destination)?;
    tokio::fs::copy(source_path, destination_path).await?;
    Ok(())
}

/**
 * 写入 Base64 编码的二进制文件。
 */
#[tauri::command]
pub async fn write_binary_file(
    app: tauri::AppHandle,
    path: String,
    content: String,
) -> AppResult<()> {
    let file_path = validate_path(&app, &path)?;
    let bytes = base64::engine::general_purpose::STANDARD
        .decode(content)
        .map_err(|error| AppError::InvalidArgument(error.to_string()))?;
    tokio::fs::write(file_path, bytes).await?;
    Ok(())
}

/**
 * 获取应用 userData 目录路径
 */
#[tauri::command]
pub async fn get_user_data_dir(app: tauri::AppHandle) -> AppResult<String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| AppError::InvalidArgument(e.to_string()))?;
    Ok(dir.to_string_lossy().to_string())
}

/**
 * 在文件管理器中显示文件
 * 内部使用 opener plugin 暴露, 这里做一个 alias
 */
#[tauri::command]
pub async fn show_in_folder(app: tauri::AppHandle, path: String) -> AppResult<()> {
    use tauri_plugin_opener::OpenerExt;
    let p = validate_path(&app, &path)?;
    app.opener()
        .open_path(p.to_string_lossy().to_string(), None::<&str>)
        .map_err(|e| AppError::Io(e.to_string()))?;
    Ok(())
}

/**
 * 在系统默认浏览器中打开 URL
 */
#[tauri::command]
pub async fn open_url(app: tauri::AppHandle, url: String) -> AppResult<()> {
    use tauri_plugin_opener::OpenerExt;
    let url = validate_url(&url)?;
    app.opener()
        .open_url(url, None::<&str>)
        .map_err(|e| AppError::Io(e.to_string()))?;
    Ok(())
}

/**
 * 退出应用
 */
#[tauri::command]
pub fn exit_app(app: tauri::AppHandle) {
    app.exit(0);
}

/**
 * 获取应用版本
 */
#[tauri::command]
pub fn get_app_version(app: tauri::AppHandle) -> String {
    app.package_info().version.to_string()
}

/// 处理一个无副作用的 MCP JSON-RPC 请求。
/// 外部 transport 只需负责传输，文档上下文由调用方提供。
#[tauri::command]
pub async fn mcp_rpc_request(
    request: serde_json::Value,
    context: serde_json::Value,
) -> AppResult<serde_json::Value> {
    Ok(crate::mcp::handle_rpc(request, context))
}

#[cfg(test)]
fn handle_mcp_rpc(
    request: serde_json::Value,
    context: serde_json::Value,
) -> AppResult<serde_json::Value> {
    let object = request
        .as_object()
        .ok_or_else(|| AppError::InvalidArgument("MCP 请求必须是对象".to_string()))?;
    let id = object.get("id").cloned().unwrap_or(serde_json::Value::Null);
    if object.get("jsonrpc").and_then(|value| value.as_str()) != Some("2.0") {
        return Ok(serde_json::json!({
            "jsonrpc": "2.0",
            "id": id,
            "error": { "code": -32600, "message": "MCP RPC 请求格式无效" }
        }));
    }
    let method = object
        .get("method")
        .and_then(|value| value.as_str())
        .ok_or_else(|| AppError::InvalidArgument("MCP RPC 缺少 method".to_string()))?;
    let result = match method {
        "initialize" => Some(serde_json::json!({
            "protocolVersion": "2024-11-05",
            "serverInfo": { "name": "DesktopNaotu", "version": "0.1.0" },
            "capabilities": { "resources": {}, "tools": {} }
        })),
        "tools/list" => context
            .get("tools")
            .cloned()
            .map(|tools| serde_json::json!({ "tools": tools })),
        "resources/list" => context
            .get("resources")
            .cloned()
            .map(|resources| serde_json::json!({ "resources": resources })),
        "resources/read" => {
            let uri = object
                .get("params")
                .and_then(|params| params.get("uri"))
                .and_then(|value| value.as_str());
            let current = context
                .get("current")
                .and_then(|value| value.get("markdown"));
            if uri == Some("mindmap://current") {
                current.cloned().map(|text| {
                    serde_json::json!({ "contents": [{ "uri": uri, "mimeType": "text/markdown", "text": text }] })
                })
            } else if let Some(node_id) =
                uri.and_then(|value| value.strip_prefix("mindmap://node/"))
            {
                context
                    .get("nodes")
                    .and_then(|nodes| nodes.get(node_id))
                    .map(|node| {
                        serde_json::json!({
                            "contents": [{
                                "uri": uri,
                                "mimeType": "application/json",
                                "text": node.to_string()
                            }]
                        })
                    })
            } else {
                None
            }
        }
        "tools/call" => {
            let name = object
                .get("params")
                .and_then(|params| params.get("name"))
                .and_then(|value| value.as_str());
            name.map(|tool| {
                let arguments = object
                    .get("params")
                    .and_then(|params| params.get("arguments"))
                    .cloned()
                    .unwrap_or_else(|| serde_json::json!({}));
                serde_json::json!({
                    "content": [{
                        "type": "text",
                        "text": serde_json::json!({
                            "requestId": id.to_string(),
                            "tool": tool,
                            "arguments": arguments
                        }).to_string()
                    }]
                })
            })
        }
        _ => {
            return Ok(
                serde_json::json!({ "jsonrpc": "2.0", "id": id, "error": { "code": -32601, "message": format!("不支持的 MCP 方法: {method}") } }),
            )
        }
    };
    match result {
        Some(value) => Ok(serde_json::json!({ "jsonrpc": "2.0", "id": id, "result": value })),
        None => Ok(
            serde_json::json!({ "jsonrpc": "2.0", "id": id, "error": { "code": -32602, "message": "MCP 资源或上下文参数无效" } }),
        ),
    }
}

#[cfg(test)]
mod tests {
    use super::handle_mcp_rpc;
    use serde_json::json;

    fn context() -> serde_json::Value {
        json!({
            "tools": [{ "name": "get_current_mindmap" }],
            "resources": [{ "uri": "mindmap://current" }],
            "current": { "markdown": "- Root\n" },
            "nodes": { "root": { "id": "root", "text": "Root" } }
        })
    }

    #[test]
    fn initializes_and_lists_resources() {
        let initialized = handle_mcp_rpc(
            json!({ "jsonrpc": "2.0", "id": 1, "method": "initialize" }),
            context(),
        )
        .expect("initialize should succeed");
        assert_eq!(initialized["result"]["protocolVersion"], "2024-11-05");

        let listed = handle_mcp_rpc(
            json!({ "jsonrpc": "2.0", "id": 2, "method": "resources/list" }),
            context(),
        )
        .expect("resources/list should succeed");
        assert_eq!(listed["result"]["resources"][0]["uri"], "mindmap://current");
    }

    #[test]
    fn reads_current_resource_and_reports_protocol_errors() {
        let resource = handle_mcp_rpc(
            json!({ "jsonrpc": "2.0", "id": 3, "method": "resources/read", "params": { "uri": "mindmap://current" } }),
            context(),
        )
        .expect("resources/read should succeed");
        assert_eq!(resource["result"]["contents"][0]["text"], "- Root\n");

        let node = handle_mcp_rpc(
            json!({ "jsonrpc": "2.0", "id": 4, "method": "resources/read", "params": { "uri": "mindmap://node/root" } }),
            context(),
        )
        .expect("node resource should succeed");
        assert_eq!(
            node["result"]["contents"][0]["mimeType"],
            "application/json"
        );
        assert!(node["result"]["contents"][0]["text"]
            .as_str()
            .is_some_and(|text| text.contains("Root")));

        let tool_call = handle_mcp_rpc(
            json!({ "jsonrpc": "2.0", "id": 5, "method": "tools/call", "params": { "name": "update_node", "arguments": { "id": "root", "text": "Changed" } } }),
            context(),
        )
        .expect("tools/call should succeed");
        assert!(tool_call["result"]["content"][0]["text"]
            .as_str()
            .is_some_and(|text| text.contains("update_node")));

        let unknown = handle_mcp_rpc(
            json!({ "jsonrpc": "2.0", "id": 4, "method": "unknown" }),
            context(),
        )
        .expect("unknown method should produce an RPC response");
        assert_eq!(unknown["error"]["code"], -32601);

        let invalid = handle_mcp_rpc(json!({ "jsonrpc": "1.0", "id": 5 }), context())
            .expect("invalid version should produce an RPC response");
        assert_eq!(invalid["error"]["code"], -32600);
    }
}
