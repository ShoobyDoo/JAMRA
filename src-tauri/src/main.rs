#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use log::{debug, error, info, warn};
use once_cell::sync::Lazy;
use std::io::Write;
use std::net::{IpAddr, Ipv4Addr, Shutdown, SocketAddr, TcpStream};
use std::process::{Child, Command, Stdio};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};
use tauri::menu::{Menu, MenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{AppHandle, Manager, RunEvent, State, Wry};
use tauri_plugin_log::{RotationStrategy, Target, TargetKind};

#[cfg(windows)]
use std::os::windows::process::CommandExt;

static SERVER_PROCESS: Lazy<Mutex<Option<Child>>> = Lazy::new(|| Mutex::new(None));
type StatusMenuItem = MenuItem<Wry>;

static SERVER_STATUS_MENU_ITEM: Lazy<Mutex<Option<StatusMenuItem>>> =
    Lazy::new(|| Mutex::new(None));
static SERVER_STATUS: Lazy<Mutex<ServerStatus>> =
    Lazy::new(|| Mutex::new(ServerStatus::Starting));

#[derive(Clone)]
enum ServerStatus {
    Starting,
    Running,
    Stopped,
    Failed(String),
    DevManaged,
}

// State for minimize-to-tray preference
struct MinimizeToTrayState(Arc<Mutex<bool>>);

fn logging_targets() -> Vec<Target> {
    let mut targets = vec![Target::new(TargetKind::LogDir {
        file_name: Some(LOG_FILE_NAME.into()),
    })];

    if cfg!(debug_assertions) {
        targets.push(Target::new(TargetKind::Stdout));
    }

    targets
}

const LOG_FILE_NAME: &str = "main";
const MAX_LOG_FILE_BYTES: u128 = 10 * 1024 * 1024; // 10 MB per file
const SERVER_LOG_FILE: &str = "server";
const SERVER_HOST: &str = "127.0.0.1";
const SERVER_PORT: u16 = 3000;
const SERVER_PORT_STR: &str = "3000";
const SERVER_BASE_URL: &str = "http://127.0.0.1:3000";
const SHUTDOWN_PATH: &str = "/api/system/shutdown";
#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x08000000;

// Command to update minimize-to-tray preference
#[tauri::command]
fn set_minimize_to_tray(state: State<MinimizeToTrayState>, enabled: bool) {
    if let Ok(mut minimize_to_tray) = state.0.lock() {
        *minimize_to_tray = enabled;
    }
}

// Command to get current minimize-to-tray preference
#[tauri::command]
fn get_minimize_to_tray(state: State<MinimizeToTrayState>) -> bool {
    state.0.lock().map(|guard| *guard).unwrap_or(true)
}

fn status_text(status: &ServerStatus) -> String {
    match status {
        ServerStatus::Starting => "Starting...".to_string(),
        ServerStatus::Running => "Running".to_string(),
        ServerStatus::Stopped => "Stopped".to_string(),
        ServerStatus::Failed(reason) => format!("Failed ({reason})"),
        ServerStatus::DevManaged => "Managed by pnpm dev".to_string(),
    }
}

fn set_server_status(status: ServerStatus) {
    {
        let mut guard = SERVER_STATUS.lock().expect("status mutex poisoned");
        *guard = status.clone();
    }

    if let Ok(guard) = SERVER_STATUS_MENU_ITEM.lock() {
        if let Some(item) = guard.as_ref() {
            let label = format!("Server: {}", status_text(&status));
            if let Err(err) = item.set_text(&label) {
                warn!("Failed to update server status menu item: {err}");
            }
        }
    }
}

fn register_server_status_item(item: &StatusMenuItem) {
    if let Ok(mut guard) = SERVER_STATUS_MENU_ITEM.lock() {
        guard.replace(item.clone());
    }

    if let Ok(guard) = SERVER_STATUS.lock() {
        let label = format!("Server: {}", status_text(&guard));
        if let Err(err) = item.set_text(&label) {
            warn!("Failed to initialize server status text: {err}");
        }
    }
}

fn monitor_server_process() {
    std::thread::spawn(|| loop {
        std::thread::sleep(Duration::from_secs(1));

        let exit_status = {
            let mut guard = SERVER_PROCESS.lock().expect("server mutex poisoned");
            if let Some(child) = guard.as_mut() {
                match child.try_wait() {
                    Ok(Some(status)) => {
                        guard.take();
                        Some(status)
                    }
                    Ok(None) => None,
                    Err(err) => {
                        error!("Failed to poll server status: {err}");
                        None
                    }
                }
            } else {
                return;
            }
        };

        if let Some(status) = exit_status {
            if status.success() {
                set_server_status(ServerStatus::Stopped);
            } else {
                let reason = status
                    .code()
                    .map(|code| format!("exit code {}", code))
                    .unwrap_or_else(|| "terminated".to_string());
                set_server_status(ServerStatus::Failed(reason));
            }
            break;
        }
    });
}

fn spawn_server(app: &AppHandle) -> tauri::Result<()> {
    if cfg!(debug_assertions) {
        // Dev mode runs the server via `pnpm dev` already.
        info!("Development mode detected - backend managed by `pnpm dev`");
        set_server_status(ServerStatus::DevManaged);
        return Ok(());
    }

    set_server_status(ServerStatus::Starting);
    info!("Starting production server...");

    let resource_dir = app.path().resource_dir()?;
    let log_dir = app.path().app_log_dir()?;
    std::fs::create_dir_all(&log_dir)?;
    let log_dir_env = log_dir.clone().into_os_string();

    let data_dir = app.path().app_data_dir()?;
    std::fs::create_dir_all(&data_dir)?;
    let data_dir_env = data_dir.clone().into_os_string();

    info!("Resource dir: {:?}", resource_dir);
    info!("Log dir: {:?}", log_dir);
    info!("Data dir: {:?}", data_dir);

    // Server bundle paths
    let server_bundle_dir = resource_dir.join("server-bundle");
    let server_entry = server_bundle_dir.join("dist").join("index.js");
    let node_modules = server_bundle_dir.join("node_modules");

    let node_runtime_dir = resource_dir.join("node-runtime");
    let bundled_node_binary = if cfg!(target_os = "windows") {
        node_runtime_dir.join("node.exe")
    } else {
        node_runtime_dir.join("node")
    };

    let use_bundled_node = bundled_node_binary.exists();

    if use_bundled_node {
        info!("Using bundled Node.js runtime at {:?}", bundled_node_binary);
    } else {
        info!("Bundled Node.js runtime not found; falling back to system Node.js");
    }

    info!("Server entry: {:?}", server_entry);
    info!("Node modules dir: {:?}", node_modules);

    // Validate server entry exists
    if !server_entry.exists() {
        error!(
            "Server entry point missing at {:?}. Did the bundle script run?",
            server_entry
        );
        set_server_status(ServerStatus::Failed("missing bundle".into()));
        return Err(tauri::Error::Io(std::io::Error::new(
            std::io::ErrorKind::NotFound,
            format!("Server entry point not found at {:?}. Run 'pnpm bundle:server'.", server_entry),
        )));
    }

    if !node_modules.exists() {
        warn!("node_modules not found at {:?}; Node will rely on packaged dependencies", node_modules);
    }

    // Convert paths to avoid UNC prefix issues with Node.js on Windows
    let server_bundle_dir_normalized = dunce::simplified(&server_bundle_dir);
    let server_entry_normalized = dunce::simplified(&server_entry);
    let resource_dir_normalized = dunce::simplified(&resource_dir);

    let mut cmd = if use_bundled_node {
        Command::new(dunce::simplified(&bundled_node_binary))
    } else {
        Command::new("node")
    };
    cmd.arg(server_entry_normalized)
        .current_dir(server_bundle_dir_normalized)
        .env("PORT", SERVER_PORT_STR)
        .env("SERVER_HOST", SERVER_HOST)
        .env("SERVER_BASE_URL", SERVER_BASE_URL)
        .env("ELECTRON_PACKAGED", "true")
        .env("RESOURCES_PATH", resource_dir_normalized)
        .env("DB_PATH", data_dir_env)
        .env("JAMRA_LOG_DIR", log_dir_env)
        .env("JAMRA_LOG_FILE", SERVER_LOG_FILE)
        .env(
            "JAMRA_LOG_LEVEL",
            if cfg!(debug_assertions) { "debug" } else { "info" },
        )
        .env("JAMRA_ALLOW_SHUTDOWN", "true")
        .env("NODE_ENV", "production")
        .stdout(Stdio::inherit())
        .stderr(Stdio::inherit());

    if node_modules.exists() {
        if let Some(path_str) = node_modules.to_str() {
            cmd.env("NODE_PATH", path_str);
        }
    }

    #[cfg(windows)]
    {
        cmd.creation_flags(CREATE_NO_WINDOW);
    }

    info!("Spawning server process...");
    let child = cmd.spawn().map_err(|error| {
        error!("Failed to spawn server: {error}");
        set_server_status(ServerStatus::Failed("spawn error".into()));
        tauri::Error::Io(std::io::Error::new(
            std::io::ErrorKind::Other,
            format!("Failed to spawn server: {}", error),
        ))
    })?;

    let pid = child.id();
    info!("Server started successfully (PID: {})", pid);

    {
        let mut handle = SERVER_PROCESS.lock().expect("mutex poisoned");
        *handle = Some(child);
    }
    set_server_status(ServerStatus::Running);
    monitor_server_process();

    Ok(())
}

fn request_graceful_shutdown() -> bool {
    let addr = SocketAddr::new(IpAddr::V4(Ipv4Addr::LOCALHOST), SERVER_PORT);
    match TcpStream::connect_timeout(&addr, Duration::from_millis(300)) {
        Ok(mut stream) => {
            let request = format!(
                "POST {path} HTTP/1.1\r\nHost: {host}:{port}\r\nContent-Length: 0\r\nConnection: close\r\n\r\n",
                path = SHUTDOWN_PATH,
                host = SERVER_HOST,
                port = SERVER_PORT
            );
            if let Err(err) = stream.write_all(request.as_bytes()) {
                warn!("Failed to send shutdown request: {err}");
                return false;
            }
            let _ = stream.shutdown(Shutdown::Both);
            true
        }
        Err(err) => {
            debug!("Shutdown endpoint unreachable: {err}");
            false
        }
    }
}

fn wait_for_exit(child: &mut Child, timeout: Duration) -> bool {
    let start = Instant::now();
    while start.elapsed() < timeout {
        match child.try_wait() {
            Ok(Some(_)) => return true,
            Ok(None) => std::thread::sleep(Duration::from_millis(50)),
            Err(err) => {
                warn!("Failed to poll server process status: {err}");
                break;
            }
        }
    }
    false
}

#[cfg(target_os = "windows")]
fn kill_server() {
    if let Ok(mut guard) = SERVER_PROCESS.lock() {
        if let Some(mut child) = guard.take() {
            let pid = child.id();
            info!("Terminating server process (PID: {})", pid);
            let _ = request_graceful_shutdown();

            if wait_for_exit(&mut child, Duration::from_secs(2)) {
                set_server_status(ServerStatus::Stopped);
                return;
            }

            debug!(
                "Requesting taskkill for server process tree (PID: {})",
                pid
            );
            issue_taskkill(pid, false);

            if wait_for_exit(&mut child, Duration::from_secs(2)) {
                set_server_status(ServerStatus::Stopped);
                return;
            }

            warn!("Server process still running; forcing termination");
            issue_taskkill(pid, true);

            if let Err(err) = child.kill() {
                warn!("Failed to force kill server process: {err}");
            } else if let Err(err) = child.wait() {
                warn!("Failed to wait for forced termination: {err}");
            }

            set_server_status(ServerStatus::Stopped);
        }
    }
}

#[cfg(target_os = "windows")]
fn issue_taskkill(pid: u32, force: bool) {
    let mut cmd = Command::new("taskkill");
    cmd.arg("/PID")
        .arg(pid.to_string())
        .arg("/T");

    if force {
        cmd.arg("/F");
    }

    cmd.creation_flags(CREATE_NO_WINDOW);

    if let Err(err) = cmd.spawn() {
        warn!(
            "Failed to spawn taskkill{}: {err}",
            if force { " /F" } else { "" }
        );
    }
}

#[cfg(not(target_os = "windows"))]
fn kill_server() {
    if let Ok(mut guard) = SERVER_PROCESS.lock() {
        if let Some(mut child) = guard.take() {
            let pid = child.id() as i32;
            let _ = request_graceful_shutdown();

            if wait_for_exit(&mut child, Duration::from_secs(2)) {
                set_server_status(ServerStatus::Stopped);
                return;
            }

            info!("Sending SIGTERM to server process (PID: {})", pid);
            unsafe {
                libc::kill(pid, libc::SIGTERM);
            }

            if wait_for_exit(&mut child, Duration::from_secs(3)) {
                set_server_status(ServerStatus::Stopped);
                return;
            }

            warn!("Server process did not exit gracefully - forced kill issued");
            if let Err(err) = child.kill() {
                warn!("Failed to force kill server process: {err}");
            } else if let Err(err) = child.wait() {
                warn!("Failed to wait for forced termination: {err}");
            }
            set_server_status(ServerStatus::Stopped);
        }
    }
}

fn main() {
    // On Linux, WebKit2GTK has known protocol errors with some Wayland compositors.
    // Force X11 backend (via XWayland) and disable WebKit GPU compositing to prevent
    // "Error 71 (Protocol error) dispatching to Wayland display" crashes.
    #[cfg(target_os = "linux")]
    {
        if std::env::var("GDK_BACKEND").is_err() {
            // SAFETY: called at program start, before any threads are spawned
            #[allow(unused_unsafe)]
            unsafe { std::env::set_var("GDK_BACKEND", "x11") };
        }
        if std::env::var("WEBKIT_DISABLE_COMPOSITING_MODE").is_err() {
            #[allow(unused_unsafe)]
            unsafe { std::env::set_var("WEBKIT_DISABLE_COMPOSITING_MODE", "1") };
        }
    }

    tauri::Builder::default()
        .plugin({
            let level = if cfg!(debug_assertions) {
                log::LevelFilter::Debug
            } else {
                log::LevelFilter::Info
            };

            tauri_plugin_log::Builder::new()
                .targets(logging_targets())
                .rotation_strategy(RotationStrategy::KeepSome(5))
                .max_file_size(MAX_LOG_FILE_BYTES)
                .level(level)
                .build()
        })
        .setup(|app| {
            let handle = app.handle();

            // Spawn server
            spawn_server(&handle)?;

            // Create tray menu
            let server_status_item =
                MenuItem::with_id(app, "server-status", "Server: Starting...", false, None::<&str>)?;
            register_server_status_item(&server_status_item);
            let show_item = MenuItem::with_id(app, "show", "Show", true, None::<&str>)?;
            let hide_item = MenuItem::with_id(app, "hide", "Hide", true, None::<&str>)?;
            let quit_item = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;

            let menu = Menu::with_items(
                app,
                &[&server_status_item, &show_item, &hide_item, &quit_item],
            )?;

            // Build tray icon with embedded icon
            let _tray = TrayIconBuilder::new()
                .icon(tauri::include_image!("icons/icon.ico"))
                .menu(&menu)
                .on_menu_event(|app, event| {
                    match event.id.as_ref() {
                        "show" => {
                            if let Some(window) = app.get_webview_window("main") {
                                let _ = window.show();
                                let _ = window.set_focus();
                            }
                        }
                        "hide" => {
                            if let Some(window) = app.get_webview_window("main") {
                                let _ = window.hide();
                            }
                        }
                        "quit" => {
                            kill_server();
                            std::process::exit(0);
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
                            let _ = window.set_focus();
                        }
                    }
                })
                .build(app)?;

            Ok(())
        })
        .manage(MinimizeToTrayState(Arc::new(Mutex::new(true)))) // Default to true
        .invoke_handler(tauri::generate_handler![set_minimize_to_tray, get_minimize_to_tray])
        .on_window_event(|window, event| {
            match event {
                tauri::WindowEvent::CloseRequested { api, .. } => {
                    // Check minimize-to-tray preference
                    let app = window.app_handle();
                    if let Some(state) = app.try_state::<MinimizeToTrayState>() {
                        if let Ok(minimize_to_tray) = state.0.lock() {
                            if *minimize_to_tray {
                                // Minimize to tray
                                let _ = window.hide();
                                api.prevent_close();
                            } else {
                                // Allow close (which will trigger RunEvent::Exit)
                                // Don't prevent close
                            }
                        }
                    }
                }
                _ => {}
            }
        })
        .build(tauri::generate_context!())
        .expect("error while running JAMRA")
        .run(|_, event| match event {
            RunEvent::Exit | RunEvent::ExitRequested { .. } => {
                kill_server();
            }
            _ => {}
        });
}
