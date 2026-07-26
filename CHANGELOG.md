# Changelog

All notable changes to **Yomic** will be documented in this file.

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
