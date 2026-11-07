// 阻止额外控制台窗口在 Windows 发布版弹出
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    desktop_naotu_lib::run()
}
