package id.yomic.mobile.ui.navigation

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.consumeWindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBars
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.ui.Alignment
import androidx.compose.ui.draw.clip
import androidx.compose.material3.Badge
import androidx.compose.material3.BadgedBox
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.NavigationBarItemDefaults
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Snackbar
import androidx.compose.material3.SnackbarDuration
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.navigation.NavGraph.Companion.findStartDestination
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import androidx.navigation.navArgument
import id.yomic.mobile.model.YomicUiState
import id.yomic.mobile.ui.i18n.yomicStrings
import id.yomic.mobile.ui.screens.AnnouncementsScreen
import id.yomic.mobile.ui.screens.BrowseScreen
import id.yomic.mobile.ui.screens.DownloadsScreen
import id.yomic.mobile.ui.screens.FeedbackScreen
import id.yomic.mobile.ui.screens.HistoryScreen
import id.yomic.mobile.ui.screens.LibraryScreen
import id.yomic.mobile.ui.screens.MangaDetailScreen
import id.yomic.mobile.ui.screens.MoreScreen
import id.yomic.mobile.ui.screens.ReaderScreen
import id.yomic.mobile.ui.screens.ReadingInsightsScreen
import id.yomic.mobile.ui.screens.SettingsCategory
import id.yomic.mobile.ui.screens.SettingsScreen
import id.yomic.mobile.ui.screens.SourceCatalogScreen
import id.yomic.mobile.ui.screens.TutorialScreen
import id.yomic.mobile.ui.screens.UpdatesScreen
import id.yomic.mobile.ui.theme.YomicIcons
import id.yomic.mobile.ui.theme.YomicThemeTokens
import id.yomic.mobile.viewmodel.YomicViewModel

object YomicRoutes {
    const val LIBRARY = "library"
    const val UPDATES = "updates"
    const val HISTORY = "history"
    const val BROWSE = "browse"
    const val MORE = "more"

    const val CATALOG = "catalog/{sourceId}"
    const val DETAIL = "detail/{mangaId}"
    const val READER = "reader/{mangaId}/{chapter}"
    const val DOWNLOADS = "downloads"
    const val INSIGHTS = "insights"
    const val SETTINGS = "settings?category={category}"
    const val ANNOUNCEMENTS = "announcements"
    const val FEEDBACK = "feedback"
    const val TUTORIAL = "tutorial"

    fun catalog(sourceId: String) = "catalog/$sourceId"
    fun detail(mangaId: String) = "detail/$mangaId"
    fun reader(mangaId: String, chapter: Double) = "reader/$mangaId/$chapter"
    fun settings(category: SettingsCategory? = null) =
        if (category != null) "settings?category=${category.name}" else "settings"
}

private data class BottomNavTab(
    val route: String,
    val label: String,
    val icon: ImageVector,
    val activeIcon: ImageVector = icon,
    val badgeCount: Int = 0
)

@Composable
fun YomicAppShell(
    state: YomicUiState,
    viewModel: YomicViewModel
) {
    val navController = rememberNavController()
    val tokens = YomicThemeTokens.colors
    val s = yomicStrings
    val snackbarHostState = remember { SnackbarHostState() }

    LaunchedEffect(state.snackbarMessage) {
        val msg = state.snackbarMessage ?: return@LaunchedEffect
        snackbarHostState.showSnackbar(message = msg, duration = SnackbarDuration.Short)
        viewModel.clearMessage()
    }

    val currentRoute = navController.currentBackStackEntryAsState().value?.destination?.route
    val topLevelRoutes = remember {
        setOf(YomicRoutes.LIBRARY, YomicRoutes.UPDATES, YomicRoutes.HISTORY, YomicRoutes.BROWSE, YomicRoutes.MORE)
    }
    val showBottomBar = currentRoute in topLevelRoutes
    val isReaderOrDetail = currentRoute?.startsWith("reader/") == true || currentRoute?.startsWith("detail/") == true
    val showStatusBanners = !isReaderOrDetail && (state.settings.isOfflineMode || state.settings.isIncognitoMode)

    val newUpdatesCount = remember(state.activityUpdates) { state.activityUpdates.count { it.isNew } }

    fun navigateTopTab(route: String) {
        navController.navigate(route) {
            popUpTo(navController.graph.findStartDestination().id) { saveState = true }
            launchSingleTop = true
            restoreState = true
        }
    }

    Scaffold(
        containerColor = tokens.canvas,
        contentWindowInsets = WindowInsets(0, 0, 0, 0),
        topBar = {
            if (showStatusBanners) {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .background(tokens.surfaceAlt)
                        .statusBarsPadding()
                ) {
                    if (state.settings.isOfflineMode) {
                        YomicModeStatusStrip(
                            icon = YomicIcons.WifiOff,
                            text = if (s.isEn) "Downloaded only · Tap to disable" else "Mode hanya unduhan · Ketuk untuk nonaktifkan",
                            onClick = {
                                viewModel.updateSettings(
                                    { it.copy(isOfflineMode = false) },
                                    if (s.isEn) "Downloaded only mode disabled." else "Mode hanya unduhan dinonaktifkan."
                                )
                            }
                        )
                    }
                    if (state.settings.isIncognitoMode) {
                        YomicModeStatusStrip(
                            icon = YomicIcons.Incognito,
                            text = if (s.isEn) "Incognito mode · History paused" else "Mode penyamaran · Riwayat dijeda",
                            onClick = {
                                viewModel.updateSettings(
                                    { it.copy(isIncognitoMode = false) },
                                    if (s.isEn) "Incognito mode disabled." else "Mode penyamaran dinonaktifkan."
                                )
                            }
                        )
                    }
                    HorizontalDivider(color = tokens.borderSubtle, thickness = 0.75.dp)
                }
            }
        },
        snackbarHost = {
            SnackbarHost(hostState = snackbarHostState) { data ->
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 16.dp, vertical = 12.dp)
                        .clip(RoundedCornerShape(10.dp))
                        .background(tokens.elevated)
                        .border(0.8.dp, tokens.borderStrong, RoundedCornerShape(10.dp))
                        .padding(horizontal = 16.dp, vertical = 13.dp)
                ) {
                    Text(
                        text = data.visuals.message,
                        color = tokens.inkPrimary,
                        fontSize = 13.5.sp,
                        fontWeight = FontWeight.Medium
                    )
                }
            }
        },
        bottomBar = {
            if (showBottomBar) {
                YomicBottomNavigationBar(
                    currentRoute = currentRoute ?: YomicRoutes.LIBRARY,
                    newUpdatesCount = newUpdatesCount,
                    onSelectTab = ::navigateTopTab
                )
            }
        }
    ) { innerPadding ->
        val contentModifier = when {
            isReaderOrDetail -> Modifier.fillMaxSize()
            showStatusBanners -> Modifier
                .fillMaxSize()
                .padding(top = innerPadding.calculateTopPadding(), bottom = innerPadding.calculateBottomPadding())
                .consumeWindowInsets(WindowInsets.statusBars)
            else -> Modifier
                .fillMaxSize()
                .padding(bottom = innerPadding.calculateBottomPadding())
        }

        Box(modifier = contentModifier) {
            NavHost(
                navController = navController,
                startDestination = YomicRoutes.LIBRARY
            ) {
                composable(YomicRoutes.LIBRARY) {
                    LibraryScreen(
                        state = state,
                        filteredManga = viewModel.getFilteredLibraryManga(state),
                        onSearchChange = viewModel::setLibrarySearch,
                        onCategorySelect = viewModel::setLibraryCategoryFilter,
                        onFilterModeSelect = viewModel::setLibraryFilterMode,
                        onSourceFilterSelect = viewModel::setLibrarySourceFilter,
                        onSortSelect = viewModel::setLibrarySort,
                        onResetFilters = viewModel::resetLibraryFilters,
                        onAddCategory = viewModel::addCategory,
                        onDeleteCategory = viewModel::deleteCategory,
                        onToggleMangaCategory = viewModel::toggleMangaCategory,
                        onToggleViewMode = viewModel::toggleLibraryViewMode,
                        onTriggerSync = viewModel::triggerLibrarySync,
                        onOpenInsights = { navController.navigate(YomicRoutes.INSIGHTS) },
                        onOpenMangaDetail = { id -> navController.navigate(YomicRoutes.detail(id)) },
                        onQuickRead = { id, ch -> navController.navigate(YomicRoutes.reader(id, ch)) },
                        onMarkAllRead = viewModel::markAllChaptersRead,
                        onRemoveFromLibrary = viewModel::toggleInLibrary,
                        onGoToBrowse = { navigateTopTab(YomicRoutes.BROWSE) },
                        onOpenTutorial = { navController.navigate(YomicRoutes.TUTORIAL) },
                        onBatchMarkRead = viewModel::markMultipleRead,
                        onBatchRemove = viewModel::removeMultipleFromLibrary,
                        onBatchDownload = viewModel::downloadUnreadForMultiple,
                        onBatchAssignCategory = viewModel::assignCategoryToMultiple
                    )
                }

                composable(YomicRoutes.UPDATES) {
                    UpdatesScreen(
                        state = state,
                        onTriggerSync = viewModel::triggerLibrarySync,
                        onClearAll = viewModel::clearAllUpdates,
                        onOpenDetail = { id -> navController.navigate(YomicRoutes.detail(id)) },
                        onQuickRead = { id, ch -> navController.navigate(YomicRoutes.reader(id, ch)) },
                        onDownloadChapter = viewModel::enqueueChapterDownload
                    )
                }

                composable(YomicRoutes.HISTORY) {
                    HistoryScreen(
                        state = state,
                        onSearchChange = viewModel::setHistorySearch,
                        onToggleViewMode = viewModel::toggleHistoryViewMode,
                        onOpenInsights = { navController.navigate(YomicRoutes.INSIGHTS) },
                        onRemoveItem = viewModel::removeHistoryItem,
                        onRestoreItem = viewModel::restoreHistoryItem,
                        onClearAll = viewModel::clearAllHistory,
                        onOpenDetail = { id -> navController.navigate(YomicRoutes.detail(id)) },
                        onContinueRead = { id, ch -> navController.navigate(YomicRoutes.reader(id, ch)) }
                    )
                }

                composable(YomicRoutes.BROWSE) {
                    BrowseScreen(
                        state = state,
                        onBrowseSearchChange = viewModel::setBrowseSearch,
                        onBrowseLangChange = viewModel::setBrowseLangFilter,
                        onExtSearchChange = viewModel::setExtSearch,
                        onExtLangChange = viewModel::setExtLangFilter,
                        onRefreshRepo = viewModel::refreshExtensionRepo,
                        onInstallOrUpdateExt = viewModel::installOrUpdateExtension,
                        onUninstallExt = viewModel::uninstallExtension,
                        onOpenSourceCatalog = { srcId ->
                            viewModel.resetCatalogFilters()
                            navController.navigate(YomicRoutes.catalog(srcId))
                        },
                        onOpenInBrowserToast = { name ->
                            viewModel.showMessage(if (s.isEn) "Opening $name in external browser..." else "Membuka $name di browser...")
                        },
                        onTogglePinSource = viewModel::togglePinSource,
                        onOpenMangaDetail = { id -> navController.navigate(YomicRoutes.detail(id)) }
                    )
                }

                composable(YomicRoutes.MORE) {
                    MoreScreen(
                        state = state,
                        onToggleDarkMode = { dark ->
                            viewModel.updateSettings({ it.copy(isDarkMode = dark) })
                        },
                        onToggleOfflineMode = { offline ->
                            viewModel.updateSettings(
                                { it.copy(isOfflineMode = offline) },
                                if (offline) (if (s.isEn) "Downloaded only mode enabled." else "Mode hanya unduhan diaktifkan.")
                                else (if (s.isEn) "Downloaded only mode disabled." else "Mode hanya unduhan dinonaktifkan.")
                            )
                        },
                        onToggleIncognitoMode = { incognito ->
                            viewModel.updateSettings(
                                { it.copy(isIncognitoMode = incognito) },
                                if (incognito) (if (s.isEn) "Incognito mode enabled. Reading history paused." else "Mode penyamaran aktif. Riwayat baca dijeda.")
                                else (if (s.isEn) "Incognito mode disabled." else "Mode penyamaran dinonaktifkan.")
                            )
                        },
                        onAddCategory = viewModel::addCategory,
                        onDeleteCategory = viewModel::deleteCategory,
                        onOpenDownloads = { navController.navigate(YomicRoutes.DOWNLOADS) },
                        onOpenInsights = { navController.navigate(YomicRoutes.INSIGHTS) },
                        onOpenStorage = { navController.navigate(YomicRoutes.settings(SettingsCategory.STORAGE)) },
                        onOpenAnnouncements = { navController.navigate(YomicRoutes.ANNOUNCEMENTS) },
                        onOpenFeedback = { navController.navigate(YomicRoutes.FEEDBACK) },
                        onOpenTutorial = { navController.navigate(YomicRoutes.TUTORIAL) },
                        onOpenSettings = { navController.navigate(YomicRoutes.settings()) },
                        onOpenAbout = { navController.navigate(YomicRoutes.settings(SettingsCategory.ABOUT)) }
                    )
                }

                composable(
                    route = YomicRoutes.CATALOG,
                    arguments = listOf(navArgument("sourceId") { type = NavType.StringType })
                ) { entry ->
                    val sourceId = entry.arguments?.getString("sourceId").orEmpty()
                    SourceCatalogScreen(
                        sourceId = sourceId,
                        state = state,
                        onBack = { navController.popBackStack() },
                        onSearchChange = viewModel::setCatalogSearch,
                        onSortChange = viewModel::setCatalogSort,
                        onStatusChange = viewModel::setCatalogStatusFilter,
                        onTypeChange = viewModel::setCatalogTypeFilter,
                        onGenreChange = viewModel::setCatalogGenreFilter,
                        onResetFilters = viewModel::resetCatalogFilters,
                        onToggleMangaDexLang = { lang ->
                            viewModel.updateSettings({ it.copy(mangaDexLanguage = lang) })
                        },
                        onOpenMangaDetail = { id -> navController.navigate(YomicRoutes.detail(id)) }
                    )
                }

                composable(
                    route = YomicRoutes.DETAIL,
                    arguments = listOf(navArgument("mangaId") { type = NavType.StringType })
                ) { entry ->
                    val mangaId = entry.arguments?.getString("mangaId").orEmpty()
                    MangaDetailScreen(
                        mangaId = mangaId,
                        state = state,
                        onBack = { navController.popBackStack() },
                        onToggleInLibrary = viewModel::toggleInLibrary,
                        onOpenReader = { id, ch -> navController.navigate(YomicRoutes.reader(id, ch)) },
                        onDownloadUnread = viewModel::enqueueUnreadDownloads,
                        onDownloadSingle = viewModel::enqueueChapterDownload,
                        onDeleteSingleDownload = viewModel::removeSingleChapterDownload,
                        onDeleteAllDownloads = viewModel::deleteAllChapterDownloads,
                        onToggleBookmark = viewModel::toggleChapterBookmark,
                        onToggleChapterRead = viewModel::toggleChapterRead,
                        onMarkPreviousRead = viewModel::markPreviousChaptersRead,
                        onChapterFilterChange = viewModel::setDetailChapterFilter,
                        onToggleChapterOrder = viewModel::toggleDetailChapterOrder,
                        onSaveMalTracking = viewModel::updateMalTracking,
                        onUnbindMal = viewModel::unbindMalTracking,
                        onOpenSettings = { navController.navigate(YomicRoutes.settings(SettingsCategory.TRACKER)) },
                        onToast = viewModel::showMessage,
                        onMarkAllRead = viewModel::markAllChaptersRead
                    )
                }

                composable(
                    route = YomicRoutes.READER,
                    arguments = listOf(
                        navArgument("mangaId") { type = NavType.StringType },
                        navArgument("chapter") { type = NavType.StringType }
                    )
                ) { entry ->
                    val mangaId = entry.arguments?.getString("mangaId").orEmpty()
                    val chapterNum = entry.arguments?.getString("chapter")?.toDoubleOrNull() ?: 1.0
                    ReaderScreen(
                        mangaId = mangaId,
                        initialChapterNumber = chapterNum,
                        state = state,
                        onClose = { navController.popBackStack() },
                        onRecordProgress = viewModel::recordChapterOpened,
                        onUpdatePageProgress = viewModel::updateReadingPage,
                        onUpdateDimmer = { alpha ->
                            viewModel.updateSettings({ it.copy(readerDimmerAlpha = alpha.coerceIn(0f, 0.7f)) })
                        },
                        onToggleBookmark = viewModel::toggleChapterBookmark,
                        onToggleImageSetting = { key, enabled ->
                            viewModel.updateSettings({
                                when (key) {
                                    "crop" -> it.copy(enableAutoCropBorders = enabled)
                                    "sharpen" -> it.copy(enableImageSharpening = enabled)
                                    else -> it.copy(enableImageOptimization = enabled)
                                }
                            })
                        },
                        onToast = viewModel::showMessage
                    )
                }

                composable(YomicRoutes.DOWNLOADS) {
                    DownloadsScreen(
                        state = state,
                        onBack = { navController.popBackStack() },
                        onPauseAll = viewModel::pauseAllDownloads,
                        onResumeAll = viewModel::resumeAllDownloads,
                        onClearCompleted = viewModel::clearCompletedDownloads,
                        onTogglePause = viewModel::toggleDownloadPause,
                        onRemoveEntry = viewModel::removeDownloadEntry,
                        onOpenDetail = { id -> navController.navigate(YomicRoutes.detail(id)) },
                        onQuickRead = { id, ch -> navController.navigate(YomicRoutes.reader(id, ch)) }
                    )
                }

                composable(YomicRoutes.INSIGHTS) {
                    ReadingInsightsScreen(
                        stats = viewModel.computeReadingStatistics(state),
                        onBack = { navController.popBackStack() }
                    )
                }

                composable(
                    route = YomicRoutes.SETTINGS,
                    arguments = listOf(navArgument("category") { type = NavType.StringType; nullable = true; defaultValue = null })
                ) { entry ->
                    val catName = entry.arguments?.getString("category")
                    val initialCat = catName?.let { runCatching { SettingsCategory.valueOf(it) }.getOrNull() }
                    SettingsScreen(
                        settings = state.settings,
                        onBack = { navController.popBackStack() },
                        onUpdateSettings = { transform, toast -> viewModel.updateSettings(transform, toast) },
                        onClearHistory = viewModel::clearAllHistory,
                        onResetApp = viewModel::resetAppDemo,
                        onToast = viewModel::showMessage,
                        initialCategory = initialCat
                    )
                }

                composable(YomicRoutes.ANNOUNCEMENTS) {
                    AnnouncementsScreen(
                        announcements = state.announcements,
                        onMarkRead = viewModel::markAnnouncementsRead,
                        onBack = { navController.popBackStack() },
                        isRefreshing = state.isRefreshingAnnouncements,
                        onRefresh = viewModel::refreshAnnouncements
                    )
                }

                composable(YomicRoutes.FEEDBACK) {
                    FeedbackScreen(
                        onBack = { navController.popBackStack() },
                        onSubmitSuccess = viewModel::showMessage
                    )
                }

                composable(YomicRoutes.TUTORIAL) {
                    TutorialScreen(onFinish = { navController.popBackStack() })
                }
            }
        }
    }
}

@Composable
fun YomicBottomNavigationBar(
    currentRoute: String,
    newUpdatesCount: Int,
    onSelectTab: (String) -> Unit
) {
    val tokens = YomicThemeTokens.colors
    val s = yomicStrings
    val bottomTabs = listOf(
        BottomNavTab(YomicRoutes.LIBRARY, s.navLibrary, YomicIcons.Library, YomicIcons.LibraryFilled),
        BottomNavTab(YomicRoutes.UPDATES, s.navUpdates, YomicIcons.NewReleases, badgeCount = newUpdatesCount),
        BottomNavTab(YomicRoutes.BROWSE, s.navBrowse, YomicIcons.Browse),
        BottomNavTab(YomicRoutes.HISTORY, s.navHistory, YomicIcons.History),
        BottomNavTab(YomicRoutes.MORE, s.navMore, YomicIcons.More)
    )

    Column {
        HorizontalDivider(color = tokens.borderSubtle, thickness = 0.75.dp)
        NavigationBar(
            containerColor = tokens.navBar,
            tonalElevation = 0.dp
        ) {
            bottomTabs.forEach { tab ->
                val selected = currentRoute == tab.route
                NavigationBarItem(
                    selected = selected,
                    onClick = { onSelectTab(tab.route) },
                    icon = {
                        if (tab.badgeCount > 0) {
                            BadgedBox(
                                badge = {
                                    Badge(containerColor = tokens.elevated, contentColor = tokens.inkPrimary) {
                                        Text(tab.badgeCount.toString(), fontSize = 9.5.sp, fontWeight = FontWeight.SemiBold)
                                    }
                                }
                            ) {
                                Icon(
                                    imageVector = if (selected) tab.activeIcon else tab.icon,
                                    contentDescription = tab.label,
                                    modifier = Modifier.size(22.dp)
                                )
                            }
                        } else {
                            Icon(
                                imageVector = if (selected) tab.activeIcon else tab.icon,
                                contentDescription = tab.label,
                                modifier = Modifier.size(22.dp)
                            )
                        }
                    },
                    label = {
                        Text(
                            text = tab.label,
                            fontSize = 11.sp,
                            fontWeight = if (selected) FontWeight.Bold else FontWeight.Medium,
                            maxLines = 1
                        )
                    },
                    colors = NavigationBarItemDefaults.colors(
                        selectedIconColor = tokens.inkPrimary,
                        selectedTextColor = tokens.inkPrimary,
                        indicatorColor = tokens.surfaceAlt,
                        unselectedIconColor = tokens.inkMuted,
                        unselectedTextColor = tokens.inkMuted
                    )
                )
            }
        }
    }
}

@Composable
private fun YomicModeStatusStrip(
    icon: ImageVector,
    text: String,
    onClick: () -> Unit
) {
    val tokens = YomicThemeTokens.colors
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick)
            .padding(horizontal = 16.dp, vertical = 6.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.Center
    ) {
        Icon(
            imageVector = icon,
            contentDescription = null,
            tint = tokens.inkSecondary,
            modifier = Modifier.size(14.dp)
        )
        Box(modifier = Modifier.padding(start = 7.dp)) {
            Text(
                text = text,
                color = tokens.inkPrimary,
                fontSize = 11.5.sp,
                fontWeight = FontWeight.Medium
            )
        }
    }
}
