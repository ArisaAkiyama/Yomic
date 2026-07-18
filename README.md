<div align="center">

<img src="./Yomic/Assets/app.ico" alt="Yomic logo" width="128"/>

# Yomic
### The Ultimate Desktop Manga & Comic Reader

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![Platform](https://img.shields.io/badge/platform-Windows-blue.svg)](https://github.com/ArisaAkiyama/yomic)
[![.NET](https://img.shields.io/badge/.NET-10.0-purple.svg)](https://dotnet.microsoft.com/)
[![Avalonia](https://img.shields.io/badge/Avalonia-11.3-orange.svg)](https://avaloniaui.net/)

**Yomic** is a free, fast, and open-source desktop reader for manga, comics, and webtoons. Built with C# and Avalonia UI, it brings a beautiful, ad-free reading experience to Windows.

[**Download Installer**](https://github.com/ArisaAkiyama/yomic/releases)

</div>

---

## ✨ Features

### 📖 Reading Modes
*   **Webtoon Mode**: Smooth, continuous vertical scrolling.
*   **Paged Mode**: Traditional single-page viewing (Left-to-Right or Right-to-Left).
*   **Dual-Page Spread**: Manga mode showing two pages side-by-side.
*   **Smart Scaling**: Auto-fit page height/width, zoom memory, and clean image rendering.

### 🗂️ Library & Organization
*   **Custom Categories**: Organize your collection into custom folders.
*   **Mihon-inspired UI**: Clean cover grids, unread indicators, and "NEW" chapter badges.
*   **Smart Update Tracking**: Automatic updates based on reading activity and release history.

### 🧩 Extension Support
*   **Plugin Architecture**: Install sources easily directly from the UI.
*   **JavaScript & DLL Support**: Loads modular `.js` (Jint engine) and `.dll` extensions.
*   **Cloudflare & DPI Bypass**: Built-in interactive browser verification and packet fragmentation to access blocked sources (like MangaDex) without a VPN.

### ⚡ Performance & QoL
*   **Background Preloading**: Automatically downloads the next chapter's pages as you read.
*   **Auto-Clean Cache**: Keeps your storage clean with configurable cache limits (LRU-style cleanup).
*   **Offline Mode**: Access your downloaded chapters anytime with a dedicated offline UI.

---

## 🚀 Getting Started

### Installation
1. Go to the [**Releases Page**](https://github.com/ArisaAkiyama/yomic/releases).
2. Download and run the latest `Yomic_Setup_vX.X.X.exe`.
3. Follow the installation wizard and launch the app.

### Setting Up Extensions
*   **Automatic (Recommended)**: Go to **Extensions** > **Available** tab > Click **Download** on your preferred sources (e.g., MangaDex, KomikCast, Kiryuu).
*   **Manual**: Go to **Extensions** > click **Add** in the top-right corner > Select a custom `.js` or `.dll` extension file.

---

## 🛠️ Building from Source

**Requirements:**
*   .NET 10.0 SDK
*   Visual Studio 2022 (v17.12+) or VS Code

```bash
# Clone the repository
git clone https://github.com/ArisaAkiyama/yomic.git
cd yomic

# Build the app
dotnet build Yomic.sln
