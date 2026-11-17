/* =========================================================================
 * YOMIC V2 — APPLICATION DEFAULTS & DYNAMIC ARTWORK GENERATORS
 * ========================================================================= */

import {
  ActivityUpdateItem,
  AppSettingsState,
  ChapterItem,
  DownloadQueueItem,
  ExtensionItem,
  HotkeyDefinition,
  MangaItem
} from './types.js';

export function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Generates an elegant, dynamic SVG placeholder cover card for manga without cover art.
 * Adapts to the manga's palette and title initials with clean modern typography.
 */
export function buildMangaCoverSvg(manga: MangaItem): string {
  const [c1, c2, c3] = manga.coverPalette && manga.coverPalette.length >= 3
    ? manga.coverPalette
    : ['#071426', '#0066CC', '#38BDF8'];

  const safeTitle = escapeXml(manga.title || 'Komik');
  const safeSource = escapeXml(manga.sourceName || 'Yomic');

  const initials = manga.title
    ? manga.title
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map((w) => w[0])
        .join('')
        .toUpperCase()
    : 'Y';

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 600" width="100%" height="100%">
      <defs>
        <linearGradient id="coverBgGrad" x1="0" y1="0" x2="0.8" y2="1">
          <stop offset="0%" stop-color="${c2}" stop-opacity="0.85"/>
          <stop offset="45%" stop-color="${c1}"/>
          <stop offset="100%" stop-color="#050B14"/>
        </linearGradient>
        <radialGradient id="coverGlow" cx="50%" cy="35%" r="60%">
          <stop offset="0%" stop-color="${c3}" stop-opacity="0.3"/>
          <stop offset="100%" stop-color="${c3}" stop-opacity="0"/>
        </radialGradient>
      </defs>
      <rect x="0" y="0" width="400" height="600" fill="url(#coverBgGrad)"/>
      <rect x="0" y="0" width="400" height="600" fill="url(#coverGlow)"/>
      
      <!-- Subtle decorative geometry -->
      <circle cx="200" cy="220" r="110" fill="none" stroke="${c3}" stroke-width="1.5" stroke-opacity="0.2" stroke-dasharray="6 6"/>
      <circle cx="200" cy="220" r="85" fill="${c1}" fill-opacity="0.6" stroke="${c3}" stroke-width="1" stroke-opacity="0.4"/>
      
      <!-- Initials Icon Badge -->
      <text x="200" y="235" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="44" font-weight="700" fill="#FFFFFF" text-anchor="middle" letter-spacing="2">${escapeXml(initials)}</text>
      
      <!-- Bottom Title Card -->
      <rect x="24" y="440" width="352" height="136" rx="14" fill="#07111E" fill-opacity="0.85" stroke="${c3}" stroke-width="1" stroke-opacity="0.2"/>
      <text x="44" y="495" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="20" font-weight="600" fill="#F8FAFC">
        ${safeTitle.length > 24 ? safeTitle.slice(0, 22) + '...' : safeTitle}
      </text>
      <text x="44" y="530" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="13" font-weight="500" fill="${c3}">
        ${safeSource}
      </text>
    </svg>
  `.trim();

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

/**
 * Generates a clean placeholder page when a reader image cannot be loaded.
 */
export function buildComicPageSvg(
  mangaTitle: string,
  chapterNum: number,
  pageIndex: number,
  totalPages: number
): string {
  const safeTitle = escapeXml(mangaTitle);
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 1200" width="100%" height="100%">
      <rect width="800" height="1200" fill="#0A0F1D"/>
      <rect x="40" y="40" width="720" height="1120" rx="16" fill="#131B2E" stroke="#1E293B" stroke-width="2"/>
      <circle cx="400" cy="540" r="48" fill="#1E293B"/>
      <path d="M384 524 L416 524 M400 508 L400 540" stroke="#38BDF8" stroke-width="3" stroke-linecap="round"/>
      <text x="400" y="630" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="22" font-weight="600" fill="#F8FAFC" text-anchor="middle">
        ${safeTitle}
      </text>
      <text x="400" y="665" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="16" fill="#94A3B8" text-anchor="middle">
        Bab ${chapterNum} • Halaman ${pageIndex} / ${totalPages}
      </text>
    </svg>
  `.trim();

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export const DEFAULT_APP_SETTINGS: AppSettingsState = {
  compactSidebar: false,
  isDarkMode: false,
  defaultReaderMode: 'webtoon',
  readingDirection: 'ltr',
  readerFitMode: 'fit-width',
  autoDarkReader: true,
  showNsfw: false,
  blurExplicitCovers: false,
  dohProvider: 'Cloudflare (1.1.1.1)',
  downloadsFolder: 'C:\\Users\\Default\\Downloads\\Yomic',
  dbSizeText: '0.0 MB',
  lastBackupText: 'Siap dicadangkan (.yomicbackup)',
  isMalConnected: false,
  malConnectedUser: '',
  autoSyncTracker: true,
  preloadNextChapter: true,
  autoDownloadNextChapter: false,
  skipFilteredChapters: false,
  maxReaderCacheSize: '500MB',
  showUnreadBadges: true,
  autoSyncStartup: false,
  smartUpdate: true,
  backgroundUpdateInterval: '12h',
  isOfflineMode: false,
  sourceStatusInterval: '30m',
  dbStatsMangaCount: 0,
  dbStatsChapterCount: 0,
  dbStatsHistoryCount: 0,
  customHotkeys: {},
  enableImageOptimization: true,
  enableAutoCropBorders: false,
  maxImageDimension: 2160,
  enableImageSharpening: false,
  appLanguage: 'id',
  mangaDexLanguage: 'en'
};

export const HOTKEY_DEFINITIONS: HotkeyDefinition[] = [
  // 1. Pembaca Komik (Reader)
  { id: 'readerNextPage', label: 'Halaman / Bab Berikutnya', description: 'Pindah ke halaman komik berikutnya atau bab selanjutnya pada mode Webtoon', category: 'reader', defaultKey: 'ArrowRight' },
  { id: 'readerPrevPage', label: 'Halaman / Bab Sebelumnya', description: 'Pindah ke halaman komik sebelumnya atau bab sebelumnya pada mode Webtoon', category: 'reader', defaultKey: 'ArrowLeft' },
  { id: 'readerNextChapter', label: 'Bab Berikutnya', description: 'Langsung melompat ke bab berikutnya', category: 'reader', defaultKey: ']' },
  { id: 'readerPrevChapter', label: 'Bab Sebelumnya', description: 'Langsung melompat ke bab sebelumnya', category: 'reader', defaultKey: '[' },
  { id: 'readerToggleHud', label: 'Tampilkan / Sembunyikan Menu HUD', description: 'Alihkan visibilitas bilah atas dan bawah saat membaca', category: 'reader', defaultKey: 'h' },
  { id: 'readerClose', label: 'Tutup Pembaca', description: 'Keluar dari mode membaca kembali ke tampilan sebelumnya', category: 'reader', defaultKey: 'Escape' },
  { id: 'readerModeWebtoon', label: 'Ubah ke Mode Webtoon', description: 'Ganti tata letak ke gulir vertikal tak terbatas', category: 'reader', defaultKey: '1' },
  { id: 'readerModeSingle', label: 'Ubah ke Mode Halaman Tunggal', description: 'Ganti tata letak ke tampilan satu halaman per layar', category: 'reader', defaultKey: '2' },
  { id: 'readerModeDual', label: 'Ubah ke Mode Dua Halaman', description: 'Ganti tata letak ke tampilan dua halaman menyanding', category: 'reader', defaultKey: '3' },
  { id: 'readerZoomIn', label: 'Perbesar Tampilan (Zoom In)', description: 'Tingkatkan skala halaman komik sebesar 10%', category: 'reader', defaultKey: '+' },
  { id: 'readerZoomOut', label: 'Perkecil Tampilan (Zoom Out)', description: 'Kurangi skala halaman komik sebesar 10%', category: 'reader', defaultKey: '-' },
  { id: 'readerResetZoom', label: 'Atur Ulang Zoom (100%)', description: 'Kembalikan ukuran skala tampilan gambar ke 100%', category: 'reader', defaultKey: '0' },
  { id: 'readerToggleAutoScroll', label: 'Mulai / Berhenti Gulir Otomatis', description: 'Nyalakan atau matikan gulir halaman otomatis Webtoon', category: 'reader', defaultKey: 's' },
  { id: 'readerToggleFullscreen', label: 'Layar Penuh Pembaca', description: 'Alihkan mode layar penuh (fullscreen) saat membaca', category: 'reader', defaultKey: 'f' },

  // 2. Navigasi Global
  { id: 'globalSearch', label: 'Fokus Kolom Pencarian', description: 'Buka dan fokuskan kursor ke kolom pencarian aktif', category: 'global', defaultKey: 'Ctrl+k' },
  { id: 'globalToggleSidebar', label: 'Buka / Tutup Sidebar', description: 'Ciutkan atau rentangkan bilah navigasi samping', category: 'global', defaultKey: 'Ctrl+b' },
  { id: 'globalToggleFullscreen', label: 'Layar Penuh Aplikasi', description: 'Alihkan mode jendela layar penuh untuk seluruh aplikasi', category: 'global', defaultKey: 'F11' },
  { id: 'navLibrary', label: 'Buka Tab Pustaka', description: 'Pindah ke tampilan koleksi komik di Pustaka', category: 'global', defaultKey: 'Alt+1' },
  { id: 'navUpdates', label: 'Buka Tab Pembaruan', description: 'Pindah ke tampilan riwayat pembaruan bab terbaru', category: 'global', defaultKey: 'Alt+2' },
  { id: 'navHistory', label: 'Buka Tab Riwayat', description: 'Pindah ke tampilan riwayat komik yang terakhir dibaca', category: 'global', defaultKey: 'Alt+3' },
  { id: 'navDownloads', label: 'Buka Tab Unduhan', description: 'Pindah ke antrean dan status unduhan offline', category: 'global', defaultKey: 'Alt+4' },
  { id: 'navBrowse', label: 'Buka Tab Jelajahi Sumber', description: 'Pindah ke katalog sumber ekstensi online', category: 'global', defaultKey: 'Alt+5' },
  { id: 'navExtensions', label: 'Buka Tab Ekstensi', description: 'Pindah ke manajemen repositori dan ekstensi komik', category: 'global', defaultKey: 'Alt+6' },
  { id: 'navSettings', label: 'Buka Tab Pengaturan', description: 'Buka halaman preferensi dan konfigurasi aplikasi', category: 'global', defaultKey: 'Alt+7' },
];

export const DEFAULT_HOTKEYS: Record<string, string> = Object.fromEntries(
  HOTKEY_DEFINITIONS.map((d) => [d.id, d.defaultKey])
);

// Clean initial empty datasets (populated strictly via C# backend bootstrap / database)
export const INITIAL_MANGA_LIST: MangaItem[] = [];
export const INITIAL_ACTIVITY_UPDATES: ActivityUpdateItem[] = [];
export const INITIAL_EXTENSIONS: ExtensionItem[] = [];
export const INITIAL_DOWNLOAD_QUEUE: DownloadQueueItem[] = [];
