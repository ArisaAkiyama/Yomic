<div align="center">

<img src="./Yomic/Assets/app.ico" alt="Yomic logo" title="Yomic logo" width="128"/>

# Yomic
### The Ultimate Desktop Manga Reader

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![Platform](https://img.shields.io/badge/platform-Windows-blue.svg)](https://github.com/ArisaAkiyama/yomic)
[![.NET](https://img.shields.io/badge/.NET-10.0-purple.svg)](https://dotnet.microsoft.com/)
[![Avalonia](https://img.shields.io/badge/Avalonia-11.3.11-orange.svg)](https://avaloniaui.net/)
[![Extensions](https://img.shields.io/badge/Extensions-Available-green.svg)](https://github.com/ArisaAkiyama/extension-yomic)

<p align="center">
  <b>Yomic</b> is a free, open-source desktop application designed for reading manga, manhwa, manhua, and webtoons on Windows.<br/>Add sources through extensions, organize your personal library, and read online or offline with zero ads and maximum performance.
</p>

<br/>

<table>
  <tr>
    <td align="center" width="260">
      <b>📥 Download Here</b><br/><br/>
      <a href="https://github.com/ArisaAkiyama/yomic/releases/download/v1.7.1/Yomic_Setup_v1.7.1.exe">
        <img src="./Yomic/Assets/win-download.png" alt="Download Yomic for Windows" height="42"/>
      </a>
    </td>
    <td align="center" width="280">
      <b>☕ Support & Donation</b><br/><br/>
      <a href="https://trakteer.id/Arisa-Akiyama" target="_blank">
        <img src="https://edge-cdn.trakteer.id/images/embed/trbtn-red-1.png?v=14-05-2025" alt="Dukung Saya di Trakteer" height="42" style="border:0px;height:42px;"/>
      </a>
    </td>
  </tr>
</table>

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

## Screenshots

<div align="center">

<img src="./Yomic/Assets/Readme-Screenshot/1.png" alt="Screenshot 1" width="800"/>
<br/><br/>
<img src="./Yomic/Assets/Readme-Screenshot/2.png" alt="Screenshot 2" width="800"/>
<br/><br/>
<img src="./Yomic/Assets/Readme-Screenshot/3.png" alt="Screenshot 3" width="800"/>
<br/><br/>
<img src="./Yomic/Assets/Readme-Screenshot/4.png" alt="Screenshot 4" width="800"/>
<br/><br/>
<img src="./Yomic/Assets/Readme-Screenshot/5.png" alt="Screenshot 5" width="800"/>
<br/><br/>
<img src="./Yomic/Assets/Readme-Screenshot/6.png" alt="Screenshot 6" width="800"/>
<br/><br/>
<img src="./Yomic/Assets/Readme-Screenshot/7.png" alt="Screenshot 7" width="800"/>
<br/><br/>
<img src="./Yomic/Assets/Readme-Screenshot/8.png" alt="Screenshot 8" width="800"/>
<br/><br/>
<img src="./Yomic/Assets/Readme-Screenshot/9.png" alt="Screenshot 9" width="800"/>
<br/><br/>
<img src="./Yomic/Assets/Readme-Screenshot/10.png" alt="Screenshot 10" width="800"/>
<br/><br/>
<img src="./Yomic/Assets/Readme-Screenshot/11.png" alt="Screenshot 11" width="800"/>

</div>

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
| `Right Arrow` | Next Page / Next Chapter (Webtoon) |
| `Left Arrow` | Previous Page / Previous Chapter (Webtoon) |
| `Down Arrow` | Scroll Down |
| `Up Arrow` | Scroll Up |
| `Space` | Scroll Down (Page / Webtoon) |
| `F` / `F11` | Toggle Fullscreen |
| `Esc` | Exit Fullscreen / Close Reader |
| `R` | Rotate Page |
| `H` | Toggle Menu |
| `Ctrl+B` | Bookmark Chapter |
| `+` / `=` | Zoom In |
| `-` | Zoom Out |
| `1` | Switch to Webtoon Mode |
| `2` | Switch to Single Page Mode |
| `3` | Switch to Dual Page Mode |

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
