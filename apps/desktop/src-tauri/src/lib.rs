use tauri::Manager;
use tauri::tray::{TrayIconBuilder, MouseButton, MouseButtonState, TrayIconEvent};
use tauri::menu::{MenuBuilder, MenuItemBuilder};

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! Welcome to Coding Music Agent.", name)
}

/// 启动 sidecar 并检查健康状态
/// port: sidecar 监听的端口号
#[tauri::command]
async fn start_sidecar(app: tauri::AppHandle, port: u16) -> Result<bool, String> {
    println!("[tauri] Starting sidecar on port {}...", port);

    // 获取资源目录
    let resource_dir = app.path()
        .resource_dir()
        .map_err(|e| format!("Failed to get resource dir: {}", e))?;

    let resource_path = resource_dir.join("sidecar-bundle.js");
    println!("[tauri] Sidecar bundle path: {:?}", resource_path);

    if !resource_path.exists() {
        return Err(format!("Sidecar bundle not found: {:?}", resource_path));
    }

    let bundle_path = resource_path.to_string_lossy().to_string();
    let port_str = port.to_string();

    // sidecar_node_modules 在 Resources 目录下
    let node_path = resource_dir.join("sidecar_node_modules").to_string_lossy().to_string();

    // 使用 bash -l 加载用户环境，设置 NODE_PATH 指向打包的 node_modules
    let cmd = format!(
        "NODE_PATH=\"{}\" exec node \"{}\" --port {}",
        node_path, bundle_path, port_str
    );

    std::process::Command::new("bash")
        .args(["-l", "-c", &cmd])
        .stdout(std::process::Stdio::null())
        .stderr(std::process::Stdio::null())
        .spawn()
        .map_err(|e| format!("Failed to spawn sidecar: {}", e))?;

    println!("[tauri] Sidecar spawned, waiting for startup...");

    // 等待 sidecar 启动
    tokio::time::sleep(std::time::Duration::from_secs(3)).await;

    // 检查健康状态
    let health_url = format!("http://localhost:{}/health", port);
    println!("[tauri] Checking health at {}", health_url);
    match reqwest::get(&health_url).await {
        Ok(resp) => {
            let success = resp.status().is_success();
            println!("[tauri] Health check result: {}", success);
            Ok(success)
        },
        Err(e) => {
            println!("[tauri] Health check failed: {}", e);
            Ok(false)
        },
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![greet, start_sidecar])
        .setup(|app| {
            // ── 系统托盘 ──
            let show_item = MenuItemBuilder::with_id("show", "显示窗口").build(app)?;
            let quit_item = MenuItemBuilder::with_id("quit", "退出").build(app)?;
            let menu = MenuBuilder::new(app)
                .item(&show_item)
                .separator()
                .item(&quit_item)
                .build()?;

            let _tray = TrayIconBuilder::new()
                .icon(app.default_window_icon().unwrap().clone())
                .menu(&menu)
                .tooltip("Coding Music Agent")
                .on_menu_event(move |app, event| {
                    match event.id().as_ref() {
                        "show" => {
                            if let Some(window) = app.get_webview_window("main") {
                                let _ = window.show();
                                let _ = window.unminimize();
                                let _ = window.set_focus();
                            }
                        }
                        "quit" => {
                            app.exit(0);
                        }
                        _ => {}
                    }
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event {
                        let app = tray.app_handle();
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.unminimize();
                            let _ = window.set_focus();
                        }
                    }
                })
                .build(app)?;

            Ok(())
        })
        .on_window_event(|window, event| {
            // 点击关闭按钮时最小化到托盘而不是退出
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                let _ = window.minimize();
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
