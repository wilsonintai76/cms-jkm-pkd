use std::sync::Mutex;

use tauri::{Manager, RunEvent};
use tauri_plugin_shell::{process::CommandChild, ShellExt};

/// Keeps the Python API sidecar alive for the lifetime of the window.
#[derive(Default)]
struct BackendSidecar(Mutex<Option<CommandChild>>);

fn spawn_backend(app: &tauri::AppHandle) {
    match app.shell().sidecar("backend_api") {
        Ok(cmd) => match cmd.spawn() {
            Ok((_events, child)) => {
                if let Some(state) = app.try_state::<BackendSidecar>() {
                    if let Ok(mut slot) = state.0.lock() {
                        *slot = Some(child);
                    }
                }
            }
            Err(err) => eprintln!("backend sidecar failed to start: {err}"),
        },
        Err(err) => eprintln!("backend sidecar not found (running in demo mode): {err}"),
    }
}

fn stop_backend(app: &tauri::AppHandle) {
    let Some(state) = app.try_state::<BackendSidecar>() else {
        return;
    };
    let Ok(mut slot) = state.0.lock() else {
        return;
    };
    let Some(child) = slot.take() else {
        return;
    };

    let pid = child.pid();

    // A PyInstaller one-file exe is a bootloader that runs the real server in a
    // child process. Kill the tree while the bootloader is still alive, otherwise
    // the server gets orphaned and keeps holding the API port.
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x0800_0000;
        let _ = std::process::Command::new("taskkill")
            .args(["/T", "/F", "/PID", &pid.to_string()])
            .creation_flags(CREATE_NO_WINDOW)
            .status();
    }

    let _ = child.kill();
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .manage(BackendSidecar::default())
        .setup(|app| {
            spawn_backend(app.handle());
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app_handle, event| {
            if let RunEvent::Exit = event {
                stop_backend(app_handle);
            }
        });
}
