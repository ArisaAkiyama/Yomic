<#
.SYNOPSIS
    Setup toolchain ringan untuk build & run Yomic Mobile TANPA Android Studio.
    Menginstal Microsoft OpenJDK 17, Android CLI, SDK 35 minimal (~126 MB), dan opsional scrcpy.
#>
param(
    [switch]$WithScrcpy
)

$ErrorActionPreference = "Stop"

Write-Host "=== Yomic Mobile — Lightweight Android CLI Setup (No Android Studio) ===" -ForegroundColor Cyan

# 1. Check / Install OpenJDK 17
$jdkDir = Get-ChildItem "C:\Program Files\Microsoft\jdk-17*" -ErrorAction SilentlyContinue | Sort-Object Name -Descending | Select-Object -First 1
if (-not $jdkDir) {
    Write-Host "[1/4] Menginstal Microsoft OpenJDK 17..." -ForegroundColor Yellow
    winget install --id Microsoft.OpenJDK.17 -e --silent --accept-package-agreements --accept-source-agreements
    $jdkDir = Get-ChildItem "C:\Program Files\Microsoft\jdk-17*" -ErrorAction SilentlyContinue | Sort-Object Name -Descending | Select-Object -First 1
}
if ($jdkDir) {
    $env:JAVA_HOME = $jdkDir.FullName
    $env:PATH = "$($jdkDir.FullName)\bin;$env:PATH"
    Write-Host "[OK] JAVA_HOME = $($jdkDir.FullName)" -ForegroundColor Green
}

# 2. Check / Install official Android CLI
$androidExe = Join-Path $env:USERPROFILE "AppData\AndroidCLI\android.exe"
if (-not (Test-Path $androidExe)) {
    Write-Host "[2/4] Menginstal Android CLI..." -ForegroundColor Yellow
    cmd /c "curl -fsSL https://dl.google.com/android/cli/latest/windows_x86_64/install.cmd -o ""%TEMP%\android_cli_install.cmd"" && ""%TEMP%\android_cli_install.cmd"""
}
Write-Host "[OK] Android CLI = $androidExe" -ForegroundColor Green

# 3. Install minimal SDK packages (platform-tools, android-35, build-tools 35.0.0)
Write-Host "[3/4] Memastikan paket SDK minimal (API 35) terpasang..." -ForegroundColor Yellow
& $androidExe sdk install platform-tools platforms/android-35 build-tools/35.0.0

# 4. Write mobile/local.properties pointing to Android CLI SDK
$infoOutput = & $androidExe info 2>&1 | Out-String
$sdkPath = $null
if ($infoOutput -match "(?m)^sdk:\s*(.+)") {
    $sdkPath = $Matches[1].Trim()
} elseif ($infoOutput -match "SDK Location:\s*(.+)") {
    $sdkPath = $Matches[1].Trim()
}
if (-not $sdkPath -or -not (Test-Path $sdkPath)) {
    $candidates = @(
        (Join-Path $env:LOCALAPPDATA "Android\Sdk"),
        (Join-Path $env:USERPROFILE "AppData\Local\Android\Sdk")
    )
    $sdkPath = $candidates | Where-Object { Test-Path $_ } | Select-Object -First 1
}
if ($sdkPath) {
    $mobileRoot = Split-Path -Parent $PSScriptRoot
    $escaped = $sdkPath -replace '\\', '\\'
    Set-Content -Path (Join-Path $mobileRoot "local.properties") -Value "sdk.dir=$escaped" -Encoding ASCII
    Write-Host "[OK] local.properties -> $sdkPath" -ForegroundColor Green
}

if ($WithScrcpy) {
    Write-Host "[4/4] Menginstal scrcpy (~5 MB untuk screen mirroring HP Android di PC)..." -ForegroundColor Yellow
    winget install --id Genymobile.scrcpy -e --silent --accept-package-agreements --accept-source-agreements
}

Write-Host "`nSetup selesai! Jalankan .\mobile\scripts\build-and-run.ps1 untuk build & install ke HP Android." -ForegroundColor Cyan
