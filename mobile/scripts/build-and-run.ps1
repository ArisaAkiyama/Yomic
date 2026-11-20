<#
.SYNOPSIS
    Build APK Yomic Mobile via Gradle CLI dan opsional langsung install + jalankan di HP Android via ADB/scrcpy.
#>
param(
    [switch]$Release,
    [switch]$InstallOnly,
    [switch]$NoInstall,
    [switch]$Scrcpy
)

$ErrorActionPreference = "Stop"
$mobileRoot = Split-Path -Parent $PSScriptRoot

# Auto-detect JAVA_HOME if not in current session PATH
if (-not $env:JAVA_HOME -or -not (Test-Path (Join-Path $env:JAVA_HOME "bin\java.exe"))) {
    $jdkDir = Get-ChildItem "C:\Program Files\Microsoft\jdk-17*" -ErrorAction SilentlyContinue | Sort-Object Name -Descending | Select-Object -First 1
    if ($jdkDir) {
        $env:JAVA_HOME = $jdkDir.FullName
        $env:PATH = "$($jdkDir.FullName)\bin;$env:PATH"
    }
}

$variant = if ($Release) { "Release" } else { "Debug" }
$apkRelPath = if ($Release) { "app\build\outputs\apk\release\app-release.apk" } else { "app\build\outputs\apk\debug\app-debug.apk" }
$apkPath = Join-Path $mobileRoot $apkRelPath
$appId = if ($Release) { "id.yomic.mobile" } else { "id.yomic.mobile.debug" }

if (-not $InstallOnly) {
    Write-Host "=== Building Yomic Mobile ($variant APK) ===" -ForegroundColor Cyan
    Push-Location $mobileRoot
    try {
        & .\gradlew.bat ":app:assemble$variant"
        if ($LASTEXITCODE -ne 0) { throw "Gradle build gagal (exit code $LASTEXITCODE)" }
    } finally {
        Pop-Location
    }
}

if (-not (Test-Path $apkPath)) {
    throw "APK tidak ditemukan di: $apkPath"
}

$sizeMb = [Math]::Round((Get-Item $apkPath).Length / 1MB, 2)
Write-Host "[OK] APK siap: $apkPath ($sizeMb MB)" -ForegroundColor Green

if ($NoInstall) { return }

# Locate adb from local.properties SDK or PATH
$adbCmd = Get-Command adb -ErrorAction SilentlyContinue
$adb = if ($adbCmd) { $adbCmd.Source } else { $null }
if (-not $adb) {
    $localProps = Join-Path $mobileRoot "local.properties"
    if (Test-Path $localProps) {
        $sdkLine = (Get-Content $localProps | Where-Object { $_ -match "^sdk\.dir=" } | Select-Object -First 1)
        if ($sdkLine) {
            $sdkDir = (($sdkLine -replace "^sdk\.dir=", "") -replace '\\:', ':') -replace '\\\\', '\'
            $candidate = Join-Path $sdkDir "platform-tools\adb.exe"
            if (Test-Path $candidate) { $adb = $candidate }
        }
    }
}

if (-not $adb) {
    Write-Host "[Info] adb tidak ditemukan. Anda dapat menyalin APK secara manual ke HP Android: $apkPath" -ForegroundColor Yellow
    return
}

$devices = & $adb devices | Select-String "\tdevice$"
if (-not $devices) {
    Write-Host "[Info] Belum ada HP Android terhubung via USB/Wireless Debugging." -ForegroundColor Yellow
    Write-Host "       Aktifkan USB Debugging di HP, colok kabel USB (atau jalankan 'adb connect <IP>:<PORT>'), lalu jalankan ulang skrip ini." -ForegroundColor Gray
    return
}

Write-Host "Memasang APK ke perangkat Android..." -ForegroundColor Cyan
& $adb install -r $apkPath
& $adb shell am start -n "$appId/id.yomic.mobile.MainActivity"
Write-Host "[OK] Yomic Mobile berhasil dijalankan di HP Android!" -ForegroundColor Green

if ($Scrcpy) {
    $scrcpyCmd = Get-Command scrcpy -ErrorAction SilentlyContinue
    $scrcpyExe = if ($scrcpyCmd) { $scrcpyCmd.Source } else { $null }
    if ($scrcpyExe) {
        Start-Process $scrcpyExe -ArgumentList "--window-title", "Yomic Mobile"
    } else {
        Write-Host "[Tip] Install scrcpy (5 MB) untuk mirror layar HP ke PC: winget install Genymobile.scrcpy" -ForegroundColor Yellow
    }
}
