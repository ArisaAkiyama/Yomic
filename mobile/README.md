# Yomic Mobile (Android Native)

Aplikasi **Android Native ringan** berbasis **Kotlin + Jetpack Compose + Material 3** (`id.yomic.mobile`) yang me-mirror seluruh UI/UX **Yomic v2 Desktop** dengan pola navigasi **5-Tab ala Mihon/Tachiyomi** serta identitas visual khas Yomic (**Oceanic Light**, **Antigravity Carbon Dark**, **Deep-Ocean Reader Dark**, dan bilingual **ID / EN**).

---

## Fitur UI yang Tersedia

- **5-Tab Bottom Navigation Bar**:
  1. **Pustaka**: Tab kategori horizontal, 3-kolom Grid / List toggle, pencarian instan, *BottomSheet* 4-tab (`Kategori | Saring | Sumber | Urutkan`), manajemen kategori kustom, *long-press action sheet*, dan animasi progres sinkronisasi.
  2. **Pembaruan**: Dikelompokkan berdasarkan `Hari Ini`, `Kemarin`, `Sebelumnya`, plus tombol baca cepat.
  3. **Riwayat**: Timeline baca kronologis, pencarian, mode Grid/List, dan tombol lanjutkan baca.
  4. **Jelajahi (Hub 2-Tab)**:
     - **Sumber**: Daftar sumber terpasang (`Komiku`, `Kiryuu`, `MangaDex`, `Softkomik`, `WestManga`, `Mangabat`), indikator status server, filter bahasa (`ID`/`EN`), serta halaman **Katalog Sumber** lengkap (termasuk switcher `ID / EN` khusus MangaDex dan filter Status/Tipe/Genre).
     - **Ekstensi**: Seksi `Terpasang` & `Tersedia`, animasi progres pemasangan `0% → 100%`, perbarui, dan hapus.
  5. **Lainnya**: Header identitas Yomic (`よ`), sakelar cepat **Mode Gelap** & **Mode Offline**, serta akses ke **Antrean Unduhan**, **Statistik Membaca (grafik 14 hari & genre)**, **Kelola Kategori**, **Pengumuman**, **Kirim Masukan**, **Panduan Pemula (3 slide)**, dan **Pengaturan** lengkap.
- **Detail Komik**: Header *ambient gradient*, genre chips, sinopsis *expandable*, tombol aksi cepat, *sticky Extended FAB*, filter & urutan chapter, unduhan per bab, dan **MyAnimeList Tracker BottomSheet**.
- **Pembaca Layar Penuh (`#0A0A0A`)**: 3 mode baca (**Webtoon**, **Halaman Tunggal**, **Dua Halaman**), arah `LTR`/`RTL`, gestur **Tap 3-Zona** (kiri/tengah/kanan), **Double-Tap & Pinch-to-Zoom**, **Auto-Scroll**, pemilih chapter, dan pengaturan pemrosesan gambar.

---

## Cara Build & Run TANPA Android Studio (Ringan!)

### Opsi 1 — Lokal CLI-Only (~500 MB vs 5+ GB Android Studio)

1. **Setup sekali saja** (menginstal OpenJDK 17 + Android CLI + SDK API 35 minimal + opsional `scrcpy`):
   ```powershell
   .\mobile\scripts\setup-android-cli.ps1 -WithScrcpy
   ```
2. **Aktifkan USB Debugging** (atau **Wireless Debugging**) di HP Android kamu, lalu colokkan kabel USB (atau `adb connect <IP>:<PORT>`).
3. **Build, Install & Jalankan langsung di HP**:
   ```powershell
   # Debug APK + mirror layar HP di PC dengan scrcpy
   .\mobile\scripts\build-and-run.ps1 -Scrcpy

   # Atau build Release APK super ringan (R8 Minified)
   .\mobile\scripts\build-and-run.ps1 -Release
   ```
4. *(Opsional)* Kamu juga bisa membuka panel **Android Device Hub** atau **Android Compose Preview** langsung di Antigravity!

### Opsi 2 — Zero Install di PC via GitHub Actions

Repository ini sudah menyertakan workflow [`.github/workflows/android-mobile-build.yml`](../.github/workflows/android-mobile-build.yml). Setiap kali ada push ke folder `mobile/` (atau dijalankan manual dari tab **Actions → Yomic Mobile Android APK**), GitHub akan otomatis meng-compile dan menyediakan artifact **`Yomic-Mobile-debug.apk`** untuk langsung diunduh ke HP Android.
