<div align="center">

<img src="./Yomic/Assets/app.ico" alt="Yomic logo" title="Yomic logo" width="128"/>

# Yomic
### The Ultimate Desktop Manga Reader

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![Platform](https://img.shields.io/badge/platform-Windows-blue.svg)](https://github.com/ArisaAkiyama/yomic)
[![.NET](https://img.shields.io/badge/.NET-10.0-purple.svg)](https://dotnet.microsoft.com/)
[![Avalonia](https://img.shields.io/badge/Avalonia-11.3.11-orange.svg)](https://avaloniaui.net/)
[![Extensions](https://img.shields.io/badge/Extensions-Available-green.svg)](https://github.com/ArisaAkiyama/extension-yomic)
[![Trakteer](https://img.shields.io/badge/Trakteer-Dukung%20Saya-be1e2d.svg?style=flat)](https://trakteer.id/Arisa-Akiyama)

**Yomic** is a free, open-source desktop application designed for reading manga, manhwa, manhua, and webtoons on Windows. Add sources through extensions, organize your personal library, and read online or offline with zero ads and maximum performance.

[**Download Latest Release**](https://github.com/ArisaAkiyama/yomic/releases)

<br/>

<a href="https://trakteer.id/Arisa-Akiyama" target="_blank"><img id="wse-buttons-preview" src="https://edge-cdn.trakteer.id/images/embed/trbtn-red-1.png?v=14-05-2025" height="40" style="border:0px;height:40px;" alt="Trakteer Saya"></a>

</div>

---

## What is Yomic?

Yomic is a centralized manga manager and high-performance reader. Instead of opening multiple browser tabs or navigating different comic websites, Yomic connects to comic repositories using modular extensions. This allows you to search, track, download, and read your favorite series inside a clean, modern desktop interface.

---

## Features

### High-Performance Core Architecture
- **Google Chrome V8 Engine Integration**: Extension scripts execute using native Google Chrome V8 engine binaries (`Microsoft.ClearScript.V8`), providing ultra-fast JavaScript parsing and script execution.
- **SkiaSharp & SVG Rendering**: User interface graphics and vector icons are rendered using `SkiaSharp` and `Avalonia.Svg.Skia`, ensuring crisp visuals on high-DPI displays (1080p, 2K, 4K, 8K).
- **Instant Binary Serialization**: Library metadata loads instantly using `MemoryPack` binary serialization, removing loading delays when opening large collections.
- **Lock-Free Cache & XxHash64**: Image caches use `BitFaster.Caching` concurrent LRU memory management combined with `XxHash64` 10 GB/s non-cryptographic hashing to minimize RAM usage.
- **Windows HTTP/2 & Network Resilience**: Network operations utilize `WinHttpHandler` for native HTTP/2 multiplexing, paired with `Polly` exponential backoff policies for automatic connection retries.
- **SQLite WAL Database**: Reading history, library status, and chapter tracking are saved using SQLite in Write-Ahead Logging (WAL) mode for maximum data integrity.

### Library & Organization
- **Virtualized Grid & List View**: Powered by `Avalonia.Controls.ItemsRepeater` for smooth 60 FPS scrolling through thousands of titles without memory stutter.
- **Smart Status Badges**: Visual indicators display unread chapter counts, new chapter release ribbons, downloaded status badges, and in-library markers.
- **Sorting & Tag Filtering**: Sort titles by recently read, unread count, or update date, and filter your collection by source or status.
- **Backup & Restore**: Easily back up your library database, user settings, and cover cache into a standard `.zip` archive and restore it anytime using `SharpZipLib`.

### Unlimited Sources (Extensions)
- **Modular Extension Manager**: Browse available extensions from the online repository and install them with a single click.
- **Multi-Language Support**: Access content from English and Indonesian comic repositories.
- **Cloudflare & Network Tools**: Built-in verification tools and DNS-over-HTTPS (DoH) help bypass network restrictions seamlessly.

### Reading Experience
- **Webtoon Mode**: Continuous vertical scrolling built specifically for long-strip webtoons, featuring smooth mouse wheel inertia and auto-scrolling options.
- **Paged & Dual-Page Mode**: Classic single-page or two-page side-by-side reading for traditional manga layouts.
- **Background Preloading**: Automatically preloads upcoming pages in the background so chapter transitions happen without waiting.
- **Zoom & Custom Controls**: Fit to width, fit to height, custom zoom multipliers, and rotation.
- **Fullscreen & Shortcuts**: Full-screen mode support (`F11`) with complete keyboard navigation.

---

## Installation

### Requirements
- **Windows 10** or higher (64-bit)
- **.NET Desktop Runtime 10.0** (installed automatically by the setup package)

### Steps
1. Visit the [**Releases Page**](https://github.com/ArisaAkiyama/yomic/releases).
2. Download the latest `Setup.exe` file.
3. Run the installer and follow the instructions.
4. Open **Yomic** from your Desktop or Start menu.

---

## Setting Up Extensions

### Automatic Installation (Recommended)
1. Open **Yomic** and click the **Extensions** tab.
2. Under the **Available** list, choose the sources you want to add.
3. Click the **Download & Install** button next to any extension — Yomic will download, extract, and register the extension automatically.
4. Go to the **Browse** tab to start exploring comic catalogs.

### Manual / Local Extension Installation
1. Obtain your extension file (`.js` script or `.zip` extension package).
2. Open **Yomic** and navigate to the **Extensions** tab.
3. Place your extension file into the Yomic Extensions directory (`%LOCALAPPDATA%\Yomic\Extensions`), or click **Install Local Extension** to pick your `.js` or `.zip` file.
4. Yomic will load and activate the extension immediately without requiring an application restart.

---

## Building from Source

### Requirements
- **.NET 10.0 SDK**
- **Visual Studio 2022 (v17.12+)** or **VS Code** with C# Dev Kit

```bash
# Clone the repository
git clone https://github.com/ArisaAkiyama/yomic.git
cd yomic

# Build the solution
dotnet build Yomic.sln
```

---

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Right Arrow` / `Page Down` | Next Page / Scroll Down |
| `Left Arrow` / `Page Up` | Previous Page / Scroll Up |
| `F11` / `F` | Toggle Fullscreen |
| `Esc` | Exit Fullscreen / Close Reader |
| `R` | Rotate Page |
| `Ctrl+B` | Bookmark Chapter |
| `Space` | Page Scroll |

---

## Contributing

Contributions are welcome. Feel free to open issues or submit pull requests to help improve Yomic.

1. Fork the project
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

## Disclaimer

The developer(s) of Yomic are not affiliated with any third-party content providers. Yomic is an open-source application designed to browse and view content hosted on public websites through user-installed extensions.

---

## License

Distributed under the MIT License. See `LICENSE` for more information.
