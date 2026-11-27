# Builds a portable, no-install copy of the app.
#
# The output folder contains co-jsu-desktop.exe (the app) and backend_api.exe
# (the FastAPI sidecar). The app starts and stops the backend by itself, so a
# user only needs to double-click one file — nothing is installed, no registry
# entries, no admin rights, no Python.
#
# Usage: powershell -ExecutionPolicy Bypass -File .\scripts\package-portable.ps1

$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
Push-Location $projectRoot
try {
    $release = "src-tauri\target\release"
    $appExe = Join-Path $release "co-jsu-desktop.exe"
    $sidecarExe = Join-Path $release "backend_api.exe"
    if (-not (Test-Path $appExe)) { throw "Missing $appExe. Run scripts\build.ps1 first." }
    if (-not (Test-Path $sidecarExe)) { throw "Missing $sidecarExe. Run scripts\build.ps1 first." }

    # Keep this outside dist/: Vite empties dist/ on every build.
    $out = Join-Path $projectRoot "release\co-jsu-desktop-portable"
    if (Test-Path $out) { Remove-Item -Recurse -Force $out }
    New-Item -ItemType Directory -Force -Path $out | Out-Null

    Copy-Item $appExe $out
    Copy-Item $sidecarExe $out

    # The backend stores data beside the exe when these folders are present,
    # which is what makes the copy portable (records travel with the folder).
    New-Item -ItemType Directory -Force -Path (Join-Path $out "data") | Out-Null
    New-Item -ItemType Directory -Force -Path (Join-Path $out "logo") | Out-Null

    $launcher = @"
@echo off
rem Double-click this file to start the app. Nothing is installed.
cd /d "%~dp0"
start "" "co-jsu-desktop.exe"
"@
    Set-Content -Path (Join-Path $out "Mula co-jsu-desktop.bat") -Value $launcher -Encoding ASCII

    $readme = @"
co-jsu-desktop (versi mudah alih / portable)
===========================================

CARA GUNA
  Klik dua kali: "Mula co-jsu-desktop.bat"
  (atau klik dua kali terus "co-jsu-desktop.exe")

  Pelayan FastAPI (backend_api.exe) dimulakan dan dihentikan secara
  automatik oleh aplikasi. Tidak perlu install Python.

TIADA PEMASANGAN
  Fail ini boleh disalin ke mana-mana folder atau pendrive USB.
  Tiada registry, tiada admin, tiada Setup.exe.

DATA DISIMPAN DI
  folder "data" di sebelah fail ini:
  data\co_jsu_records.db        <- rekod kursus
  logo\                         <- logo institusi yang dimuat naik

  Jadi rekod ikut bersama folder ini (boleh bawa guna pendrive).
  JANGAN padam folder "data" melainkan anda mahu mula semula.

  Jika folder "data" tiada atau tidak boleh ditulis, aplikasi menyimpan
  di %LOCALAPPDATA%\co-jsu-desktop\ sebagai ganti.

KEPERLUAN
  Windows 10/11 64-bit + Microsoft Edge WebView2 Runtime.
  WebView2 sudah sedia ada pada Windows 11 dan Windows 10 yang dikemas kini.

HOW TO RUN (English)
  Double-click "Mula co-jsu-desktop.bat" (or co-jsu-desktop.exe).
  The FastAPI backend starts and stops automatically; Python is not required.

  Records are stored in the "data" folder next to the exe, so the whole
  folder can be moved to a USB drive and keeps its data. If "data" is missing
  or read-only, %LOCALAPPDATA%\co-jsu-desktop\ is used instead.
"@
    Set-Content -Path (Join-Path $out "BACA SAYA.txt") -Value $readme -Encoding UTF8

    Write-Host ""
    Write-Host "=== Portable folder ===" -ForegroundColor Green
    Get-ChildItem $out | ForEach-Object { "{0}  ({1:N1} MB)" -f $_.Name, ($_.Length / 1MB) }
    Write-Host ""
    Write-Host "Location: $out"
    exit 0
}
finally {
    Pop-Location
}
