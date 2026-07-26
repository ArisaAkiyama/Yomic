<div align="center">

<img src="./Yomic/Assets/app.ico" alt="Yomic logo" title="Yomic logo" width="128"/>

# Yomic
### The Ultimate Desktop Manga Reader

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![Platform](https://img.shields.io/badge/Platform-Windows-blue.svg)](https://github.com/ArisaAkiyama/yomic)
[![.NET](https://img.shields.io/badge/.NET-10.0-purple.svg)](https://dotnet.microsoft.com/)
[![Avalonia](https://img.shields.io/badge/Avalonia-11.3.11-orange.svg)](https://avaloniaui.net/)
[![Extensions](https://img.shields.io/badge/Extensions-Available-green.svg)](https://github.com/ArisaAkiyama/extension-yomic)

**Yomic** adalah aplikasi pembaca komik, manga, manhwa, dan manhua desktop modern untuk Windows yang cepat, ringan, bebas iklan, dan kaya akan fitur.

[**Unduh Rilis Terbaru (Download)**](https://github.com/ArisaAkiyama/yomic/releases)

</div>

---

## 📌 Apa Itu Yomic?

Yomic adalah aplikasi pembaca dan pengelola perpustakaan komik pribadi dalam satu antarmuka desktop yang bersih dan nyaman. Daripada harus membuka berbagai situs komik satu per satu di browser, Yomic menghubungkan berbagai sumber komik melalui fitur **Ekstensi**, memungkinkan Anda mencari, membaca, mengunduh, dan mengelola koleksi komik favorit Anda dari satu tempat secara praktis.

---

## ✨ Fitur Utama

### 📱 Antarmuka Modern & Perpustakaan Cerdas
- **Tampilan Grid & List Yang Rapi**: Jelajahi koleksi komik Anda dengan tampilan kartu sampul yang jernih, penanda bab belum dibaca (*Unread Dot*), dan efek visual modern.
- **Pengorganisasian Otomatis**: Otomatis menandai komik yang belum selesai dibaca dan memberikan indikator **"BARU"** jika ada bab komik rilis terbaru.
- **Kategori & Filter Cepat**: Kelompokkan komik ke dalam kategori kustom (misal: *Favorit*, *Komik Korea*, *Selesai Dibaca*) serta cari dan urutkan komik secara instan.
- **Ekspor & Impor Backup (.zip)**: Cadangkan seluruh data perpustakaan, riwayat, dan pengaturan Anda menjadi berkas `.zip` standar dan pulihkan kapan saja dengan 1-klik.

### 🔌 Sumber Komik Tanpa Batas (Engine Ekstensi)
- **Engine JavaScript Google Chrome V8 (`ClearScript V8`)**: Menjalankan plugin ekstensi JavaScript secepat browser Google Chrome native.
- **Dukungan Sumber Luas**:
  - **Indonesia**: KomikCast, Kiryuu, Komiku, WestManga, KomikStation, ManhwaIndo, Softkomik, Shinigami, Luvyaa, Maid, AstralScans, dan banyak lagi.
  - **Global / Inggris**: Mangabats, Weebcentral, NHentai, dll.
- **Manajer Ekstensi Praktis**: Unduh dan perbarui ekstensi sumber komik favorit Anda langsung di dalam aplikasi tanpa perlu pengaturan yang rumit.

### 📖 Pengalaman Membaca Terbaik
- **Mode Webtoon**: Perguliran vertikal kontinu yang halus (*continuous vertical scroll*) khusus untuk Manhwa/Webtoon, dilengkapi fitur *Auto-Scroll* dan pergerakan inertia yang alami.
- **Mode Halaman (Single & Dual Page)**: Mode membaca halaman demi halaman klasik (Kiri ke Kanan atau Kanan ke Kiri untuk Manga Jepang).
- **Memuat Bab Otomatis (*Smart Preloading*)**: Yomic secara otomatis mengunduh halaman bab berikutnya di background saat Anda mendekati akhir bab, sehingga bab berikutnya terbuka secara instan tanpa membuat Anda menunggu.
- **Fitur Pembesaran & Layar Penuh (*Zoom & Fit*)**: Menyesuaikan lebar/tinggi gambar secara otomatis, pembesaran fleksibel (*Custom Zoom*), rotasi layar, dan Mode Layar Penuh (*Fullscreen*).
- **Navigasi Kibor & Tetikus**: Kontrol membaca penuh menggunakan tombol panah keyboard, Space, Page Up/Down, maupun roda scroll mouse.

### 📅 Kalender Jadwal Perilisan (Upcoming Schedule)
- **Prediksi Rilis Otomatis**: Memprediksi jadwal perilisan bab komik mendatang (Hari Ini, Besok, Minggu Ini) berdasarkan analisis riwayat pembaruan bab secara akurat.

### ⚡ Performa Tinggi & Fitur Pintar (Engine .NET 10)
- **Ditenagai 12 Engine Performa Tinggi**:
  - **`SkiaSharp` & `Avalonia.Svg.Skia`**: Rendering gambar 2D dan ikon vektor SVG yang 100% tajam di layar resolusi tinggi (1080p, 2K, 4K).
  - **`WinHttpHandler` & `Polly`**: Engine HTTP/2 Multiplexing bawaan Windows OS yang mempercepat pengunduhan gambar serta fitur otomatis mencoba ulang saat sinyal terputus.
  - **`MemoryPack`**: Pemuatan data perpustakaan instan (0 milidetik).
  - **`BitFaster.Caching` & `XxHash64`**: Manajemen memori RAM yang efisien dan hemat penggunaan RAM PC.
- **Batas Cache Memori Otomatis**: Pilih batas ukuran cache gambar (Nonaktif, 250MB, 500MB, 1GB, 2GB) dan Yomic akan membersihkan data cache lama secara otomatis.
- **Pembaruan Otomatis (*Auto-Update*)**: Memeriksa dan memperbarui versi aplikasi Yomic secara otomatis saat aplikasi dibuka.
- **Pintas Jaringan & Anti-Blokir**: Dukungan DNS-Over-HTTPS (DoH), proxy, dan verifikasi Cloudflare bawaan.

---

## 🛠️ Instalasi

### Persyaratan Sistem
- **Windows 10** atau **Windows 11** (64-bit)
- **.NET Desktop Runtime 10.0** (installer akan memasangnya secara otomatis jika belum ada)

### Langkah Instalasi
1. Buka halaman [**Releases Page**](https://github.com/ArisaAkiyama/yomic/releases).
2. Unduh berkas installer `Setup.exe` terbaru.
3. Jalankan installer dan ikuti petunjuk di layar.
4. Buka **Yomic** dari Desktop atau Start Menu Anda.

---

## 🔌 Cara Memasang Ekstensi

### Pemasangan Otomatis (Direkomendasikan)
1. Buka aplikasi **Yomic** lalu pilih tab **Ekstensi**.
2. Pada bagian **Tersedia**, pilih sumber komik yang ingin Anda gunakan.
3. Klik tombol **Unduh** — ekstensi akan terpasang dan siap digunakan secara otomatis.
4. Buka tab **Jelajahi** dan mulai membaca komik favorit Anda!

---

## ⌨️ Pintasan Tombol Keyboard (Shortcuts)

| Tombol Keyboard | Aksi / Fungsi |
|---|---|
| `Panah Kanan` / `Page Down` | Halaman Selanjutnya / Scroll Down |
| `Panah Kiri` / `Page Up` | Halaman Sebelumnya / Scroll Up |
| `Spasi (Space)` | Scroll Down 1 Layar / Lanjut Halaman |
| `F` / `F11` | Masuk / Keluar Layar Penuh (*Fullscreen*) |
| `Esc` | Keluar Fullscreen / Kembali ke Detail Komik |
| `R` | Rotasi Gambar Halaman |
| `+` / `-` | Zoom In / Zoom Out |
| `Ctrl + B` | Bookmark Bab |

---

## 🏗️ Mengompilasi dari Kode Sumber (Build Source)

Persyaratan:
- **.NET 10.0 SDK**
- **Visual Studio 2022 (v17.12+)** atau **VS Code** dengan C# Dev Kit

```bash
# Clone repositori
git clone https://github.com/ArisaAkiyama/yomic.git
cd yomic

# Kompilasi Solusi
dotnet build Yomic.sln
```

---

## 📄 Penafian (Disclaimer)

Pengembang aplikasi ini tidak terafiliasi dengan penyedia konten manapun. Yomic adalah alat pembaca dan pengelola media independen. Seluruh konten komik diakses melalui plugin ekstensi yang terhubung ke situs pihak ketiga.

---

## 📜 Lisensi

Didistribusikan di bawah **MIT License**. Lihat berkas `LICENSE` untuk informasi lebih lanjut.
