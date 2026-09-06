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
use serde::{Deserialize, Serialize, Serializer};
use std::path::PathBuf;
use tauri::menu::{AboutMetadataBuilder, Menu, MenuItemBuilder, PredefinedMenuItem, Submenu};
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

impl From<tauri::Error> for AppError {
    fn from(err: tauri::Error) -> Self {
        AppError::Io(err.to_string())
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

/// Structured native menu spec (B1). The frontend builds this per-locale and
/// sends it to [`rebuild_native_menu`] so the native menu follows the UI locale.
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct MenuSpecJson {
    submenus: Vec<SubmenuSpecJson>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct SubmenuSpecJson {
    label: String,
    items: Vec<MenuItemSpecJson>,
}

/// One entry inside a submenu. `kind` discriminates custom / separator / role.
#[derive(Debug, Deserialize)]
#[serde(tag = "kind", rename_all = "camelCase")]
enum MenuItemSpecJson {
    Custom {
        id: String,
        label: String,
        accelerator: Option<String>,
    },
    Separator,
    Role {
        role: MenuRoleJson,
        label: String,
    },
}

/// Native/predefined menu roles. Kept as roles so Tauri preserves the native
/// semantics (About window metadata, OS-provided behavior) instead of them
/// degrading to plain text items.
#[derive(Debug, Deserialize)]
#[serde(rename_all = "snake_case")]
enum MenuRoleJson {
    About,
    Quit,
    Undo,
    Redo,
    Cut,
    Copy,
    Paste,
    SelectAll,
    Fullscreen,
}

fn role_to_predefined(
    app: &tauri::AppHandle,
    role: &MenuRoleJson,
    label: &str,
) -> tauri::Result<PredefinedMenuItem<tauri::Wry>> {
    let text = Some(label);
    match role {
        MenuRoleJson::About => {
            PredefinedMenuItem::about(app, text, Some(AboutMetadataBuilder::new().build()))
        }
        MenuRoleJson::Quit => PredefinedMenuItem::quit(app, text),
        MenuRoleJson::Undo => PredefinedMenuItem::undo(app, text),
        MenuRoleJson::Redo => PredefinedMenuItem::redo(app, text),
        MenuRoleJson::Cut => PredefinedMenuItem::cut(app, text),
        MenuRoleJson::Copy => PredefinedMenuItem::copy(app, text),
        MenuRoleJson::Paste => PredefinedMenuItem::paste(app, text),
        MenuRoleJson::SelectAll => PredefinedMenuItem::select_all(app, text),
        MenuRoleJson::Fullscreen => PredefinedMenuItem::fullscreen(app, text),
    }
}

fn append_spec_item(
    app: &tauri::AppHandle,
    submenu: &Submenu<tauri::Wry>,
    item: &MenuItemSpecJson,
) -> tauri::Result<()> {
    match item {
        MenuItemSpecJson::Separator => {
            submenu.append(&PredefinedMenuItem::separator(app)?)?;
        }
        MenuItemSpecJson::Custom {
            id,
            label,
            accelerator,
        } => {
            let mut builder = MenuItemBuilder::with_id(id.as_str(), label.as_str());
            if let Some(acc) = accelerator {
                builder = builder.accelerator(acc.as_str());
            }
            submenu.append(&builder.build(app)?)?;
        }
        MenuItemSpecJson::Role { role, label } => {
            submenu.append(&role_to_predefined(app, role, label)?)?;
        }
    }
    Ok(())
}

fn build_submenu_from_spec(
    app: &tauri::AppHandle,
    spec: &SubmenuSpecJson,
) -> tauri::Result<Submenu<tauri::Wry>> {
    let submenu = Submenu::new(app, &spec.label, true)?;
    for item in &spec.items {
        append_spec_item(app, &submenu, item)?;
    }
    Ok(submenu)
}

fn build_menu_from_spec(
    app: &tauri::AppHandle,
    spec: &MenuSpecJson,
) -> tauri::Result<Menu<tauri::Wry>> {
    let menu = Menu::new(app)?;
    for submenu_spec in &spec.submenus {
        let submenu = build_submenu_from_spec(app, submenu_spec)?;
        menu.append(&submenu)?;
    }
    Ok(menu)
}

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

/**
 * 用前端按当前语言生成的结构化 spec 重建系统原生菜单。
 *
 * 前端在 mount 后调用一次以覆盖默认英文菜单，语言切换时再次调用，
 * 使原生菜单即时跟随 UI locale。角色项(about/quit/undo/...)保留原生语义。
 */
#[tauri::command]
pub async fn rebuild_native_menu(app: tauri::AppHandle, spec: serde_json::Value) -> AppResult<()> {
    let spec: MenuSpecJson = serde_json::from_value(spec)?;
    let menu = build_menu_from_spec(&app, &spec)?;
    app.set_menu(menu)?;
    Ok(())
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

    #[test]
    fn parses_native_menu_spec_json() {
        let json = json!({
            "submenus": [
                { "label": "App", "items": [
                    { "kind": "role", "role": "about", "label": "About" },
                    { "kind": "separator" },
                    { "kind": "role", "role": "quit", "label": "Quit" }
                ]},
                { "label": "File", "items": [
                    { "kind": "custom", "id": "new", "label": "New", "accelerator": "CmdOrCtrl+N" },
                    { "kind": "custom", "id": "open", "label": "Open…" },
                    { "kind": "custom", "id": "save", "label": "Save", "accelerator": "CmdOrCtrl+S" }
                ]},
                { "label": "Edit", "items": [
                    { "kind": "role", "role": "undo", "label": "Undo" },
                    { "kind": "role", "role": "select_all", "label": "Select All" }
                ]}
            ]
        });
        let spec: super::MenuSpecJson = serde_json::from_value(json).expect("spec should parse");
        assert_eq!(spec.submenus.len(), 3);

        let file = &spec.submenus[1];
        assert_eq!(file.label, "File");
        assert_eq!(file.items.len(), 3);
        match &file.items[0] {
            super::MenuItemSpecJson::Custom {
                id, accelerator, ..
            } => {
                assert_eq!(id, "new");
                assert_eq!(accelerator.as_deref(), Some("CmdOrCtrl+N"));
            }
            other => panic!("expected a custom item, got {other:?}"),
        }

        // No accelerator is optional for custom items.
        match &file.items[1] {
            super::MenuItemSpecJson::Custom { accelerator, .. } => assert!(accelerator.is_none()),
            other => panic!("expected a custom item, got {other:?}"),
        }

        // Roles preserve their enum + label.
        match &spec.submenus[2].items[1] {
            super::MenuItemSpecJson::Role { role, label } => {
                assert!(matches!(role, super::MenuRoleJson::SelectAll));
                assert_eq!(label, "Select All");
            }
            other => panic!("expected a role item, got {other:?}"),
        }
    }

    #[test]
    fn rejects_unknown_menu_role() {
        let json = json!({
            "submenus": [{
                "label": "File",
                "items": [
                    { "kind": "role", "role": "definitely-not-a-role", "label": "?" }
                ]
            }]
        });
        let result = serde_json::from_value::<super::MenuSpecJson>(json);
        assert!(result.is_err(), "unknown role should be rejected");
    }
}
