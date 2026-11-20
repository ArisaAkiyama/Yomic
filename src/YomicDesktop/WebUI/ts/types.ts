/* =========================================================================
 * YOMIC V2 — STRICT TYPESCRIPT INTERFACES & IPC CONTRACTS
 * ========================================================================= */

export type NavTabId =
  | 'library'
  | 'updates'
  | 'history'
  | 'downloads'
  | 'browse'
  | 'extensions'
  | 'settings';
export type SettingsSubTab = 'appearance' | 'reader' | 'network' | 'backup' | 'about';
export type LibraryCategory = 'all' | 'reading' | 'manhwa' | 'favorite' | 'completed';
export type LibraryFilterMode = 'all' | 'unread' | 'reading' | 'completed' | 'downloaded';
export type LibrarySortBy = 'lastRead' | 'unread' | 'updated' | 'titleAsc' | 'titleDesc';
export type ReaderMode = 'webtoon' | 'single' | 'dual';

export interface CategoryItem {
  id: number;
  name: string;
  color?: string;
  sortOrder?: number;
  isDefault?: boolean;
  updateExcluded?: boolean;
}

export interface ChapterItem {
  id: string | number;
  dbId?: number;
  number: number;
  title: string;
  url?: string;
  releaseDate: string;
  dateUpload?: number;
  isRead: boolean;
  isBookmarked: boolean;
  isDownloaded: boolean;
  lastPageRead?: number;
  scrollPercent?: number;
  scanlator: string;
}

export interface MangaItem {
  id: string;
  dbId?: number;
  url?: string;
  title: string;
  altTitle: string;
  author: string;
  artist: string;
  status: 'Ongoing' | 'Completed' | 'Hiatus';
  type: 'Manhwa' | 'Manga' | 'Manhua';
  sourceId: string | number;
  sourceName: string;
  lang: 'ID' | 'EN';
  rating: number;
  unreadCount: number;
  downloadedCount: number;
  totalChapters: number;
  lastReadChapter: number;
  lastReadChapterUrl?: string;
  lastReadPage: number;
  lastReadTotalPages: number;
  lastReadTimeAgo: string;
  lastViewedEpoch?: number;
  lastUpdateEpoch?: number;
  inLibrary: boolean;
  isFavorite: boolean;
  categoryIds?: number[];
  malTracked: boolean;
  malId?: number;
  malTitle?: string;
  malStatus?: string;
  malScore?: number;
  synopsis: string;
  genres: string[];
  coverPalette: [string, string, string];
  coverAccentLabel: string;
  coverUrl?: string;
  rawCoverUrl?: string;
  chapters: ChapterItem[];
}

export interface ActivityUpdateItem {
  id: string;
  mangaId: string;
  mangaTitle: string;
  chapterNumber: number;
  chapterTitle: string;
  chapterUrl?: string;
  sourceName: string;
  lang: 'ID' | 'EN';
  timeAgo: string;
  dateFetch?: number;
  isNew: boolean;
  extraChaptersCount?: number;
  coverUrl?: string;
  firstUnreadChapterNumber?: number;
  firstUnreadChapterTitle?: string;
  firstUnreadChapterUrl?: string;
}

export interface ExtensionItem {
  id: string;
  pkg?: string;
  sourceId?: number;
  name: string;
  version: string;
  lang: 'ID' | 'EN' | 'ALL';
  baseUrl: string;
  installed: boolean;
  hasUpdate: boolean;
  isCloudflareProtected: boolean;
  accentColor: string;
  iconUrl?: string;
  fileSizeText?: string;
  isNsfw?: boolean;
  status?: 'online' | 'warning' | 'offline' | 'checking';
  supportsStatusFilter?: boolean;
  supportsGenreFilter?: boolean;
  availableGenres?: string[];
  supportsFormatFilter?: boolean;
  availableFormats?: string[];
}

export interface DownloadQueueItem {
  id: string;
  mangaId: string;
  mangaTitle: string;
  chapterLabel: string;
  chapterNumber?: number;
  chapterUrl?: string;
  coverUrl?: string;
  sourceName: string;
  progressPercent: number;
  speedText: string;
  sizeText: string;
  status: 'downloading' | 'queued' | 'completed' | 'paused';
}

export interface AnnouncementDto {
  id: string;
  title: string;
  body: string;
  date: string;
  type?: string;
  url?: string;
  hasUrl?: boolean;
  typeDisplay?: string;
  badgeBackground?: string;
}

export interface AnnouncementItem {
  id: string;
  title: string;
  date: string;
  content: string;
  type?: string;
  url?: string;
  hasUrl?: boolean;
  typeDisplay?: string;
  badgeBackground?: string;
}

export interface AppBootstrapPayload {
  mangaList: MangaItem[];
  activityUpdates: ActivityUpdateItem[];
  downloads: DownloadQueueItem[];
  extensions: ExtensionItem[];
  categories?: CategoryItem[];
  settings: Partial<AppSettingsState>;
  announcements?: AnnouncementDto[];
  hasUnreadAnnouncements?: boolean;
}

export interface SourceFeedResult {
  sourceId: number;
  page: number;
  totalPages: number;
  hasMore: boolean;
  hasNextPage?: boolean;
  items: MangaItem[];
}

export interface ReaderPagesResult {
  mangaId: string;
  chapterUrl: string;
  chapterNumber: number;
  chapterTitle: string;
  isOffline: boolean;
  lastPageRead: number;
  scrollPercent?: number;
  pages: string[];
  requiresVerification?: boolean;
}

export interface GenreStatItem {
  genre: string;
  mangaCount: number;
  chaptersRead: number;
  percentage: number;
}

export interface DailyActivityStatItem {
  dateLabel: string;
  fullDate: string;
  chaptersRead: number;
  minutesRead: number;
}

export interface ReadingStatisticsPayload {
  totalLibraryManga: number;
  readingMangaCount: number;
  completedMangaCount: number;
  unreadMangaCount: number;
  totalChaptersRead: number;
  totalLibraryChapters: number;
  completionRatePercent: number;
  totalDownloadedChapters: number;
  totalBookmarkedChapters: number;
  currentStreakDays: number;
  longestStreakDays: number;
  totalReadingMinutes: number;
  activeDaysCount: number;
  topGenres: GenreStatItem[];
  dailyActivity: DailyActivityStatItem[];
}

export type ReadingDirection = 'ltr' | 'rtl';
export type ReaderFitMode = 'fit-width' | 'fit-height' | 'original';
export type HotkeyActionCategory = 'reader' | 'global';
export type AppLanguage = 'id' | 'en';

export interface HotkeyDefinition {
  id: string;
  label: string;
  description: string;
  category: HotkeyActionCategory;
  defaultKey: string;
}

export interface AppSettingsState {
  compactSidebar: boolean;
  isDarkMode: boolean;
  autoDarkReader: boolean;
  showNsfw: boolean;
  blurExplicitCovers: boolean;
  showUnreadBadges: boolean;
  defaultReaderMode: ReaderMode;
  readingDirection: ReadingDirection;
  readerFitMode: ReaderFitMode;
  downloadsFolder: string;
  isMalConnected: boolean;
  malConnectedUser: string;
  autoSyncTracker: boolean;
  dbSizeText: string;
  dohProvider: string;
  lastBackupText: string;

  // Fitur Asli Yomic ver 1
  preloadNextChapter: boolean;
  autoDownloadNextChapter: boolean;
  skipFilteredChapters: boolean;
  saveDownloadsAsCbz: boolean;
  autoDeleteAfterRead: boolean;
  maxReaderCacheSize: '250MB' | '500MB' | '1GB' | '2GB';
  autoSyncStartup: boolean;
  smartUpdate: boolean;
  backgroundUpdateInterval: 'off' | '6h' | '12h' | '24h';
  isOfflineMode: boolean;
  sourceStatusInterval: '15m' | '30m' | '1h' | 'off';
  dbStatsMangaCount: number;
  dbStatsChapterCount: number;
  dbStatsHistoryCount: number;
  customHotkeys?: Record<string, string>;

  // Mesin Pemrosesan Gambar SkiaSharp
  enableImageOptimization: boolean;
  enableAutoCropBorders: boolean;
  maxImageDimension: number;
  enableImageSharpening: boolean;
  appLanguage: AppLanguage;
  mangaDexLanguage: 'id' | 'en';
}

/* C# <-> WebView2 IPC Message Contracts */
export type OutgoingWebMessage =
  | { type: 'ui:theme-changed'; mode: 'ocean-light' | 'antigravity-dark' | 'reader-dark'; subtitle?: string }
  | { type: 'ui:toggle-fullscreen'; value?: boolean }
  | { type: 'ui:open-external'; url: string }
  | { type: 'ui:open-folder'; path?: string }
  | { type: string; requestId?: string; payload?: unknown };

export interface IncomingHostMessage {
  type: string;
  isFullscreen?: boolean;
  requestId?: string;
  ok?: boolean;
  error?: string;
  payload?: any;
}

export interface ConfirmModalOptions {
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  isDanger?: boolean;
  icon?: string;
  confirmIcon?: string;
}

export interface MalSearchResult {
  id: number;
  title: string;
  coverUrl?: string;
}

declare global {
  interface Window {
    chrome?: {
      webview?: {
        postMessage: (message: string) => void;
        addEventListener?: (type: 'message', listener: (event: { data: any }) => void) => void;
      };
    };
    __yomicHostReceiver?: (payload: IncomingHostMessage) => void;
  }
}
