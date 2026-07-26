; ============================================================
; Yomic - Desktop Manga Reader
; Inno Setup Script v2.0
; Author  : ArisaAkiyama
; GitHub  : https://github.com/ArisaAkiyama/yomic
; ============================================================

#define MyAppName        "Yomic"
#define MyAppVersion     "1.7.0"
#define MyAppPublisher   "ArisaAkiyama"
#define MyAppURL         "https://github.com/ArisaAkiyama/yomic"
#define MyAppExeName     "Yomic.exe"
#define MyAppDescription "The Ultimate Desktop Manga Reader"
#define DotNetVersion    "10.0"
#define DotNetMinBuild   "10.0.0"

; ============================================================
; [Setup] - Core Configuration
; ============================================================
[Setup]
AppId={{E697071F-5A24-42B1-9D2F-2A7A57416972}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
AppPublisherURL={#MyAppURL}
AppSupportURL={#MyAppURL}
AppUpdatesURL={#MyAppURL}
AppComments={#MyAppDescription}
AppCopyright=Copyright (c) 2025-2026 {#MyAppPublisher}

; --- Directory ---
DefaultDirName={autopf}\{#MyAppName}
UsePreviousAppDir=yes
DisableDirPage=auto
DisableProgramGroupPage=yes

; --- Privileges ---
PrivilegesRequired=admin

; --- Output ---
OutputDir=Output
OutputBaseFilename=Yomic_Setup_v{#MyAppVersion}

; --- Visual / Branding ---
SetupIconFile=d:\Project\DesktopKomik\Yomic\Assets\app.ico
WizardSmallImageFile=d:\Project\DesktopKomik\Yomic\Assets\wizard-small.bmp
WizardImageFile=d:\Project\DesktopKomik\Yomic\Assets\wizard-image.png
WizardStyle=modern
WizardResizable=no
WizardSizePercent=110

; --- Compression ---
Compression=lzma2/ultra64
SolidCompression=yes
LZMAUseSeparateProcess=yes
LZMADictionarySize=65536

; --- Architecture ---
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible

; --- Behavior ---
CloseApplications=yes
LicenseFile=d:\Project\DesktopKomik\LICENSE

; --- Uninstall ---
UninstallDisplayIcon={app}\{#MyAppExeName}
UninstallDisplayName={#MyAppName} v{#MyAppVersion}
CreateUninstallRegKey=yes
UsedUserAreasWarning=no

; --- Version Info ---
VersionInfoCompany={#MyAppPublisher}
VersionInfoDescription={#MyAppName} Setup
VersionInfoProductName={#MyAppName}
VersionInfoProductVersion={#MyAppVersion}
VersionInfoProductTextVersion={#MyAppVersion}
VersionInfoVersion={#MyAppVersion}
VersionInfoCopyright=Copyright (c) 2025-2026 {#MyAppPublisher}

; ============================================================
; [Languages] - English + Bahasa Indonesia
; ============================================================
[Languages]
Name: "english";    MessagesFile: "compiler:Default.isl"
Name: "indonesian"; MessagesFile: "d:\Project\DesktopKomik\installer\Languages\Indonesian.isl"

; ============================================================
; [CustomMessages] - Pesan kustom per bahasa
; ============================================================
[CustomMessages]
english.WelcomeTitle=Welcome to Yomic
english.WelcomeSubtitle=The Ultimate Desktop Manga Reader for Windows
english.DotNetMissing=.NET {#DotNetVersion} Runtime is required but was not found on your system.%n%nThe installer will now open the .NET download page in your browser.%n%nAfter installing .NET {#DotNetVersion}, please run Yomic Setup again.
english.DotNetMissingTitle=.NET Runtime Required
english.LaunchAfterInstall=Launch Yomic after installation

indonesian.WelcomeTitle=Selamat Datang di Yomic
indonesian.WelcomeSubtitle=Pembaca Manga Desktop Terbaik untuk Windows
indonesian.DotNetMissing=.NET {#DotNetVersion} Runtime dibutuhkan tetapi tidak ditemukan di sistem Anda.%n%nInstaler akan membuka halaman unduhan .NET di browser Anda.%n%nSetelah menginstal .NET {#DotNetVersion}, jalankan kembali Yomic Setup.
indonesian.DotNetMissingTitle=.NET Runtime Diperlukan
indonesian.LaunchAfterInstall=Jalankan Yomic setelah instalasi selesai

; ============================================================
; [Tasks]
; ============================================================
[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"

; ============================================================
; [Dirs]
; ============================================================
[Dirs]
Name: "{app}\Plugins";  Permissions: users-modify
Name: "{app}\Cache";    Permissions: users-modify
Name: "{app}\Logs";     Permissions: users-modify

; ============================================================
; [Files]
; ============================================================
[Files]
; Main Application Files
Source: "d:\Project\DesktopKomik\bin\Publish\*"; \
  DestDir: "{app}"; \
  Flags: ignoreversion recursesubdirs createallsubdirs

; Bundled Extensions/Plugins
Source: "d:\Project\DesktopKomik\PackedExtensions\*"; \
  DestDir: "{app}\Plugins"; \
  Flags: ignoreversion recursesubdirs createallsubdirs skipifsourcedoesntexist

; ============================================================
; [Icons]
; ============================================================
[Icons]
Name: "{autoprograms}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"
Name: "{autodesktop}\{#MyAppName}";  Filename: "{app}\{#MyAppExeName}"; Tasks: desktopicon

; ============================================================
; [Run] - Post-install actions
; ============================================================
[Run]
; Launch after install (interactive)
Filename: "{app}\{#MyAppExeName}"; \
  Description: "{cm:LaunchAfterInstall}"; \
  Flags: nowait postinstall skipifsilent

; Auto-launch in silent mode (used by auto-updater)
Filename: "{app}\{#MyAppExeName}"; \
  Flags: nowait skipifnotsilent

; ============================================================
; [UninstallRun] - Pre-uninstall: force close Yomic
; ============================================================
[UninstallRun]
Filename: "taskkill.exe"; \
  Parameters: "/F /IM {#MyAppExeName}"; \
  Flags: runhidden nowait; \
  RunOnceId: "KillYomic"

; ============================================================
; [UninstallDelete] - Clean uninstall (no leftover files)
; ============================================================
[UninstallDelete]
; App directory
Type: filesandordirs; Name: "{app}"

; User data — AppData\Roaming\Yomic
Type: filesandordirs; Name: "{userappdata}\Yomic"

; User data — AppData\Local\Yomic
Type: filesandordirs; Name: "{localappdata}\Yomic"

; Remove empty parent dirs if left behind
Type: dirifempty; Name: "{userappdata}\Yomic"
Type: dirifempty; Name: "{localappdata}\Yomic"
Type: dirifempty; Name: "{app}"

; ============================================================
; [Registry] - Clean up registry on uninstall
; ============================================================
[Registry]
Root: HKCU; Subkey: "Software\ArisaAkiyama\Yomic"; Flags: uninsdeletekey

; ============================================================
; [Code] - Custom logic
; ============================================================
[Code]

// -------------------------------------------------------
// Helper: Check if .NET 10 Runtime is installed
// -------------------------------------------------------
function IsDotNetInstalled(): Boolean;
var
  RuntimePath: String;
  FindRec: TFindRec;
begin
  Result := False;

  // Method 1: Check via dotnet.exe in PATH
  RuntimePath := ExpandConstant('{commonpf64}\dotnet\shared\Microsoft.NETCore.App');
  if DirExists(RuntimePath) then
  begin
    if FindFirst(RuntimePath + '\10.*', FindRec) then
    begin
      Result := True;
      FindClose(FindRec);
      Exit;
    end;
  end;

  // Method 2: Check user-local dotnet install
  RuntimePath := ExpandConstant('{localappdata}\Programs\dotnet\shared\Microsoft.NETCore.App');
  if DirExists(RuntimePath) then
  begin
    if FindFirst(RuntimePath + '\10.*', FindRec) then
    begin
      Result := True;
      FindClose(FindRec);
      Exit;
    end;
  end;

  // Method 3: Registry check (DOTNET_ROOT)
  Result := RegKeyExists(HKLM,
    'SOFTWARE\dotnet\Setup\InstalledVersions\x64\sharedfx\Microsoft.NETCore.App');
end;

// -------------------------------------------------------
// Helper: Check and remove legacy AppData install
// -------------------------------------------------------
procedure CheckAndRemoveLegacyInstall();
var
  LegacyPath: String;
  ResultCode: Integer;
begin
  // Check for User-Local install from older versions
  LegacyPath := ExpandConstant('{localappdata}\Programs\Yomic');
  if DirExists(LegacyPath) then
  begin
    if MsgBox(
      'Ditemukan instalasi Yomic lama di folder AppData lokal Anda.' + #13#10 +
      'Disarankan untuk menghapusnya agar tidak terjadi konflik.' + #13#10 + #13#10 +
      'Hapus instalasi lama sekarang?',
      mbConfirmation, MB_YESNO) = IDYES then
    begin
      if FileExists(LegacyPath + '\unins000.exe') then
      begin
        Exec(LegacyPath + '\unins000.exe',
          '/VERYSILENT /SUPPRESSMSGBOXES', '', SW_HIDE,
          ewWaitUntilTerminated, ResultCode);
      end
      else
      begin
        DelTree(LegacyPath, True, True, True);
      end;
    end;
  end;

  // Check for leftover Yomic.exe in LocalAppData\Yomic
  LegacyPath := ExpandConstant('{localappdata}\Yomic');
  if FileExists(LegacyPath + '\Yomic.exe') then
  begin
    if MsgBox(
      'Ditemukan instalasi Yomic lama di: ' + LegacyPath + #13#10 +
      'Hapus sekarang?',
      mbConfirmation, MB_YESNO) = IDYES then
    begin
      DelTree(LegacyPath, True, True, True);
    end;
  end;
end;

// -------------------------------------------------------
// OnInitializeSetup: validate .NET BEFORE wizard shows
// -------------------------------------------------------
function InitializeSetup(): Boolean;
var
  ErrorCode: Integer;
begin
  Result := True;

  if not IsDotNetInstalled() then
  begin
    if MsgBox(
      CustomMessage('DotNetMissing'),
      mbError, MB_OKCANCEL) = IDOK then
    begin
      ShellExec('open',
        'https://dotnet.microsoft.com/en-us/download/dotnet/{#DotNetVersion}',
        '', '', SW_SHOWNORMAL, ewNoWait, ErrorCode);
    end;
    Result := False; // Abort setup
    Exit;
  end;
end;

// -------------------------------------------------------
// OnInitializeWizard: post-validation setup tasks
// -------------------------------------------------------
procedure InitializeWizard();
begin
  CheckAndRemoveLegacyInstall();
end;

// -------------------------------------------------------
// OnUninstall: force-close Yomic before uninstalling
// -------------------------------------------------------
procedure InitializeUninstallProgressForm();
var
  ErrorCode: Integer;
begin
  Exec('taskkill.exe', '/F /IM {#MyAppExeName}',
    '', SW_HIDE, ewNoWait, ErrorCode);
  Sleep(500); // brief pause to ensure process is terminated
end;

// -------------------------------------------------------
// OnUninstallSuccess: clean leftover user data
// -------------------------------------------------------
procedure DeinitializeUninstall();
var
  UserDataPath: String;
begin
  // Clean AppData\Roaming\Yomic
  UserDataPath := ExpandConstant('{userappdata}\Yomic');
  if DirExists(UserDataPath) then
    DelTree(UserDataPath, True, True, True);

  // Clean AppData\Local\Yomic  
  UserDataPath := ExpandConstant('{localappdata}\Yomic');
  if DirExists(UserDataPath) then
    DelTree(UserDataPath, True, True, True);
end;
