# Changelog

All notable changes to **Yomic** will be documented in this file.

## [2.1.0] - 2026-11-19

Update Details：
◆ Add smart WebView2 chapter page extractor window (WebViewPageExtractorWindow) that runs off-screen silently during an 8-second grace period to resolve automatic security checks without popups, and automatically reveals itself centered on screen only when interactive verification (Cloudflare Turnstile / CAPTCHA) is required.
◆ Add custom per-source WebView page extraction hooks (chapterReadySelector & pageWebViewExtractScript) and verification status reporting (GetPageListWithStatusAsync & RequiresVerification) in JsMangaSource.
◆ Add automatic & manual WebView verification fallback flow in BackendIpcController (reader:pages with manualVerify & requiresVerification flags) to seamlessly recover chapter image lists when HTTP scraping is gated by dynamic client-side challenges.
◆ Add "Verify in WebView" (Verifikasi di WebView) interactive recovery button and dedicated "Security Verification Required" state in Reader view (reader.ts) when a chapter requires user verification.
◆ Add dynamic Next.js Server Action ID resolver (resolveUnlockActionId) in VoraToon extension (voratoon.js v1.2.1) to automatically extract the active unlockChapterPages action hash from Next.js series chunks instead of relying on a static hardcoded hash.
◆ Add automatic Next-Action cache invalidation and 404 retry logic in VoraToon extension when unlocking pagesTicket chapter images, plus automatic Turnstile/pagesTicket verification detection.
◆ Add standard multi-resolution Windows application icon (Assets/app.ico) containing 16x16, 24x24, 32x32, 48x48, and 64x64 32-bit ARGB BMP DIB frames alongside a 256x256 high-DPI PNG frame for crisp rendering across Windows 11 Taskbar, Desktop shortcuts, and Start Menu.
◆ Improve RSC (React Server Components) JSON chunk parser performance in voratoon.js using compiled regular expression token scanning instead of character-by-character loops.
◆ Improve MSBuild output packaging in YomicDesktop.csproj and Inno Setup script (Installer/Yomic.iss) to deploy app.ico to both {app}\app.ico and {app}\Assets\app.ico while keeping Assets/app.ico embedded as a WPF resource.
◆ Fix blank white document icon on Windows 11 Taskbar, Desktop shortcut, and Start Menu shortcut after installation by ensuring {app}\app.ico is always packaged and deployed by the installer.
◆ Fix startup XamlParseException / DirectoryNotFoundException crash on MainWindow initialization by keeping Assets/app.ico as an embedded WPF Resource instead of an external AssemblyAssociatedContentFile.
◆ Fix VoraToon chapter images failing to load when Next.js deployment updates rotate the unlockChapterPages Server Action ID or require client-side ticket verification.

## [2.0.0] - 2026-11-17

### Added
- **Complete Hybrid Architecture Rewrite**: Migrated from Avalonia UI to **.NET 8 WPF + Microsoft Edge WebView2 + Modular TypeScript**.
- **SkiaSharp Image Processing Engine**: Auto-crop borders, smart downscaling, optional sharpening, and WebP compression via `WebResourceImageProxy`.
- **Reading Insights Dashboard**: 14-day activity chart, top genres, completion rate, estimated reading time, and **Daily Streak** tracking across Library and History.
- **MangaDex Language Flag Switcher (`ID` / `EN`)**: Direct header switcher for Indonesian and English MangaDex catalogs and chapters.
- **102+ Extension Catalog**: Integrated offline catalog merge with [ArisaAkiyama/extension-yomic](https://github.com/ArisaAkiyama/extension-yomic) (`src/en` & `src/id`).
- **Enhanced Security & Stability**: Single-instance `Mutex`, headless `--background-update`, DPAPI-encrypted MyAnimeList OAuth2 tokens, SQLite WAL checkpointing in `.yomicbackup`, and local proxy path validation.
- **Clean v1 → v2 Installer Upgrade**: Automated legacy v1 cleanup in `Installer/Yomic.iss` while preserving user data and installed `.js` extensions.

## [1.8.0] - 2026-08-10

### Added
- Skeleton loading placeholder animations for library and source list view items.
- Enhanced window title bar header styling with solid Charcoal Black (`#111214`) background.
- Improved window caption button alignment and title bar margins on maximized window state.

### Changed
- Updated application version to 1.8.0.
- Built new installer package for distribution.

## [1.7.1] - 2026-07-26

### Added
- Native .NET 10 Desktop Runtime auto-downloader inside Inno Setup installer.
- MSBuild auto-installer compiler target in `Yomic.csproj`.
- Terminal / Command Prompt CLI integration (`yomic` command).
- Single-instance protection (`AppMutex`) and automatic cache cleanup on upgrade.
- Complete 100% Bahasa Indonesia language support in installer.

## [1.7.0] - 2026-07-23

### Changed
- Updated application version to 1.7.0.
- Built new installer package for distribution.

## [1.3.0] - Major Update & UI Overhaul

Update Details：
◆ Add the ability to backup and restore user data, including library, read history, and app settings, into a single secure `.yomic` file.
◆ Add DNS over HTTPS configuration in Settings with multiple providers (Google DNS set as default) to improve connectivity and bypass restrictions.
◆ Improve the overall UI of the Settings page by introducing a more modern, premium aesthetic with rounded borders, soft shadows, and clean layouts.
◆ Improve the Sidebar Navigation by implementing a dedicated `SidebarBtn` style featuring a Windows 11 Fluent UI style pill selection indicator.
◆ Improve the layout and alignment of the "About" section in the Settings page, ensuring the "Check for Updates" and version number display (`v1.3.0`) are perfectly positioned.
◆ Fix a widespread visual bug where standard navigation buttons (like Back, Refresh, and Reader Next/Prev) incorrectly inherited a square gray/blue hover box from the Sidebar.
◆ Fix a bug where clicking on Fluent Icons inside buttons would sometimes trigger text selection, causing a solid blue background box to appear.
◆ Fix button border radius inheritance in `ReaderView`, ensuring all small icon buttons return to their intended smooth, circular hover effects.
◆ Fix the layout alignment and spacing logic for the backup data action buttons within `SettingsView.axaml`.
◆ Improve localization and consistency of button states across Dark and Light mode themes.

## [1.2.0] - 2026-03-25

### Added
- **New Extension**: Added support for `maid.my.id` source.
- **Infinite Scroll**: Implemented automatic infinite scroll behavior to the "Latest" section of WestManga.
- **Auto-Update Dialog**: Replaced the previous update toast notification with a new fully-featured Modal Dialog for application updates.

### Changed
- **Server Startup Performance**: Greatly optimized the local Node.js server startup speed (bypassed long installation checks and reduced port timeout delays, providing near-instant Online status).
- **Settings UI**: Refined button hover styles for "Visit Website" and "Check for Updates" to maintain consistent aesthetic theming in Light Mode.
- **Removed Screen Translator**: Completely stripped out the experimental Groq/Gemini translation `ItemsControl` overlays from `ReaderView` due to the unreliability of vision models strictly adhering to bounding boxes.

### Fixed
- **Reader Image Loading**: Remedied persistent `503 Service Unavailable` errors when loading chapter images.
- **WestManga Dates**: Fixed an issue where newly updated manga strings were displaying as "20492d ago" instead of "today".
- **Feedback UI**: Cleaned up unintentional textbox hover effects in the feedback dialog.

## [1.0.1] - 2026-02-02

### Changed
- **UI Refinement**: Standardized circular "Back" buttons with orange hover effect across all views.
- **Installer**: Fixed execution error ("File not found") and updated to use correct executable name.
- **About Page**: Dynamic version display binding to assembly version.
- **Architecture**: Separated Extensions into a dedicated repository ([ArisaAkiyama/extension-yomic](https://github.com/ArisaAkiyama/extension-yomic)).

## [1.0.0] - 2026-02-01

### Added
- Initial release of Yomic Desktop App.
- Core library management and reading features.
- Extension support for dynamic sources.
- Download manager for offline reading.
- Webtoon and Single/Double Page reading modes.
- Integrated VPN bypass for restricted sources.
- Modern Fluent UI with Dark/Light mode.
- Settings for customization (Secure Screen, Auto-Update).
- **Auto Update Checker**: Check for new releases directly from the app.
- **Smart Installer**: Supports auto-updates, firewall configuration, and clean uninstalls.
