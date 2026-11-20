package id.yomic.mobile.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import id.yomic.mobile.data.DemoDataRepository
import id.yomic.mobile.model.ActivityUpdateItem
import id.yomic.mobile.model.AppLanguage
import id.yomic.mobile.model.AppSettingsState
import id.yomic.mobile.model.CategoryItem
import id.yomic.mobile.model.ChapterFilterMode
import id.yomic.mobile.model.DownloadQueueItem
import id.yomic.mobile.model.DownloadStatus
import id.yomic.mobile.model.GenreStatItem
import id.yomic.mobile.model.LibraryFilterMode
import id.yomic.mobile.model.LibrarySortBy
import id.yomic.mobile.model.MangaItem
import id.yomic.mobile.model.MangaStatus
import id.yomic.mobile.model.MangaType
import id.yomic.mobile.model.ReaderFitMode
import id.yomic.mobile.model.ReaderMode
import id.yomic.mobile.model.ReadingDirection
import id.yomic.mobile.model.ReadingStatistics
import id.yomic.mobile.model.SourceFeedSort
import id.yomic.mobile.model.SourceLang
import id.yomic.mobile.model.SyncProgressState
import id.yomic.mobile.model.YomicUiState
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlin.math.abs
import kotlin.math.roundToInt

class YomicViewModel(autoStartTicker: Boolean) : ViewModel() {

    constructor() : this(autoStartTicker = true)

    private val _uiState = MutableStateFlow(createInitialState())
    val uiState: StateFlow<YomicUiState> = _uiState.asStateFlow()

    init {
        if (autoStartTicker) {
            startDownloadTicker()
        }
    }

    private fun createInitialState(): YomicUiState = YomicUiState(
        mangaList = DemoDataRepository.createMangaList(),
        categories = DemoDataRepository.createCategories(),
        activityUpdates = DemoDataRepository.createInitialUpdates(),
        extensions = DemoDataRepository.createExtensions(),
        downloads = DemoDataRepository.createInitialDownloads(),
        announcements = DemoDataRepository.createAnnouncements(),
        baseDailyActivity = DemoDataRepository.createBaseDailyActivity()
    )

    private fun isEn(): Boolean = _uiState.value.settings.appLanguage == AppLanguage.EN
    private fun l(idText: String, enText: String): String = if (isEn()) enText else idText

    fun showMessage(message: String) {
        _uiState.update { it.copy(snackbarMessage = message) }
    }

    fun clearMessage() {
        _uiState.update { it.copy(snackbarMessage = null) }
    }

    // =====================================================================
    // LIBRARY CONTROLS
    // =====================================================================

    fun setLibrarySearch(query: String) {
        _uiState.update { it.copy(librarySearchQuery = query) }
    }

    fun setLibraryCategoryFilter(categoryId: Int?) {
        _uiState.update { it.copy(libraryCategoryFilterId = categoryId) }
    }

    fun setLibraryFilterMode(mode: LibraryFilterMode) {
        _uiState.update { it.copy(libraryFilterMode = mode) }
    }

    fun setLibrarySourceFilter(sourceId: String?) {
        _uiState.update { it.copy(librarySourceFilterId = sourceId) }
    }

    fun setLibrarySort(sort: LibrarySortBy) {
        _uiState.update { it.copy(librarySortBy = sort) }
    }

    fun toggleLibraryViewMode() {
        _uiState.update { it.copy(libraryIsGridMode = !it.libraryIsGridMode) }
    }

    fun resetLibraryFilters() {
        _uiState.update {
            it.copy(
                librarySearchQuery = "",
                libraryCategoryFilterId = null,
                libraryFilterMode = LibraryFilterMode.ALL,
                librarySourceFilterId = null,
                librarySortBy = LibrarySortBy.LAST_READ
            )
        }
    }

    fun addCategory(rawName: String) {
        val name = rawName.trim()
        if (name.isEmpty()) return
        val existing = _uiState.value.categories
        if (existing.any { it.name.equals(name, ignoreCase = true) }) {
            showMessage(l("Kategori \"$name\" sudah ada.", "Category \"$name\" already exists."))
            return
        }
        val nextId = (existing.maxOfOrNull { it.id } ?: 0) + 1
        _uiState.update {
            it.copy(
                categories = it.categories + CategoryItem(id = nextId, name = name, sortOrder = nextId),
                snackbarMessage = l("Kategori \"$name\" ditambahkan.", "Category \"$name\" added.")
            )
        }
    }

    fun deleteCategory(categoryId: Int) {
        val target = _uiState.value.categories.find { it.id == categoryId } ?: return
        _uiState.update { state ->
            state.copy(
                categories = state.categories.filterNot { it.id == categoryId },
                libraryCategoryFilterId = if (state.libraryCategoryFilterId == categoryId) null else state.libraryCategoryFilterId,
                mangaList = state.mangaList.map { m ->
                    m.copy(categoryIds = m.categoryIds.filterNot { it == categoryId })
                },
                snackbarMessage = l("Kategori \"${target.name}\" dihapus.", "Category \"${target.name}\" removed.")
            )
        }
    }

    fun toggleMangaCategory(mangaId: String, categoryId: Int) {
        _uiState.update { state ->
            state.copy(
                mangaList = state.mangaList.map { m ->
                    if (m.id != mangaId) m else {
                        val next = if (categoryId in m.categoryIds) {
                            m.categoryIds - categoryId
                        } else {
                            m.categoryIds + categoryId
                        }
                        m.copy(categoryIds = next)
                    }
                }
            )
        }
    }

    fun triggerLibrarySync() {
        if (_uiState.value.syncProgress.active) return
        val libraryCount = _uiState.value.mangaList.count { it.inLibrary }.coerceAtLeast(1)
        viewModelScope.launch {
            _uiState.update { it.copy(syncProgress = SyncProgressState(active = true, current = 0, total = libraryCount)) }
            for (step in 1..libraryCount) {
                delay(240L)
                _uiState.update { it.copy(syncProgress = SyncProgressState(active = true, current = step, total = libraryCount)) }
            }
            delay(180L)
            _uiState.update {
                it.copy(
                    syncProgress = SyncProgressState(active = false, current = 0, total = 0),
                    snackbarMessage = l("Pustaka selesai diperbarui.", "Library sync completed.")
                )
            }
        }
    }

    // =====================================================================
    // UPDATES & HISTORY
    // =====================================================================

    fun clearAllUpdates() {
        _uiState.update {
            it.copy(
                activityUpdates = emptyList(),
                snackbarMessage = l("Daftar pembaruan dibersihkan.", "Updates list cleared.")
            )
        }
    }

    fun setHistorySearch(query: String) {
        _uiState.update { it.copy(historySearchQuery = query) }
    }

    fun toggleHistoryViewMode() {
        _uiState.update { it.copy(historyIsGridMode = !it.historyIsGridMode) }
    }

    fun removeHistoryItem(mangaId: String) {
        _uiState.update {
            it.copy(
                removedHistoryIds = it.removedHistoryIds + mangaId,
                snackbarMessage = l("Dihapus dari riwayat.", "Removed from history.")
            )
        }
    }

    fun restoreHistoryItem(mangaId: String) {
        _uiState.update {
            it.copy(
                removedHistoryIds = it.removedHistoryIds - mangaId,
                snackbarMessage = l("Riwayat dipulihkan.", "History entry restored.")
            )
        }
    }

    fun clearAllHistory() {
        _uiState.update { state ->
            state.copy(
                removedHistoryIds = state.mangaList.map { it.id }.toSet(),
                snackbarMessage = l("Seluruh riwayat membaca dibersihkan.", "All reading history cleared.")
            )
        }
    }

    // =====================================================================
    // BROWSE, EXTENSIONS & CATALOG FEED
    // =====================================================================

    fun setBrowseSearch(query: String) {
        _uiState.update { it.copy(browseSearchQuery = query) }
    }

    fun setBrowseLangFilter(lang: SourceLang) {
        _uiState.update { it.copy(browseLangFilter = lang) }
    }

    fun togglePinSource(sourceId: String) {
        val ext = _uiState.value.extensions.find { it.id == sourceId }
        val wasPinned = sourceId in _uiState.value.pinnedSourceIds
        _uiState.update { state ->
            val next = if (wasPinned) state.pinnedSourceIds - sourceId else state.pinnedSourceIds + sourceId
            state.copy(
                pinnedSourceIds = next,
                snackbarMessage = ext?.let {
                    if (wasPinned) l("${it.name} dilepas dari sematan.", "${it.name} unpinned.")
                    else l("${it.name} disematkan ke atas.", "${it.name} pinned to top.")
                }
            )
        }
    }

    fun setExtSearch(query: String) {
        _uiState.update { it.copy(extSearchQuery = query) }
    }

    fun setExtLangFilter(lang: SourceLang) {
        _uiState.update { it.copy(extLangFilter = lang) }
    }

    fun refreshExtensionRepo() {
        if (_uiState.value.isRefreshingRepo) return
        viewModelScope.launch {
            _uiState.update { it.copy(isRefreshingRepo = true) }
            delay(900L)
            _uiState.update {
                it.copy(
                    isRefreshingRepo = false,
                    snackbarMessage = l("Repositori ekstensi diperbarui.", "Extension repository refreshed.")
                )
            }
        }
    }

    fun installOrUpdateExtension(extId: String) {
        if (_uiState.value.installingExtensions.containsKey(extId)) return
        val ext = _uiState.value.extensions.find { it.id == extId } ?: return
        viewModelScope.launch {
            for (pct in listOf(18, 42, 68, 91, 100)) {
                _uiState.update { it.copy(installingExtensions = it.installingExtensions + (extId to pct)) }
                delay(180L)
            }
            _uiState.update { state ->
                state.copy(
                    installingExtensions = state.installingExtensions - extId,
                    extensions = state.extensions.map { item ->
                        if (item.id == extId) item.copy(installed = true, hasUpdate = false) else item
                    },
                    snackbarMessage = l("${ext.name} berhasil dipasang.", "${ext.name} installed successfully.")
                )
            }
        }
    }

    fun uninstallExtension(extId: String) {
        val ext = _uiState.value.extensions.find { it.id == extId } ?: return
        _uiState.update { state ->
            state.copy(
                extensions = state.extensions.map { item ->
                    if (item.id == extId) item.copy(installed = false, hasUpdate = false) else item
                },
                snackbarMessage = l("${ext.name} dihapus.", "${ext.name} uninstalled.")
            )
        }
    }

    fun setCatalogSearch(query: String) {
        _uiState.update { it.copy(catalogSearchQuery = query) }
    }

    fun setCatalogSort(sort: SourceFeedSort) {
        _uiState.update { it.copy(catalogSort = sort) }
    }

    fun setCatalogStatusFilter(status: MangaStatus?) {
        _uiState.update { it.copy(catalogStatusFilter = status) }
    }

    fun setCatalogTypeFilter(type: MangaType?) {
        _uiState.update { it.copy(catalogTypeFilter = type) }
    }

    fun setCatalogGenreFilter(genre: String?) {
        _uiState.update { it.copy(catalogGenreFilter = genre) }
    }

    fun resetCatalogFilters() {
        _uiState.update {
            it.copy(
                catalogSearchQuery = "",
                catalogSort = SourceFeedSort.POPULAR,
                catalogStatusFilter = null,
                catalogTypeFilter = null,
                catalogGenreFilter = null
            )
        }
    }

    // =====================================================================
    // MANGA DETAIL, CHAPTERS & MAL TRACKER
    // =====================================================================

    fun toggleInLibrary(mangaId: String) {
        val target = _uiState.value.mangaList.find { it.id == mangaId } ?: return
        val nextInLib = !target.inLibrary
        _uiState.update { state ->
            state.copy(
                mangaList = state.mangaList.map { m ->
                    if (m.id != mangaId) m else m.copy(
                        inLibrary = nextInLib,
                        categoryIds = if (nextInLib && m.categoryIds.isEmpty()) listOf(1) else m.categoryIds
                    )
                },
                snackbarMessage = if (nextInLib) {
                    l("${target.title} ditambahkan ke Pustaka.", "${target.title} added to Library.")
                } else {
                    l("${target.title} dihapus dari Pustaka.", "${target.title} removed from Library.")
                }
            )
        }
    }

    fun setDetailChapterFilter(filter: ChapterFilterMode) {
        _uiState.update { it.copy(detailChapterFilter = filter) }
    }

    fun toggleDetailChapterOrder() {
        _uiState.update { it.copy(detailChapterAsc = !it.detailChapterAsc) }
    }

    fun toggleChapterBookmark(mangaId: String, chapterNumber: Double) {
        _uiState.update { state ->
            state.copy(
                mangaList = state.mangaList.map { m ->
                    if (m.id != mangaId) m else m.copy(
                        chapters = m.chapters.map { ch ->
                            if (abs(ch.number - chapterNumber) < 0.001) ch.copy(isBookmarked = !ch.isBookmarked) else ch
                        }
                    )
                }
            )
        }
    }

    fun toggleChapterRead(mangaId: String, chapterNumber: Double) {
        _uiState.update { state ->
            state.copy(
                mangaList = state.mangaList.map { m ->
                    if (m.id != mangaId) m else m.copy(
                        chapters = m.chapters.map { ch ->
                            if (abs(ch.number - chapterNumber) < 0.001) ch.copy(isRead = !ch.isRead) else ch
                        }
                    )
                }
            )
        }
    }

    fun markPreviousChaptersRead(mangaId: String, chapterNumber: Double) {
        _uiState.update { state ->
            state.copy(
                mangaList = state.mangaList.map { m ->
                    if (m.id != mangaId) m else m.copy(
                        chapters = m.chapters.map { ch ->
                            if (ch.number <= chapterNumber) ch.copy(isRead = true) else ch
                        }
                    )
                },
                snackbarMessage = l("Bab sebelumnya ditandai sudah dibaca.", "Previous chapters marked as read.")
            )
        }
    }

    fun markAllChaptersRead(mangaId: String) {
        _uiState.update { state ->
            state.copy(
                mangaList = state.mangaList.map { m ->
                    if (m.id != mangaId) m else m.copy(
                        chapters = m.chapters.map { it.copy(isRead = true) }
                    )
                },
                snackbarMessage = l("Semua bab ditandai sudah dibaca.", "All chapters marked as read.")
            )
        }
    }

    fun markMultipleRead(mangaIds: Set<String>) {
        if (mangaIds.isEmpty()) return
        _uiState.update { state ->
            state.copy(
                mangaList = state.mangaList.map { m ->
                    if (m.id !in mangaIds) m else m.copy(
                        chapters = m.chapters.map { it.copy(isRead = true) }
                    )
                },
                snackbarMessage = l(
                    "${mangaIds.size} komik ditandai sudah dibaca.",
                    "${mangaIds.size} titles marked as read."
                )
            )
        }
    }

    fun removeMultipleFromLibrary(mangaIds: Set<String>) {
        if (mangaIds.isEmpty()) return
        _uiState.update { state ->
            state.copy(
                mangaList = state.mangaList.map { m ->
                    if (m.id !in mangaIds) m else m.copy(inLibrary = false)
                },
                snackbarMessage = l(
                    "${mangaIds.size} komik dihapus dari Pustaka.",
                    "${mangaIds.size} titles removed from Library."
                )
            )
        }
    }

    fun assignCategoryToMultiple(mangaIds: Set<String>, categoryId: Int) {
        if (mangaIds.isEmpty()) return
        val catName = _uiState.value.categories.find { it.id == categoryId }?.name.orEmpty()
        _uiState.update { state ->
            state.copy(
                mangaList = state.mangaList.map { m ->
                    if (m.id !in mangaIds) m else {
                        val next = if (categoryId in m.categoryIds) m.categoryIds else m.categoryIds + categoryId
                        m.copy(categoryIds = next)
                    }
                },
                snackbarMessage = l(
                    "${mangaIds.size} komik ditambahkan ke kategori $catName.",
                    "${mangaIds.size} titles added to $catName."
                )
            )
        }
    }

    fun downloadUnreadForMultiple(mangaIds: Set<String>) {
        if (mangaIds.isEmpty()) return
        var queued = 0
        for (id in mangaIds) {
            val m = _uiState.value.mangaList.find { it.id == id } ?: continue
            val unread = m.chapters.filter { !it.isRead && !it.isDownloaded }
            if (unread.isNotEmpty()) {
                enqueueUnreadDownloads(id)
                queued += unread.size
            }
        }
        if (queued == 0) {
            showMessage(l("Tidak ada bab baru untuk diunduh.", "No unread chapters to download."))
        }
    }

    fun updateReadingPage(mangaId: String, chapterNumber: Double, page: Int, totalPages: Int) {
        if (_uiState.value.settings.isIncognitoMode) return
        _uiState.update { state ->
            state.copy(
                mangaList = state.mangaList.map { m ->
                    if (m.id != mangaId) m else m.copy(
                        lastReadChapter = chapterNumber,
                        lastReadPage = page,
                        lastReadTotalPages = totalPages,
                        chapters = m.chapters.map { ch ->
                            if (abs(ch.number - chapterNumber) < 0.001) {
                                ch.copy(lastPageRead = page)
                            } else ch
                        }
                    )
                }
            )
        }
    }

    fun recordChapterOpened(mangaId: String, chapterNumber: Double, page: Int, totalPages: Int) {
        if (_uiState.value.settings.isIncognitoMode) return
        val now = System.currentTimeMillis()
        _uiState.update { state ->
            val updatedDaily = state.baseDailyActivity.mapIndexed { idx, day ->
                if (idx == state.baseDailyActivity.lastIndex) {
                    val nextCh = day.chaptersRead + 1
                    day.copy(chaptersRead = nextCh, minutesRead = (nextCh * 2.5f).roundToInt())
                } else day
            }
            state.copy(
                removedHistoryIds = state.removedHistoryIds - mangaId,
                baseDailyActivity = updatedDaily,
                mangaList = state.mangaList.map { m ->
                    if (m.id != mangaId) m else m.copy(
                        lastReadChapter = chapterNumber,
                        lastReadPage = page,
                        lastReadTotalPages = totalPages,
                        lastReadTimeAgo = l("Baru saja", "Just now"),
                        lastViewedEpoch = now,
                        chapters = m.chapters.map { ch ->
                            if (abs(ch.number - chapterNumber) < 0.001) {
                                ch.copy(isRead = true, lastPageRead = page)
                            } else ch
                        }
                    )
                },
                activityUpdates = state.activityUpdates.map { upd ->
                    if (upd.mangaId == mangaId && abs(upd.chapterNumber - chapterNumber) < 0.001) {
                        upd.copy(isNew = false)
                    } else upd
                }
            )
        }
    }

    fun updateMalTracking(
        mangaId: String,
        status: String,
        chaptersRead: Int,
        score: Int,
        malId: Int = 0,
        malTitle: String = ""
    ) {
        _uiState.update { state ->
            state.copy(
                mangaList = state.mangaList.map { m ->
                    if (m.id != mangaId) m else m.copy(
                        malTracked = true,
                        malId = if (malId > 0) malId else m.malId,
                        malTitle = malTitle.ifBlank { m.malTitle.ifBlank { m.title } },
                        malStatus = status,
                        malChaptersRead = chaptersRead,
                        malScore = score
                    )
                },
                snackbarMessage = l("Pelacakan MyAnimeList disimpan.", "MyAnimeList tracking saved.")
            )
        }
    }

    fun unbindMalTracking(mangaId: String) {
        _uiState.update { state ->
            state.copy(
                mangaList = state.mangaList.map { m ->
                    if (m.id != mangaId) m else m.copy(malTracked = false, malId = 0, malTitle = "", malScore = 0)
                },
                snackbarMessage = l("Tautan MyAnimeList dilepas.", "MyAnimeList link removed.")
            )
        }
    }

    // =====================================================================
    // DOWNLOADS QUEUE
    // =====================================================================

    fun enqueueChapterDownload(mangaId: String, chapterNumber: Double) {
        val manga = _uiState.value.mangaList.find { it.id == mangaId } ?: return
        val ch = manga.chapters.find { abs(it.number - chapterNumber) < 0.001 } ?: return
        val dlId = "dl_${mangaId}_${ch.formattedNumber}"
        if (_uiState.value.downloads.any { it.id == dlId }) {
            showMessage(l("Bab sudah ada di antrean unduhan.", "Chapter is already in the download queue."))
            return
        }
        val item = DownloadQueueItem(
            id = dlId,
            mangaId = manga.id,
            mangaTitle = manga.title,
            chapterLabel = "Chapter ${ch.formattedNumber}",
            chapterNumber = ch.number,
            sourceName = manga.sourceName,
            progressPercent = 0,
            speedText = "3.8 MB/s",
            sizeText = "15.2 MB",
            status = DownloadStatus.DOWNLOADING
        )
        _uiState.update {
            it.copy(
                downloads = listOf(item) + it.downloads,
                snackbarMessage = l("Mengunduh ${manga.title} Ch. ${ch.formattedNumber}...", "Downloading ${manga.title} Ch. ${ch.formattedNumber}...")
            )
        }
    }

    fun enqueueUnreadDownloads(mangaId: String) {
        val manga = _uiState.value.mangaList.find { it.id == mangaId } ?: return
        val toDownload = manga.chapters.filter { !it.isDownloaded }.take(3)
        if (toDownload.isEmpty()) {
            showMessage(l("Semua bab sudah tersimpan offline.", "All chapters are already downloaded."))
            return
        }
        val existingIds = _uiState.value.downloads.map { it.id }.toSet()
        val newItems = toDownload.mapNotNull { ch ->
            val dlId = "dl_${mangaId}_${ch.formattedNumber}"
            if (dlId in existingIds) null else DownloadQueueItem(
                id = dlId,
                mangaId = manga.id,
                mangaTitle = manga.title,
                chapterLabel = "Chapter ${ch.formattedNumber}",
                chapterNumber = ch.number,
                sourceName = manga.sourceName,
                progressPercent = 0,
                speedText = "4.1 MB/s",
                sizeText = "16.4 MB",
                status = DownloadStatus.DOWNLOADING
            )
        }
        if (newItems.isNotEmpty()) {
            _uiState.update {
                it.copy(
                    downloads = newItems + it.downloads,
                    snackbarMessage = l("${newItems.size} bab ditambahkan ke antrean unduhan.", "${newItems.size} chapters added to download queue.")
                )
            }
        }
    }

    fun removeSingleChapterDownload(mangaId: String, chapterNumber: Double) {
        _uiState.update { state ->
            state.copy(
                mangaList = state.mangaList.map { m ->
                    if (m.id != mangaId) m else m.copy(
                        chapters = m.chapters.map { ch ->
                            if (abs(ch.number - chapterNumber) < 0.001) ch.copy(isDownloaded = false) else ch
                        }
                    )
                },
                downloads = state.downloads.filterNot {
                    it.mangaId == mangaId && abs(it.chapterNumber - chapterNumber) < 0.001
                },
                snackbarMessage = l("Unduhan bab dihapus.", "Chapter download removed.")
            )
        }
    }

    fun deleteAllChapterDownloads(mangaId: String) {
        _uiState.update { state ->
            state.copy(
                mangaList = state.mangaList.map { m ->
                    if (m.id != mangaId) m else m.copy(chapters = m.chapters.map { it.copy(isDownloaded = false) })
                },
                downloads = state.downloads.filterNot { it.mangaId == mangaId },
                snackbarMessage = l("Semua unduhan komik ini dihapus.", "All downloads for this title removed.")
            )
        }
    }

    fun toggleDownloadPause(dlId: String) {
        _uiState.update { state ->
            state.copy(
                downloads = state.downloads.map { d ->
                    if (d.id != dlId || d.status == DownloadStatus.COMPLETED) d else {
                        if (d.status == DownloadStatus.PAUSED) {
                            d.copy(status = DownloadStatus.DOWNLOADING, speedText = "4.2 MB/s")
                        } else {
                            d.copy(status = DownloadStatus.PAUSED, speedText = l("Dijeda", "Paused"))
                        }
                    }
                }
            )
        }
    }

    fun pauseAllDownloads() {
        _uiState.update { state ->
            state.copy(
                downloads = state.downloads.map { d ->
                    if (d.status == DownloadStatus.DOWNLOADING || d.status == DownloadStatus.QUEUED) {
                        d.copy(status = DownloadStatus.PAUSED, speedText = l("Dijeda", "Paused"))
                    } else d
                },
                snackbarMessage = l("Seluruh unduhan aktif dijeda.", "All active downloads paused.")
            )
        }
    }

    fun resumeAllDownloads() {
        _uiState.update { state ->
            state.copy(
                downloads = state.downloads.map { d ->
                    if (d.status == DownloadStatus.PAUSED) {
                        d.copy(status = DownloadStatus.DOWNLOADING, speedText = "4.6 MB/s")
                    } else d
                },
                snackbarMessage = l("Seluruh unduhan dilanjutkan.", "All downloads resumed.")
            )
        }
    }

    fun removeDownloadEntry(dlId: String) {
        _uiState.update { state ->
            state.copy(downloads = state.downloads.filterNot { it.id == dlId })
        }
    }

    fun clearCompletedDownloads() {
        _uiState.update { state ->
            state.copy(
                downloads = state.downloads.filterNot { it.status == DownloadStatus.COMPLETED },
                snackbarMessage = l("Unduhan selesai dibersihkan.", "Completed downloads cleared.")
            )
        }
    }

    private fun startDownloadTicker() {
        viewModelScope.launch {
            while (true) {
                delay(1200L)
                val current = _uiState.value
                val hasDownloading = current.downloads.any { it.status == DownloadStatus.DOWNLOADING }
                if (!hasDownloading || current.settings.isOfflineMode) continue

                val completedNow = mutableListOf<Pair<String, Double>>()
                val updatedDownloads = current.downloads.map { d ->
                    if (d.status != DownloadStatus.DOWNLOADING) d else {
                        val nextPct = (d.progressPercent + 9).coerceAtMost(100)
                        if (nextPct >= 100) {
                            completedNow += (d.mangaId to d.chapterNumber)
                            d.copy(progressPercent = 100, status = DownloadStatus.COMPLETED, speedText = "")
                        } else {
                            d.copy(progressPercent = nextPct)
                        }
                    }
                }
                _uiState.update { state ->
                    var nextManga = state.mangaList
                    if (completedNow.isNotEmpty()) {
                        nextManga = state.mangaList.map { m ->
                            val doneChapters = completedNow.filter { it.first == m.id }.map { it.second }
                            if (doneChapters.isEmpty()) m else m.copy(
                                chapters = m.chapters.map { ch ->
                                    if (doneChapters.any { abs(it - ch.number) < 0.001 }) ch.copy(isDownloaded = true) else ch
                                }
                            )
                        }
                    }
                    state.copy(downloads = updatedDownloads, mangaList = nextManga)
                }
            }
        }
    }

    // =====================================================================
    // SETTINGS, ANNOUNCEMENTS & STATISTICS
    // =====================================================================

    fun updateSettings(transform: (AppSettingsState) -> AppSettingsState, toast: String? = null) {
        _uiState.update { state ->
            state.copy(
                settings = transform(state.settings),
                snackbarMessage = toast ?: state.snackbarMessage
            )
        }
    }

    fun markAnnouncementsRead() {
        _uiState.update { state ->
            state.copy(announcements = state.announcements.map { it.copy(isUnread = false) })
        }
    }

    fun refreshAnnouncements() {
        if (_uiState.value.isRefreshingAnnouncements) return
        viewModelScope.launch {
            _uiState.update { it.copy(isRefreshingAnnouncements = true) }
            delay(750L)
            _uiState.update {
                it.copy(
                    isRefreshingAnnouncements = false,
                    snackbarMessage = l("Pengumuman diperbarui.", "Announcements refreshed.")
                )
            }
        }
    }

    fun resetAppDemo() {
        val lang = _uiState.value.settings.appLanguage
        val dark = _uiState.value.settings.isDarkMode
        _uiState.value = createInitialState().copy(
            settings = AppSettingsState(isDarkMode = dark, appLanguage = lang),
            snackbarMessage = l("Data demo aplikasi berhasil diatur ulang.", "Demo application data has been reset.")
        )
    }

    fun computeReadingStatistics(state: YomicUiState = _uiState.value): ReadingStatistics {
        val library = state.mangaList.filter { it.inLibrary }
        var reading = 0
        var completed = 0
        var unread = 0
        var totalLibCh = 0
        var readLibCh = 0
        var downloaded = 0

        for (m in library) {
            totalLibCh += m.totalChapters
            readLibCh += m.readCount
            downloaded += m.downloadedCount
            when {
                m.totalChapters > 0 && m.unreadCount == 0 -> completed++
                m.readCount > 0 -> reading++
                else -> unread++
            }
        }

        val genreMap = mutableMapOf<String, Pair<Int, Int>>()
        for (m in library) {
            for (g in m.genres.distinct()) {
                val prev = genreMap[g] ?: (0 to 0)
                genreMap[g] = (prev.first + 1) to (prev.second + m.readCount)
            }
        }
        val topGenres = genreMap.entries
            .sortedWith(compareByDescending<Map.Entry<String, Pair<Int, Int>>> { it.value.first }
                .thenByDescending { it.value.second })
            .take(8)
            .map { GenreStatItem(it.key, it.value.first, it.value.second) }

        val daily = state.baseDailyActivity
        val activeDays = daily.count { it.chaptersRead > 0 }
        var curStreak = 0
        for (i in daily.lastIndex downTo 0) {
            if (daily[i].chaptersRead > 0) curStreak++ else break
        }
        var longest = 0
        var run = 0
        for (d in daily) {
            if (d.chaptersRead > 0) {
                run++
                if (run > longest) longest = run
            } else {
                run = 0
            }
        }

        val completionPct = if (totalLibCh > 0) (readLibCh * 100f / totalLibCh) else 0f
        return ReadingStatistics(
            totalLibraryManga = library.size,
            readingMangaCount = reading,
            completedMangaCount = completed,
            unreadMangaCount = unread,
            totalChaptersRead = readLibCh,
            totalLibraryChapters = totalLibCh,
            completionRatePercent = completionPct,
            totalDownloadedChapters = downloaded,
            currentStreakDays = curStreak,
            longestStreakDays = longest.coerceAtLeast(curStreak),
            totalReadingMinutes = if (readLibCh > 0) (readLibCh * 2.5f).roundToInt().coerceAtLeast(1) else 0,
            activeDaysCount = activeDays,
            topGenres = topGenres,
            dailyActivity = daily
        )
    }

    fun getFilteredLibraryManga(state: YomicUiState = _uiState.value): List<MangaItem> {
        val q = state.librarySearchQuery.trim().lowercase()
        return state.mangaList
            .asSequence()
            .filter { it.inLibrary }
            .filter { !state.settings.isOfflineMode || it.downloadedCount > 0 }
            .filter { state.settings.showNsfw || !it.isExplicit }
            .filter { m ->
                q.isEmpty() ||
                    m.title.lowercase().contains(q) ||
                    m.author.lowercase().contains(q) ||
                    m.sourceName.lowercase().contains(q) ||
                    m.genres.any { it.lowercase().contains(q) }
            }
            .filter { m ->
                state.libraryCategoryFilterId == null || state.libraryCategoryFilterId in m.categoryIds
            }
            .filter { m ->
                when (state.libraryFilterMode) {
                    LibraryFilterMode.ALL -> true
                    LibraryFilterMode.UNREAD -> m.unreadCount > 0 && m.readCount == 0
                    LibraryFilterMode.READING -> m.unreadCount > 0 && m.readCount > 0
                    LibraryFilterMode.COMPLETED -> m.totalChapters > 0 && m.unreadCount == 0
                    LibraryFilterMode.DOWNLOADED -> m.downloadedCount > 0
                }
            }
            .filter { m ->
                state.librarySourceFilterId == null || m.sourceId == state.librarySourceFilterId
            }
            .sortedWith(
                when (state.librarySortBy) {
                    LibrarySortBy.LAST_READ -> compareByDescending { it.lastViewedEpoch }
                    LibrarySortBy.UNREAD -> compareByDescending { it.unreadCount }
                    LibrarySortBy.UPDATED -> compareByDescending { it.lastUpdateEpoch }
                    LibrarySortBy.TITLE_ASC -> compareBy { it.title.lowercase() }
                    LibrarySortBy.TITLE_DESC -> compareByDescending { it.title.lowercase() }
                }
            )
            .toList()
    }
}
