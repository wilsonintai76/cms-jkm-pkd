# Starts Tauri in dev mode with the MSVC build environment loaded.
# Rust needs link.exe plus the Windows SDK INCLUDE/LIB paths, which are only
# present inside a "Developer Command Prompt". This script loads them first.
#
# Usage: powershell -ExecutionPolicy Bypass -File .\scripts\dev.ps1

$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
Push-Location $projectRoot
try {
    $installerRoot = "${env:ProgramFiles(x86)}\Microsoft Visual Studio\Installer"
    $vsWhere = Join-Path $installerRoot "vswhere.exe"
    if (-not (Test-Path $vsWhere)) {
        throw "vswhere.exe not found. Install Visual Studio Build Tools 2022 with the 'Desktop development with C++' workload."
    }

    $vsPath = & $vsWhere -latest -products * -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property installationPath
    if (-not $vsPath) {
        throw "Visual Studio C++ Build Tools not found. Install the 'Desktop development with C++' workload (includes the Windows SDK)."
    }

    $vcvars = Join-Path $vsPath "VC\Auxiliary\Build\vcvars64.bat"
    if (-not (Test-Path $vcvars)) {
        throw "vcvars64.bat not found at $vcvars"
    }

    # vcvars64 only sets LIB when a Windows SDK is present.
    $probe = & $env:ComSpec /c "`"$vcvars`" >nul 2>&1 && if defined LIB (echo SDK_OK) else (echo SDK_MISSING)"
    if ($probe -notcontains "SDK_OK") {
        throw "Windows SDK not found (LIB is empty). Install it from the Visual Studio Installer: 'Desktop development with C++' workload, or the standalone Windows 11 SDK."
    }

    # The Rust side spawns the packaged backend as a sidecar, and Tauri refuses to
    # build without it, so make sure it exists before starting dev.
    $sidecarPath = Join-Path $projectRoot "src-tauri\binaries\backend_api-x86_64-pc-windows-msvc.exe"
    if (-not (Test-Path $sidecarPath)) {
        Write-Host "=== Packaging backend sidecar (first run, takes a few minutes) ===" -ForegroundColor Cyan
        New-Item -ItemType Directory -Force -Path (Split-Path -Parent $sidecarPath) | Out-Null
        python -m PyInstaller --noconfirm --onefile --noconsole `
            --name "backend_api-x86_64-pc-windows-msvc" `
            --distpath "src-tauri\binaries" `
            --workpath "build\pyinstaller" `
            --specpath "build\pyinstaller" `
            --collect-data rapidocr_onnxruntime `
            --hidden-import onnxruntime `
            --exclude-module tkinter --exclude-module matplotlib --exclude-module torch `
            --exclude-module PyQt5 --exclude-module IPython `
            backend_api.py
        if ($LASTEXITCODE -ne 0) { throw "PyInstaller failed with exit code $LASTEXITCODE" }
    }

    $extraArgs = if ($args.Count -gt 0) { " -- " + ($args -join " ") } else { "" }
    & $env:ComSpec /c "`"$vcvars`" >nul 2>&1 && npm run tauri dev$extraArgs"
    exit $LASTEXITCODE
}
finally {
    Pop-Location
}
