use serde::Serialize;
use std::process::Command;
use std::sync::atomic::{AtomicBool, Ordering};
use std::time::Duration;
use tauri::{AppHandle, Emitter};

static BACKEND_RUNNING: AtomicBool = AtomicBool::new(false);

#[derive(Clone, Serialize, Debug)]
pub struct BackendStatus {
    pub running: bool,
    pub pid: Option<u32>,
    pub startup_error: Option<String>,
}

#[derive(Clone, Serialize, Debug)]
pub struct LmStudioStatus {
    pub online: bool,
    pub models: Vec<String>,
    pub error: Option<String>,
}

#[derive(Clone, Serialize, Debug)]
pub struct SystemStatus {
    pub backend: BackendStatus,
    pub lm_studio: LmStudioStatus,
    pub app_dir: String,
}

fn get_backend_dir() -> std::path::PathBuf {
    std::env::current_exe()
        .ok()
        .and_then(|p| p.parent().map(|p| p.to_path_buf()))
        .unwrap_or_else(|| std::path::PathBuf::from("."))
        .parent()
        .map(|p| p.join("backend"))
        .unwrap_or_else(|| std::path::PathBuf::from("backend"))
}

fn find_and_kill_port(port: u16) {
    if let Ok(output) = Command::new("lsof")
        .args(["-ti", &format!(":{port}")])
        .output()
    {
        let pids = String::from_utf8_lossy(&output.stdout);
        for pid in pids.split_whitespace() {
            let _ = Command::new("kill").arg(pid).output();
        }
    }
}

#[tauri::command]
async fn start_backend(app: AppHandle) -> BackendStatus {
    let backend_dir = get_backend_dir();

    find_and_kill_port(8000);
    tokio::time::sleep(Duration::from_millis(500)).await;

    let venv_python = backend_dir.join(".venv/bin/python3");
    let python_exe = if venv_python.exists() {
        venv_python
    } else {
        std::path::PathBuf::from("python3")
    };

    // Start backend
    let _child = Command::new(&python_exe)
        .current_dir(&backend_dir)
        .arg("-m")
        .arg("uvicorn")
        .arg("main:app")
        .arg("--reload")
        .arg("--port")
        .arg("8000")
        .env("RUST_BACKEND", "1")
        .spawn();

    // Wait and check if started
    let app_clone = app.clone();
    tokio::spawn(async move {
        for _ in 0..30 {
            tokio::time::sleep(Duration::from_secs(1)).await;
            if reqwest::get("http://127.0.0.1:8000/health")
                .await
                .map(|r| r.status().is_success())
                .unwrap_or(false)
            {
                BACKEND_RUNNING.store(true, Ordering::SeqCst);
                let _ = app_clone.emit("backend-status", BackendStatus {
                    running: true,
                    pid: None,
                    startup_error: None,
                });
                return;
            }
        }
        let _ = app_clone.emit("backend-status", BackendStatus {
            running: false,
            pid: None,
            startup_error: Some("后端启动超时".to_string()),
        });
    });

    BackendStatus {
        running: false,
        pid: None,
        startup_error: None,
    }
}

#[tauri::command]
fn stop_backend() -> BackendStatus {
    find_and_kill_port(8000);
    BACKEND_RUNNING.store(false, Ordering::SeqCst);
    BackendStatus {
        running: false,
        pid: None,
        startup_error: None,
    }
}

#[tauri::command]
fn get_backend_status() -> BackendStatus {
    BackendStatus {
        running: BACKEND_RUNNING.load(Ordering::SeqCst),
        pid: None,
        startup_error: None,
    }
}

#[tauri::command]
async fn get_lm_studio_status() -> LmStudioStatus {
    match reqwest::get("http://127.0.0.1:1234/v1/models").await {
        Ok(resp) if resp.status().is_success() => {
            if let Ok(data) = resp.json::<serde_json::Value>().await {
                let models: Vec<String> = data
                    .get("data")
                    .and_then(|v| v.as_array())
                    .map(|arr| {
                        arr.iter()
                            .filter_map(|m| m.get("id").and_then(|id| id.as_str()))
                            .map(String::from)
                            .collect()
                    })
                    .unwrap_or_default();
                return LmStudioStatus {
                    online: true,
                    models,
                    error: None,
                };
            }
        }
        _ => {}
    }
    LmStudioStatus {
        online: false,
        models: vec![],
        error: None,
    }
}

#[tauri::command]
fn get_system_status() -> SystemStatus {
    SystemStatus {
        backend: get_backend_status(),
        lm_studio: LmStudioStatus {
            online: false,
            models: vec![],
            error: None,
        },
        app_dir: get_backend_dir().to_string_lossy().to_string(),
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    env_logger::Builder::from_env(
        env_logger::Env::default().default_filter_or("info"),
    )
    .init();
    log::info!("执行背景调查工具启动中...");

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![
            start_backend,
            stop_backend,
            get_backend_status,
            get_lm_studio_status,
            get_system_status,
        ])
        .setup(|app| {
            log::info!("Tauri app setup complete");

            // Start LM Studio polling
            let app_handle = app.handle().clone();
            std::thread::spawn(move || {
                let rt = tokio::runtime::Builder::new_current_thread()
                    .enable_all()
                    .build()
                    .unwrap();
                loop {
                    std::thread::sleep(Duration::from_secs(10));
                    let status = rt.block_on(async {
                        match reqwest::get("http://127.0.0.1:1234/v1/models").await {
                            Ok(resp) if resp.status().is_success() => {
                                if let Ok(data) = resp.json::<serde_json::Value>().await {
                                    let models: Vec<String> = data
                                        .get("data")
                                        .and_then(|v| v.as_array())
                                        .map(|arr| {
                                            arr.iter()
                                                .filter_map(|m| m.get("id").and_then(|id| id.as_str()))
                                                .map(String::from)
                                                .collect()
                                        })
                                        .unwrap_or_default();
                                    return LmStudioStatus { online: true, models, error: None };
                                }
                            }
                            _ => {}
                        }
                        LmStudioStatus { online: false, models: vec![], error: None }
                    });
                    let _ = app_handle.emit("lm-studio-status", &status);
                }
            });

            Ok(())
        })
        .on_window_event(|window, _event| {
            log::info!("Window close requested, stopping backend");
            find_and_kill_port(8000);
            let _ = window.close();
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}