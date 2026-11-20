package id.yomic.mobile.model

import androidx.compose.runtime.Immutable

enum class AppLanguage(val code: String) { ID("id"), EN("en") }

enum class ReaderMode { WEBTOON, SINGLE, DUAL }
enum class ReadingDirection { LTR, RTL }
enum class ReaderFitMode { FIT_WIDTH, FIT_HEIGHT, ORIGINAL }

enum class LibraryFilterMode { ALL, UNREAD, READING, COMPLETED, DOWNLOADED }
enum class LibrarySortBy { LAST_READ, UNREAD, UPDATED, TITLE_ASC, TITLE_DESC }
enum class ChapterFilterMode { ALL, UNREAD, BOOKMARKED }

enum class MangaStatus { ONGOING, COMPLETED, HIATUS }
enum class MangaType { MANHWA, MANGA, MANHUA }
enum class SourceLang { ALL, ID, EN }
enum class ServerStatus { ONLINE, WARNING, OFFLINE, CHECKING }
enum class DownloadStatus { DOWNLOADING, QUEUED, COMPLETED, PAUSED }
enum class SourceFeedSort { POPULAR, LATEST }

@Immutable
data class CategoryItem(
    val id: Int,
    val name: String,
    val sortOrder: Int = 0
)

@Immutable
data class ChapterItem(
    val id: String,
    val number: Double,
    val title: String,
    val releaseDate: String,
    val isRead: Boolean = false,
    val isBookmarked: Boolean = false,
    val isDownloaded: Boolean = false,
    val totalPages: Int = 12,
    val lastPageRead: Int = 1,
    val scanlator: String = ""
) {
    val formattedNumber: String
        get() = if (number % 1.0 == 0.0) number.toInt().toString() else number.toString()
}

@Immutable
data class MangaItem(
    val id: String,
    val title: String,
    val altTitle: String = "",
    val author: String,
    val artist: String,
    val status: MangaStatus,
    val type: MangaType,
    val sourceId: String,
    val sourceName: String,
    val lang: SourceLang,
    val rating: Double,
    val lastReadChapter: Double = 1.0,
    val lastReadPage: Int = 1,
    val lastReadTotalPages: Int = 12,
    val lastReadTimeAgo: String = "",
    val lastViewedEpoch: Long = 0L,
    val lastUpdateEpoch: Long = 0L,
    val inLibrary: Boolean = false,
    val isFavorite: Boolean = false,
    val isExplicit: Boolean = false,
    val categoryIds: List<Int> = emptyList(),
    val malTracked: Boolean = false,
    val malId: Int = 0,
    val malTitle: String = "",
    val malStatus: String = "Reading",
    val malScore: Int = 0,
    val malChaptersRead: Int = 0,
    val synopsis: String,
    val genres: List<String>,
    val coverPalette: Triple<Long, Long, Long>,
    val chapters: List<ChapterItem>
) {
    val totalChapters: Int get() = chapters.size
    val unreadCount: Int get() = chapters.count { !it.isRead }
    val downloadedCount: Int get() = chapters.count { it.isDownloaded }
    val readCount: Int get() = chapters.count { it.isRead }
    val formattedLastReadChapter: String
        get() = if (lastReadChapter % 1.0 == 0.0) lastReadChapter.toInt().toString() else lastReadChapter.toString()
}

@Immutable
data class MalSearchResult(
    val id: Int,
    val title: String,
    val mediaType: String,
    val chapters: Int,
    val score: Double,
    val accentColorHex: Long
)

@Immutable
data class ActivityUpdateItem(
    val id: String,
    val mangaId: String,
    val mangaTitle: String,
    val chapterNumber: Double,
    val chapterTitle: String,
    val sourceName: String,
    val lang: SourceLang,
    val timeAgo: String,
    val dateFetchEpoch: Long,
    val isNew: Boolean,
    val extraChaptersCount: Int = 0
) {
    val formattedChapterNumber: String
        get() = if (chapterNumber % 1.0 == 0.0) chapterNumber.toInt().toString() else chapterNumber.toString()
}

@Immutable
data class ExtensionItem(
    val id: String,
    val name: String,
    val version: String,
    val lang: SourceLang,
    val baseUrl: String,
    val installed: Boolean,
    val hasUpdate: Boolean = false,
    val isCloudflareProtected: Boolean = false,
    val accentColorHex: Long,
    val isNsfw: Boolean = false,
    val status: ServerStatus = ServerStatus.ONLINE
) {
    val cleanDomain: String
        get() = baseUrl.removePrefix("https://").removePrefix("http://").trimEnd('/')
}

@Immutable
data class DownloadQueueItem(
    val id: String,
    val mangaId: String,
    val mangaTitle: String,
    val chapterLabel: String,
    val chapterNumber: Double,
    val sourceName: String,
    val progressPercent: Int,
    val speedText: String,
    val sizeText: String,
    val status: DownloadStatus
)

@Immutable
data class AnnouncementItem(
    val id: String,
    val title: String,
    val date: String,
    val content: String,
    val typeLabel: String = "Info",
    val isUnread: Boolean = false
)

@Immutable
data class GenreStatItem(
    val genre: String,
    val mangaCount: Int,
    val chaptersRead: Int
)

@Immutable
data class DailyActivityStatItem(
    val dateLabel: String,
    val fullDate: String,
    val chaptersRead: Int,
    val minutesRead: Int
)

@Immutable
data class ReadingStatistics(
    val totalLibraryManga: Int,
    val readingMangaCount: Int,
    val completedMangaCount: Int,
    val unreadMangaCount: Int,
    val totalChaptersRead: Int,
    val totalLibraryChapters: Int,
    val completionRatePercent: Float,
    val totalDownloadedChapters: Int,
    val currentStreakDays: Int,
    val longestStreakDays: Int,
    val totalReadingMinutes: Int,
    val activeDaysCount: Int,
    val topGenres: List<GenreStatItem>,
    val dailyActivity: List<DailyActivityStatItem>
)

@Immutable
data class AppSettingsState(
    val isDarkMode: Boolean = true,
    val pureBlackDarkMode: Boolean = false,
    val isIncognitoMode: Boolean = false,
    val appLanguage: AppLanguage = AppLanguage.ID,
    val defaultReaderMode: ReaderMode = ReaderMode.WEBTOON,
    val readingDirection: ReadingDirection = ReadingDirection.LTR,
    val readerFitMode: ReaderFitMode = ReaderFitMode.FIT_WIDTH,
    val keepScreenOn: Boolean = true,
    val volumeKeysNavigation: Boolean = false,
    val fullscreenReader: Boolean = true,
    val autoDarkReader: Boolean = true,
    val showUnreadBadges: Boolean = true,
    val gridColumns: Int = 3,
    val readerDimmerAlpha: Float = 0f,
    val showNsfw: Boolean = false,
    val blurExplicitCovers: Boolean = false,
    val checkExtensionUpdates: Boolean = true,
    val enableImageOptimization: Boolean = true,
    val enableImageSharpening: Boolean = false,
    val enableAutoCropBorders: Boolean = false,
    val maxImageDimension: Int = 2160,
    val preloadNextChapter: Boolean = true,
    val downloadOnlyOnWifi: Boolean = true,
    val saveDownloadsAsCbz: Boolean = false,
    val autoDeleteAfterRead: Boolean = false,
    val autoDownloadNextChapter: Boolean = false,
    val skipFilteredChapters: Boolean = false,
    val maxReaderCacheSize: String = "500 MB",
    val autoSyncStartup: Boolean = false,
    val smartUpdate: Boolean = true,
    val backgroundUpdateInterval: String = "12h",
    val isOfflineMode: Boolean = false,
    val dohProvider: String = "Cloudflare (1.1.1.1)",
    val sourceStatusInterval: String = "30m",
    val customUserAgent: String = "Mozilla/5.0 (Android 15; Mobile) Yomic/2.1",
    val appLockEnabled: Boolean = false,
    val secureScreenEnabled: Boolean = false,
    val isMalConnected: Boolean = true,
    val malConnectedUser: String = "ArisaReader",
    val autoSyncTracker: Boolean = true,
    val mangaDexLanguage: SourceLang = SourceLang.EN,
    val cacheSizeText: String = "48.2 MB",
    val lastBackupText: String = "Siap dicadangkan (.yomicbackup)"
)

@Immutable
data class SyncProgressState(
    val active: Boolean = false,
    val current: Int = 0,
    val total: Int = 0
)

@Immutable
data class ReaderSessionState(
    val mangaId: String,
    val chapterNumber: Double,
    val currentPage: Int = 1,
    val totalPages: Int = 12,
    val mode: ReaderMode = ReaderMode.WEBTOON,
    val direction: ReadingDirection = ReadingDirection.LTR,
    val fitMode: ReaderFitMode = ReaderFitMode.FIT_WIDTH,
    val zoomPercent: Int = 100,
    val autoScrollActive: Boolean = false
)

@Immutable
data class YomicUiState(
    val mangaList: List<MangaItem> = emptyList(),
    val categories: List<CategoryItem> = emptyList(),
    val activityUpdates: List<ActivityUpdateItem> = emptyList(),
    val extensions: List<ExtensionItem> = emptyList(),
    val downloads: List<DownloadQueueItem> = emptyList(),
    val announcements: List<AnnouncementItem> = emptyList(),
    val settings: AppSettingsState = AppSettingsState(),
    val baseDailyActivity: List<DailyActivityStatItem> = emptyList(),

    // Library Filters & View State
    val librarySearchQuery: String = "",
    val libraryCategoryFilterId: Int? = null, // null = All
    val libraryFilterMode: LibraryFilterMode = LibraryFilterMode.ALL,
    val librarySourceFilterId: String? = null,
    val librarySortBy: LibrarySortBy = LibrarySortBy.LAST_READ,
    val libraryIsGridMode: Boolean = true,
    val syncProgress: SyncProgressState = SyncProgressState(),

    // History State
    val historySearchQuery: String = "",
    val historyIsGridMode: Boolean = false,
    val removedHistoryIds: Set<String> = emptySet(),

    // Browse & Extensions State
    val browseSearchQuery: String = "",
    val browseLangFilter: SourceLang = SourceLang.ALL,
    val pinnedSourceIds: Set<String> = emptySet(),
    val extSearchQuery: String = "",
    val extLangFilter: SourceLang = SourceLang.ALL,
    val installingExtensions: Map<String, Int> = emptyMap(),
    val isRefreshingRepo: Boolean = false,

    // Source Catalog Feed State
    val catalogSearchQuery: String = "",
    val catalogSort: SourceFeedSort = SourceFeedSort.POPULAR,
    val catalogStatusFilter: MangaStatus? = null,
    val catalogTypeFilter: MangaType? = null,
    val catalogGenreFilter: String? = null,

    // Detail View State
    val detailChapterFilter: ChapterFilterMode = ChapterFilterMode.ALL,
    val detailChapterAsc: Boolean = false,

    // Announcements State
    val isRefreshingAnnouncements: Boolean = false,

    // Snackbar Message Queue
    val snackbarMessage: String? = null
)
