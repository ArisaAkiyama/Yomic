package id.yomic.mobile

import id.yomic.mobile.data.DemoDataRepository
import id.yomic.mobile.model.LibraryFilterMode
import id.yomic.mobile.model.LibrarySortBy
import id.yomic.mobile.model.YomicUiState
import id.yomic.mobile.viewmodel.YomicViewModel
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class YomicViewModelTest {

    @Test
    fun libraryFilteringAndSortingWorkCorrectly() {
        val vm = YomicViewModel(autoStartTicker = false)
        val initial = vm.getFilteredLibraryManga()
        assertTrue(initial.isNotEmpty())
        assertTrue(initial.all { it.inLibrary })

        vm.setLibraryFilterMode(LibraryFilterMode.COMPLETED)
        val completed = vm.getFilteredLibraryManga()
        assertTrue(completed.all { it.unreadCount == 0 && it.totalChapters > 0 })

        vm.resetLibraryFilters()
        vm.setLibrarySort(LibrarySortBy.TITLE_ASC)
        val sortedAsc = vm.getFilteredLibraryManga()
        assertEquals(sortedAsc.sortedBy { it.title.lowercase() }.map { it.id }, sortedAsc.map { it.id })
    }

    @Test
    fun addingAndDeletingCategoryUpdatesState() {
        val vm = YomicViewModel(autoStartTicker = false)
        val beforeCount = vm.uiState.value.categories.size
        vm.addCategory("Isekai")
        val added = vm.uiState.value.categories.find { it.name == "Isekai" }
        assertTrue(added != null)
        assertEquals(beforeCount + 1, vm.uiState.value.categories.size)

        vm.deleteCategory(added!!.id)
        assertEquals(beforeCount, vm.uiState.value.categories.size)
        assertFalse(vm.uiState.value.categories.any { it.name == "Isekai" })
    }

    @Test
    fun readingStatisticsMatchesLibraryTotals() {
        val vm = YomicViewModel(autoStartTicker = false)
        val state = YomicUiState(
            mangaList = DemoDataRepository.createMangaList(),
            baseDailyActivity = DemoDataRepository.createBaseDailyActivity()
        )
        val stats = vm.computeReadingStatistics(state)
        assertEquals(state.mangaList.count { it.inLibrary }, stats.totalLibraryManga)
        assertTrue(stats.totalChaptersRead > 0)
        assertTrue(stats.dailyActivity.size == 14)
        assertTrue(stats.topGenres.isNotEmpty())
    }

    @Test
    fun offlineModeFiltersLibraryToDownloadedOnly() {
        val vm = YomicViewModel(autoStartTicker = false)
        val allCount = vm.getFilteredLibraryManga().size
        vm.updateSettings({ it.copy(isOfflineMode = true) })
        val offlineList = vm.getFilteredLibraryManga()
        assertTrue(offlineList.isNotEmpty())
        assertTrue(offlineList.size <= allCount)
        assertTrue(offlineList.all { it.downloadedCount > 0 })
    }

    @Test
    fun batchActionsSourcePinningAndHistoryUndoWork() {
        val vm = YomicViewModel(autoStartTicker = false)
        val targets = vm.getFilteredLibraryManga().take(2).map { it.id }.toSet()
        vm.markMultipleRead(targets)
        assertTrue(vm.uiState.value.mangaList.filter { it.id in targets }.all { it.unreadCount == 0 })

        vm.togglePinSource("komiku")
        assertTrue("komiku" in vm.uiState.value.pinnedSourceIds)
        vm.togglePinSource("komiku")
        assertFalse("komiku" in vm.uiState.value.pinnedSourceIds)

        val firstId = targets.first()
        vm.removeHistoryItem(firstId)
        assertTrue(firstId in vm.uiState.value.removedHistoryIds)
        vm.restoreHistoryItem(firstId)
        assertFalse(firstId in vm.uiState.value.removedHistoryIds)
    }

    @Test
    fun updateReadingPageRespectsIncognitoMode() {
        val vm = YomicViewModel(autoStartTicker = false)
        val manga = vm.getFilteredLibraryManga().first()
        val ch = manga.chapters.first()

        vm.updateReadingPage(manga.id, ch.number, 6, ch.totalPages)
        val updated = vm.uiState.value.mangaList.first { it.id == manga.id }
        assertEquals(6, updated.lastReadPage)

        vm.updateSettings({ it.copy(isIncognitoMode = true) })
        vm.updateReadingPage(manga.id, ch.number, 9, ch.totalPages)
        val afterIncognito = vm.uiState.value.mangaList.first { it.id == manga.id }
        assertEquals(6, afterIncognito.lastReadPage)
    }
}
