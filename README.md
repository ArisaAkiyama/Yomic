<img src="https://capsule-render.vercel.app/api?type=waving&color=0:0052CC,100:00AAFF&height=200&section=header&text=Yomic&fontSize=80&fontColor=fff&animation=fadeIn&fontAlignY=38&desc=The%20Ultimate%20Desktop%20Manga%20Reader&descAlignY=58&descSize=22" width="100%"/>

<div align="center">

<img src="./Yomic/Assets/app.ico" alt="Yomic logo" width="110"/>

<br/>

<img src="https://readme-typing-svg.demolab.com?font=Fira+Code&weight=600&size=18&pause=1000&color=0066FF&center=true&vCenter=true&width=700&lines=Read+Manga+%7C+Manhwa+%7C+Manhua+%7C+Webtoon;Unlimited+Sources+via+Extensions;Zero+Ads+%E2%80%94+Maximum+Performance;Open+Source+%26+Free+Forever" alt="Typing SVG"/>

<br/><br/>

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](./LICENSE)
[![Platform](https://img.shields.io/badge/platform-Windows-0078D4.svg?style=flat-square&logo=windows)](https://github.com/ArisaAkiyama/yomic)
[![.NET](https://img.shields.io/badge/.NET-10.0-512BD4.svg?style=flat-square&logo=dotnet)](https://dotnet.microsoft.com/)
[![Avalonia](https://img.shields.io/badge/Avalonia-11.3.11-orange.svg?style=flat-square)](https://avaloniaui.net/)
[![Extensions](https://img.shields.io/badge/Extensions-Available-22C55E.svg?style=flat-square)](https://github.com/ArisaAkiyama/extension-yomic)
[![Latest Release](https://img.shields.io/github/v/release/ArisaAkiyama/yomic?style=flat-square&color=0066FF&label=Latest)](https://github.com/ArisaAkiyama/yomic/releases/latest)
[![Downloads](https://img.shields.io/github/downloads/ArisaAkiyama/yomic/total?style=flat-square&color=22C55E&label=Downloads)](https://github.com/ArisaAkiyama/yomic/releases)
[![Visitors](https://api.visitorbadge.io/api/visitors?path=ArisaAkiyama%2Fyomic&label=Visitors&countColor=%230066FF&style=flat-square)](https://github.com/ArisaAkiyama/yomic)

<br/>

<p align="center">
  <b>Yomic</b> is a free, open-source desktop application for reading manga, manhwa, manhua, and webtoons on Windows.<br/>
  Add sources through extensions, organize your personal library, and read online or offline — with zero ads and maximum performance.
</p>

<br/>

<table>
  <tr>
    <td align="center" width="240">
      <b>📥 Download Here</b><br/><br/>
      <a href="https://github.com/ArisaAkiyama/yomic/releases/download/v1.7.1/Yomic_Setup_v1.7.1.exe">
        <img src="./Yomic/Assets/win-download.png" alt="Download Yomic for Windows" height="42"/>
      </a>
    </td>
    <td align="center" width="240">
      <b>☕ Support & Donation</b><br/><br/>
      <a href="https://trakteer.id/Arisa-Akiyama" target="_blank">
        <img src="https://edge-cdn.trakteer.id/images/embed/trbtn-red-1.png?v=14-05-2025" alt="Dukung Saya di Trakteer" height="42" style="border:0px;height:42px;"/>
      </a>
    </td>
    <td align="center" width="240">
      <b>⭐ Support Yomic</b><br/><br/>
      <a href="https://github.com/ArisaAkiyama/yomic/stargazers">
        <img src="https://img.shields.io/github/stars/ArisaAkiyama/yomic?style=for-the-badge&logo=github&color=EBCB8B&label=Star%20Yomic" alt="Please give the repo a star" height="42"/>
      </a>
    </td>
  </tr>
</table>

<p align="center">
  <b>If you enjoy using Yomic, please give the repo a ⭐!</b>
</p>

</div>

---

## 📖 Table of Contents

- [What is Yomic?](#-what-is-yomic)
- [Features](#-features)
- [Screenshots](#-screenshots)
- [Installation](#-installation)
- [Setting Up Extensions](#-setting-up-extensions)
- [Building from Source](#️-building-from-source)
- [Keyboard Shortcuts](#️-keyboard-shortcuts)
- [Contributing](#-contributing)
- [Disclaimer](#-disclaimer)
- [License](#-license)

---

## 🔍 What is Yomic?

Yomic is a centralized manga manager and high-performance reader. Instead of opening multiple browser tabs or navigating different comic websites, Yomic connects to comic repositories using modular extensions. This allows you to search, track, download, and read your favorite series inside a clean, modern desktop interface.

---

## ✨ Features

### ⚡ High-Performance Core Architecture
- **Google Chrome V8 Engine Integration** — Extension scripts execute using native V8 engine binaries (`Microsoft.ClearScript.V8`) for ultra-fast JavaScript parsing.
- **SkiaSharp & SVG Rendering** — Crisp visuals on high-DPI displays (1080p, 2K, 4K, 8K) via `SkiaSharp` and `Avalonia.Svg.Skia`.
- **Instant Binary Serialization** — Library metadata loads instantly with `MemoryPack` binary serialization.
- **Lock-Free Cache & XxHash64** — Concurrent LRU image caching with 10 GB/s non-cryptographic hashing via `BitFaster.Caching` + `XxHash64`.
- **Windows HTTP/2 & Network Resilience** — Native HTTP/2 multiplexing via `WinHttpHandler` with `Polly` exponential backoff retry policies.
- **SQLite WAL Database** — Reading history, library status, and chapter tracking in Write-Ahead Logging mode for maximum data integrity.

### 📚 Library & Organization
- **Virtualized Grid & List View** — Smooth 60 FPS scrolling through thousands of titles via `Avalonia.Controls.ItemsRepeater`.
- **Smart Status Badges** — Visual indicators for unread chapter counts, new releases, downloaded status, and in-library markers.
- **Sorting & Tag Filtering** — Sort by recently read, unread count, or update date; filter by source or status.
- **Backup & Restore** — Back up library database, settings, and cover cache into a `.zip` archive anytime using `SharpZipLib`.

### 🌐 Unlimited Sources (Extensions)
- **Modular Extension Manager** — Browse and install extensions from the online repository in one click.
- **Multi-Language Support** — Access English and Indonesian comic repositories.
- **Cloudflare & Network Tools** — Built-in verification tools and DNS-over-HTTPS (DoH) to bypass network restrictions.

### 📖 Reading Experience
- **Webtoon Mode** — Continuous vertical scrolling with smooth mouse wheel inertia and auto-scrolling.
- **Paged & Dual-Page Mode** — Classic single-page or two-page side-by-side layouts for traditional manga.
- **Background Preloading** — Upcoming pages preloaded automatically for instant chapter transitions.
- **Zoom & Custom Controls** — Fit to width, fit to height, custom zoom multipliers, and page rotation.
- **Fullscreen & Shortcuts** — Full-screen mode (`F11`) with complete keyboard navigation.

---

## 📸 Screenshots

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

## 📦 Installation

### Requirements
- **Windows 10** or higher (64-bit)
- **.NET Desktop Runtime 10.0** (installed automatically by the setup package)

### Steps
1. Click the **Download Here** button above, or visit the [**Releases Page**](https://github.com/ArisaAkiyama/yomic/releases).
2. Download the latest `Yomic_Setup_vX.X.X.exe` file.
3. Run the installer and follow the on-screen instructions.
4. Open **Yomic** from your Desktop or Start menu.

---

## 🧩 Setting Up Extensions

### Automatic Installation (Recommended)
1. Open **Yomic** and click the **Extensions** tab.
2. Under the **Available** list, choose the sources you want to add.
3. Click the **Download & Install** button — Yomic will download, extract, and register the extension automatically.
4. Go to the **Browse** tab to start exploring comic catalogs.

### Manual / Local Extension Installation
1. Obtain your extension file (`.js` script or `.zip` package).
2. Navigate to the **Extensions** tab in Yomic.
3. Place your file into `%LOCALAPPDATA%\Yomic\Extensions`, or click **Install Local Extension** to pick your file directly.
4. Yomic loads and activates the extension immediately — no restart required.

---

## 🛠️ Building from Source

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

## ⌨️ Keyboard Shortcuts

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

## 🤝 Contributing

Contributions are welcome! Feel free to open issues or submit pull requests to help improve Yomic.

1. Fork the project
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

## ⚠️ Disclaimer

The developer(s) of Yomic are not affiliated with any third-party content providers. Yomic is an open-source application designed to browse and view content hosted on public websites through user-installed extensions.

---

## 📄 License

Distributed under the MIT License. See [`LICENSE`](./LICENSE) for more information.

---

<img src="https://capsule-render.vercel.app/api?type=waving&color=0:00AAFF,100:0052CC&height=120&section=footer" width="100%"/>
