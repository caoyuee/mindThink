/**
 * DesktopNaotu Tauri 库入口
 *
 * 设计:
 * - main.rs 调用 run(), 便于移动设备端复用库
 * - 所有命令集中在 commands 模块
 * - 系统菜单通过 MenuBuilder 构造, 事件通过 on_menu_event 处理
 * - 插件: dialog, fs, opener, shell
 */
mod commands;

use commands::{
    copy_file, exit_app, file_exists, get_app_version, get_user_data_dir, mcp_rpc_request,
    open_url, read_text_file, show_in_folder, write_binary_file, write_text_file,
};
use tauri::menu::{AboutMetadataBuilder, MenuBuilder, MenuItemBuilder, SubmenuBuilder};
use tauri::Emitter;

/// 应用入口(供 main.rs 和移动端共用)
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            // 构造应用菜单
            let menu = build_menu(app.handle())?;
            app.set_menu(menu)?;
            Ok(())
        })
        .on_menu_event(|app, event| {
            // 把菜单事件转发到 webview, 由前端统一处理
            if let Err(e) = app.emit("menu_event", event.id().0.as_str()) {
                eprintln!("emit menu event failed: {e}");
            }
        })
        .invoke_handler(tauri::generate_handler![
            read_text_file,
            write_text_file,
            copy_file,
            write_binary_file,
            file_exists,
            get_user_data_dir,
            show_in_folder,
            open_url,
            exit_app,
            get_app_version,
            mcp_rpc_request,
        ])
        .run(tauri::generate_context!())
        .unwrap_or_else(|error| eprintln!("error while running tauri application: {error}"));
}

/**
 * 构造系统菜单(spike 阶段最小可用版本)
 *
 * macOS: 应用菜单会自动插入到系统菜单栏
 * Windows/Linux: 在窗口标题栏下方显示
 */
fn build_menu(app: &tauri::AppHandle) -> tauri::Result<tauri::menu::Menu<tauri::Wry>> {
    // App menu (macOS 专属: 应用名)
    let app_submenu = SubmenuBuilder::new(app, "DesktopNaotu")
        .about(Some(AboutMetadataBuilder::new().build()))
        .separator()
        .quit()
        .build()?;

    // File 菜单
    let file_submenu = SubmenuBuilder::new(app, "File")
        .item(
            &MenuItemBuilder::with_id("new", "New")
                .accelerator("CmdOrCtrl+N")
                .build(app)?,
        )
        .item(
            &MenuItemBuilder::with_id("open", "Open...")
                .accelerator("CmdOrCtrl+O")
                .build(app)?,
        )
        .item(&MenuItemBuilder::with_id("open-recent", "Open Recent").build(app)?)
        .item(&MenuItemBuilder::with_id("new-window", "New Window").build(app)?)
        .item(
            &MenuItemBuilder::with_id("save", "Save")
                .accelerator("CmdOrCtrl+S")
                .build(app)?,
        )
        .separator()
        .quit()
        .build()?;

    // Edit 菜单(标准编辑角色)
    let edit_submenu = SubmenuBuilder::new(app, "Edit")
        .undo()
        .redo()
        .separator()
        .cut()
        .copy()
        .paste()
        .select_all()
        .build()?;

    // View 菜单
    let view_submenu = SubmenuBuilder::new(app, "View")
        .item(
            &MenuItemBuilder::with_id("toggle-devtools", "Toggle Developer Tools")
                .accelerator("CmdOrCtrl+Shift+D")
                .build(app)?,
        )
        .fullscreen()
        .build()?;

    // Help 菜单
    let help_submenu = SubmenuBuilder::new(app, "Help")
        .item(&MenuItemBuilder::with_id("about", "About DesktopNaotu").build(app)?)
        .build()?;

    MenuBuilder::new(app)
        .items(&[
            &app_submenu,
            &file_submenu,
            &edit_submenu,
            &view_submenu,
            &help_submenu,
        ])
        .build()
}
