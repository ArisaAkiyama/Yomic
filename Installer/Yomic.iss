; =============================================================================
; Yomic v2 - Modern Desktop Manga, Manhwa & Webtoon Reader
; Inno Setup 6 Industrial Installer Script
; =============================================================================

#define MyAppName "Yomic"
#define MyAppPublisher "ArisaAkiyama"
#define MyAppVersion "2.1.0"
#define MyAppExeName "Yomic.exe"
#define MyAppIconName "app.ico"
#define MyAppId "{{B5A9C24D-7E81-4C3D-9471-89352A9F5C12}"

[Setup]
AppId={#MyAppId}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppVerName={#MyAppName} v{#MyAppVersion}
AppPublisher={#MyAppPublisher}
AppComments=Yomic v2 - Modern Desktop Manga, Manhwa & Webtoon Reader
AppCopyright=Copyright (C) 2026 {#MyAppPublisher}
VersionInfoVersion={#MyAppVersion}.0
VersionInfoDescription={#MyAppName} Desktop Installer
DefaultDirName={autopf}\{#MyAppName}
DefaultGroupName={#MyAppName}
DisableProgramGroupPage=yes
PrivilegesRequired=lowest
OutputDir=..\dist
OutputBaseFilename=Yomic_Setup_v{#MyAppVersion}
SetupIconFile=..\src\YomicDesktop\Assets\app.ico
UninstallDisplayIcon={app}\{#MyAppIconName}
UninstallDisplayName={#MyAppName}
WizardStyle=modern
Compression=lzma2/ultra64
SolidCompression=yes
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
AppMutex=Local\Yomic_SingleInstance_Mutex
CloseApplications=force
RestartApplications=no

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[CustomMessages]
CreateDesktopIcon=Create a &desktop shortcut
CreateStartupIcon=Start &Yomic automatically when Windows starts
GroupAdditionalTasks=Additional shortcuts & startup:
LaunchApp=Launch {#MyAppName} now

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:GroupAdditionalTasks}"
Name: "startupicon"; Description: "{cm:CreateStartupIcon}"; GroupDescription: "{cm:GroupAdditionalTasks}"; Flags: unchecked

[InstallDelete]
; Clean up legacy Yomic v1 binaries/DLLs (e.g. Avalonia) in {app} before installing v2.
; User data (%LOCALAPPDATA%\Yomic and %APPDATA%\Yomic) is untouched.
Type: filesandordirs; Name: "{app}\*"

[Files]
Source: "..\dist\Yomic_v2\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "..\src\YomicDesktop\Assets\app.ico"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\src\YomicDesktop\Assets\app.ico"; DestDir: "{app}\Assets"; Flags: ignoreversion

[Icons]
; Start Menu Shortcut
Name: "{autoprograms}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; IconFilename: "{app}\{#MyAppIconName}"; WorkingDir: "{app}"; Comment: "Open Yomic Manga Reader"
; Desktop Shortcut
Name: "{autodesktop}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; IconFilename: "{app}\{#MyAppIconName}"; WorkingDir: "{app}"; Tasks: desktopicon; Comment: "Open Yomic Manga Reader"

[Registry]
; Optional Run at Windows Startup
Root: HKCU; Subkey: "Software\Microsoft\Windows\CurrentVersion\Run"; ValueType: string; ValueName: "Yomic"; ValueData: """{app}\{#MyAppExeName}"""; Flags: uninsdeletevalue; Tasks: startupicon

[Run]
Filename: "{app}\{#MyAppExeName}"; Description: "{cm:LaunchApp}"; Flags: nowait postinstall skipifsilent

[Code]
var
  DownloadPage: TDownloadWizardPage;

// Check if Microsoft Edge WebView2 Evergreen Runtime is installed on target PC
function IsWebView2RuntimeInstalled(): Boolean;
var
  Version: String;
begin
  Result :=
    (RegQueryStringValue(HKLM, 'SOFTWARE\WOW6432Node\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}', 'pv', Version) and (Version <> '') and (Version <> '0.0.0.0')) or
    (RegQueryStringValue(HKLM, 'SOFTWARE\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}', 'pv', Version) and (Version <> '') and (Version <> '0.0.0.0')) or
    (RegQueryStringValue(HKCU, 'Software\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}', 'pv', Version) and (Version <> '') and (Version <> '0.0.0.0'));
end;

// Extract executable path from a quoted or unquoted UninstallString
function ExtractUninstallExe(const RawCmd: String): String;
var
  S: String;
  EndQuotePos, SpacePos: Integer;
begin
  S := Trim(RawCmd);
  if S = '' then
  begin
    Result := '';
    Exit;
  end;

  if S[1] = '"' then
  begin
    Delete(S, 1, 1);
    EndQuotePos := Pos('"', S);
    if EndQuotePos > 0 then
      Result := Copy(S, 1, EndQuotePos - 1)
    else
      Result := S;
  end
  else
  begin
    SpacePos := Pos(' ', S);
    if SpacePos > 0 then
      Result := Copy(S, 1, SpacePos - 1)
    else
      Result := S;
  end;
end;

// Uninstall any legacy Yomic v1 installation that used a different AppId or root
procedure UninstallLegacyYomicInRoot(const RootKey: Integer; const SubKey: String);
var
  Subkeys: TArrayOfString;
  I, ResultCode: Integer;
  EntryKey, DisplayName, DisplayVer, UninstCmd, UninstExe: String;
begin
  if not RegGetSubkeyNames(RootKey, SubKey, Subkeys) then
    Exit;

  for I := 0 to GetArrayLength(Subkeys) - 1 do
  begin
    // Skip our own AppId if it matches
    if CompareText(Subkeys[I], '{B5A9C24D-7E81-4C3D-9471-89352A9F5C12}_is1') = 0 then
      Continue;

    EntryKey := SubKey + '\' + Subkeys[I];
    if RegQueryStringValue(RootKey, EntryKey, 'DisplayName', DisplayName) then
    begin
      if (CompareText(Trim(DisplayName), 'Yomic') = 0) or
         (CompareText(Trim(DisplayName), 'Yomic Desktop') = 0) or
         (Pos('Yomic v1', DisplayName) > 0) then
      begin
        DisplayVer := '';
        RegQueryStringValue(RootKey, EntryKey, 'DisplayVersion', DisplayVer);

        // Only uninstall older 1.x versions or mismatched AppId entries
        if (DisplayVer = '') or (Pos('1.', DisplayVer) = 1) or (Pos('2.', DisplayVer) <> 1) then
        begin
          if RegQueryStringValue(RootKey, EntryKey, 'UninstallString', UninstCmd) then
          begin
            UninstExe := ExtractUninstallExe(UninstCmd);
            if (UninstExe <> '') and FileExists(UninstExe) then
            begin
              Exec(UninstExe, '/VERYSILENT /SUPPRESSMSGBOXES /NORESTART', '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
            end;
          end;
        end;
      end;
    end;
  end;
end;

procedure InitializeWizard;
begin
  DownloadPage := CreateDownloadPage(SetupMessage(msgWizardPreparing), SetupMessage(msgPreparingDesc), nil);
end;

// Automatically stop any running Yomic v1/v2 instance, clean legacy v1 entries, & install WebView2 if missing
function PrepareToInstall(var NeedsRestart: Boolean): String;
var
  ResultCode: Integer;
  BootstrapperPath: String;
begin
  // 1. Force close any running Yomic v1 or v2 process
  Exec(ExpandConstant('{sys}\taskkill.exe'), '/F /IM {#MyAppExeName}', '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
  Exec(ExpandConstant('{sys}\taskkill.exe'), '/F /IM Yomic.Desktop.exe', '', SW_HIDE, ewWaitUntilTerminated, ResultCode);

  // 2. Remove legacy Yomic v1 registry/uninstaller entries if present under another AppId
  UninstallLegacyYomicInRoot(HKCU, 'Software\Microsoft\Windows\CurrentVersion\Uninstall');
  UninstallLegacyYomicInRoot(HKLM, 'SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall');
  UninstallLegacyYomicInRoot(HKLM, 'SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall');

  // Clean up legacy startup entry name if v1 used "Yomic Desktop"
  RegDeleteValue(HKCU, 'Software\Microsoft\Windows\CurrentVersion\Run', 'Yomic Desktop');

  // 3. Install Microsoft Edge WebView2 Evergreen Runtime if missing
  if not IsWebView2RuntimeInstalled() then
  begin
    DownloadPage.Clear;
    DownloadPage.Add('https://go.microsoft.com/fwlink/p/?LinkId=2124703', 'MicrosoftEdgeWebview2Setup.exe', '');
    DownloadPage.Show;
    try
      try
        DownloadPage.Download;
        BootstrapperPath := ExpandConstant('{tmp}\MicrosoftEdgeWebview2Setup.exe');
        Exec(BootstrapperPath, '/silent /install', '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
      except
        // Continue installation even if offline
      end;
    finally
      DownloadPage.Hide;
    end;
  end;

  Result := '';
end;
