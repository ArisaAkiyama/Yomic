package id.yomic.mobile.ui.screens

import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.combinedClickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Checkbox
import androidx.compose.material3.CheckboxDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.ScrollableTabRow
import androidx.compose.material3.Tab
import androidx.compose.material3.TabRow
import androidx.compose.material3.TabRowDefaults
import androidx.compose.material3.TabRowDefaults.tabIndicatorOffset
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import id.yomic.mobile.data.DemoDataRepository
import id.yomic.mobile.model.LibraryFilterMode
import id.yomic.mobile.model.LibrarySortBy
import id.yomic.mobile.model.MangaItem
import id.yomic.mobile.model.YomicUiState
import id.yomic.mobile.ui.components.InlineSearchInput
import id.yomic.mobile.ui.components.MangaCoverArtwork
import id.yomic.mobile.ui.components.MangaGridCard
import id.yomic.mobile.ui.components.SourceAvatarBadge
import id.yomic.mobile.ui.components.SyncProgressBanner
import id.yomic.mobile.ui.components.YomicEmptyState
import id.yomic.mobile.ui.i18n.yomicStrings
import id.yomic.mobile.ui.navigation.YomicBottomNavigationBar
import id.yomic.mobile.ui.navigation.YomicRoutes
import id.yomic.mobile.ui.theme.YomicIcons
import id.yomic.mobile.ui.theme.YomicTheme
import id.yomic.mobile.ui.theme.YomicThemeTokens

@OptIn(ExperimentalMaterial3Api::class, ExperimentalFoundationApi::class)
@Composable
fun LibraryScreen(
    state: YomicUiState,
    filteredManga: List<MangaItem>,
    onSearchChange: (String) -> Unit,
    onCategorySelect: (Int?) -> Unit,
    onFilterModeSelect: (LibraryFilterMode) -> Unit,
    onSourceFilterSelect: (String?) -> Unit,
    onSortSelect: (LibrarySortBy) -> Unit,
    onResetFilters: () -> Unit,
    onAddCategory: (String) -> Unit,
    onDeleteCategory: (Int) -> Unit,
    onToggleMangaCategory: (String, Int) -> Unit,
    onToggleViewMode: () -> Unit,
    onTriggerSync: () -> Unit,
    onOpenInsights: () -> Unit,
    onOpenMangaDetail: (String) -> Unit,
    onQuickRead: (String, Double) -> Unit,
    onMarkAllRead: (String) -> Unit,
    onRemoveFromLibrary: (String) -> Unit,
    onGoToBrowse: () -> Unit,
    onOpenTutorial: () -> Unit,
    onBatchMarkRead: (Set<String>) -> Unit = {},
    onBatchRemove: (Set<String>) -> Unit = {},
    onBatchDownload: (Set<String>) -> Unit = {},
    onBatchAssignCategory: (Set<String>, Int) -> Unit = { _, _ -> }
) {
    val tokens = YomicThemeTokens.colors
    val s = yomicStrings
    var isSearchOpen by remember { mutableStateOf(false) }
    var isFilterSheetOpen by remember { mutableStateOf(false) }
    var contextManga by remember { mutableStateOf<MangaItem?>(null) }
    var selectedIds by remember { mutableStateOf(setOf<String>()) }
    var isBatchCategorySheetOpen by remember { mutableStateOf(false) }
    val isSelectionMode = selectedIds.isNotEmpty()

    fun toggleSelect(id: String) {
        selectedIds = if (id in selectedIds) selectedIds - id else selectedIds + id
    }

    val totalLibraryCount = remember(state.mangaList) { state.mangaList.count { it.inLibrary } }
    val hasActiveFilter = state.libraryCategoryFilterId != null ||
        state.libraryFilterMode != LibraryFilterMode.ALL ||
        state.librarySourceFilterId != null ||
        state.librarySortBy != LibrarySortBy.LAST_READ

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(tokens.canvas)
    ) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(tokens.canvas)
    ) {
        TopAppBar(
            colors = TopAppBarDefaults.topAppBarColors(
                containerColor = if (isSelectionMode) tokens.surfaceAlt else tokens.canvas,
                titleContentColor = tokens.inkPrimary
            ),
            navigationIcon = {
                if (isSelectionMode) {
                    IconButton(onClick = { selectedIds = emptySet() }) {
                        Icon(YomicIcons.Close, contentDescription = s.cancel, tint = tokens.inkPrimary, modifier = Modifier.size(20.dp))
                    }
                }
            },
            title = {
                if (isSelectionMode) {
                    Text(
                        text = if (s.isEn) "${selectedIds.size} selected" else "${selectedIds.size} dipilih",
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.SemiBold,
                        color = tokens.inkPrimary
                    )
                } else if (isSearchOpen) {
                    InlineSearchInput(
                        query = state.librarySearchQuery,
                        placeholder = s.librarySearchHint,
                        onQueryChange = onSearchChange,
                        onClose = {
                            isSearchOpen = false
                            onSearchChange("")
                        }
                    )
                } else {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text(
                            text = s.navLibrary,
                            style = MaterialTheme.typography.titleLarge,
                            color = tokens.inkPrimary
                        )
                        Spacer(Modifier.width(6.dp))
                        Text(
                            text = "($totalLibraryCount)",
                            style = MaterialTheme.typography.bodyMedium,
                            color = tokens.inkMuted,
                            fontWeight = FontWeight.Normal
                        )
                    }
                }
            },
            actions = {
                if (isSelectionMode) {
                    val allSelected = filteredManga.isNotEmpty() && filteredManga.all { it.id in selectedIds }
                    TextButton(
                        onClick = {
                            selectedIds = if (allSelected) emptySet() else filteredManga.map { it.id }.toSet()
                        }
                    ) {
                        Text(
                            text = if (allSelected) (if (s.isEn) "Clear" else "Batal") else (if (s.isEn) "Select all" else "Pilih semua"),
                            color = tokens.inkPrimary,
                            style = MaterialTheme.typography.labelLarge
                        )
                    }
                } else if (!isSearchOpen) {
                    IconButton(onClick = { isSearchOpen = true }) {
                        Icon(YomicIcons.Search, contentDescription = s.search, tint = tokens.inkPrimary, modifier = Modifier.size(21.dp))
                    }
                    IconButton(onClick = { isFilterSheetOpen = true }) {
                        Box {
                            Icon(
                                YomicIcons.Filter,
                                contentDescription = s.filterAndSort,
                                tint = if (hasActiveFilter) tokens.accent else tokens.inkPrimary,
                                modifier = Modifier.size(21.dp)
                            )
                            if (hasActiveFilter) {
                                Box(
                                    modifier = Modifier
                                        .size(7.dp)
                                        .align(Alignment.TopEnd)
                                        .clip(CircleShape)
                                        .background(tokens.accent)
                                )
                            }
                        }
                    }
                    IconButton(onClick = onTriggerSync, enabled = !state.syncProgress.active) {
                        Icon(
                            YomicIcons.Updates,
                            contentDescription = s.refresh,
                            tint = if (state.syncProgress.active) tokens.accent else tokens.inkPrimary,
                            modifier = Modifier.size(21.dp)
                        )
                    }
                    IconButton(onClick = onToggleViewMode) {
                        Icon(
                            if (state.libraryIsGridMode) YomicIcons.ListView else YomicIcons.Grid,
                            contentDescription = "Toggle View",
                            tint = tokens.inkPrimary,
                            modifier = Modifier.size(21.dp)
                        )
                    }
                }
            }
        )

        // Mihon-style Horizontal Category Tabs
        val categoryTabs = remember(state.categories, s.all) {
            listOf<Pair<Int?, String>>(null to s.all) + state.categories.map { it.id to it.name }
        }
        val selectedTabIdx = categoryTabs.indexOfFirst { it.first == state.libraryCategoryFilterId }.coerceAtLeast(0)

        ScrollableTabRow(
            selectedTabIndex = selectedTabIdx,
            containerColor = tokens.canvas,
            contentColor = tokens.inkPrimary,
            edgePadding = 12.dp,
            divider = { HorizontalDivider(color = tokens.borderSubtle, thickness = 0.8.dp) },
            indicator = { positions ->
                if (selectedTabIdx < positions.size) {
                    TabRowDefaults.SecondaryIndicator(
                        modifier = Modifier.tabIndicatorOffset(positions[selectedTabIdx]),
                        height = 2.dp,
                        color = tokens.inkPrimary
                    )
                }
            }
        ) {
            categoryTabs.forEachIndexed { index, (catId, label) ->
                val count = if (catId == null) {
                    totalLibraryCount
                } else {
                    state.mangaList.count { it.inLibrary && catId in it.categoryIds }
                }
                Tab(
                    selected = index == selectedTabIdx,
                    onClick = { onCategorySelect(catId) },
                    selectedContentColor = tokens.inkPrimary,
                    unselectedContentColor = tokens.inkSecondary,
                    text = {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(5.dp)
                        ) {
                            Text(
                                text = label,
                                style = MaterialTheme.typography.labelLarge,
                                fontWeight = if (index == selectedTabIdx) FontWeight.SemiBold else FontWeight.Medium
                            )
                            Text(
                                text = count.toString(),
                                style = MaterialTheme.typography.labelSmall,
                                color = if (index == selectedTabIdx) tokens.inkSecondary else tokens.inkMuted
                            )
                        }
                    }
                )
            }
        }

        // Active Sync Progress Banner
        SyncProgressBanner(
            progress = state.syncProgress,
            label = s.checkingUpdates
        )

        // Main Library Content
        when {
            totalLibraryCount == 0 -> {
                YomicEmptyState(
                    icon = YomicIcons.Library,
                    title = s.libraryEmptyTitle,
                    description = s.libraryEmptyDesc,
                    primaryActionLabel = s.navBrowse,
                    onPrimaryAction = onGoToBrowse,
                    secondaryActionLabel = s.navTutorial,
                    onSecondaryAction = onOpenTutorial
                )
            }
            filteredManga.isEmpty() -> {
                YomicEmptyState(
                    icon = YomicIcons.Search,
                    title = s.libraryEmptyFilteredTitle,
                    description = s.libraryEmptyFilteredDesc,
                    primaryActionLabel = s.reset,
                    onPrimaryAction = onResetFilters
                )
            }
            state.libraryIsGridMode -> {
                val gridCols = state.settings.gridColumns.coerceIn(2, 4)
                PullToRefreshBox(
                    isRefreshing = state.syncProgress.active,
                    onRefresh = onTriggerSync,
                    modifier = Modifier.fillMaxSize()
                ) {
                    LazyVerticalGrid(
                        columns = GridCells.Fixed(gridCols),
                        contentPadding = PaddingValues(
                            start = 12.dp,
                            end = 12.dp,
                            top = 12.dp,
                            bottom = if (isSelectionMode) 84.dp else 12.dp
                        ),
                        horizontalArrangement = Arrangement.spacedBy(10.dp),
                        verticalArrangement = Arrangement.spacedBy(14.dp),
                        modifier = Modifier.fillMaxSize()
                    ) {
                        items(filteredManga, key = { it.id }) { manga ->
                            val isSelected = manga.id in selectedIds
                            Box(
                                modifier = Modifier
                                    .clip(RoundedCornerShape(10.dp))
                                    .then(
                                        if (isSelected) Modifier
                                            .background(tokens.surfaceAlt)
                                            .border(1.5.dp, tokens.accent, RoundedCornerShape(10.dp))
                                            .padding(4.dp)
                                        else Modifier
                                    )
                            ) {
                                MangaGridCard(
                                    manga = manga,
                                    showUnreadBadge = state.settings.showUnreadBadges,
                                    blurExplicit = state.settings.blurExplicitCovers,
                                    subtitle = null,
                                    modifier = Modifier.combinedClickable(
                                        onClick = {
                                            if (isSelectionMode) toggleSelect(manga.id)
                                            else onOpenMangaDetail(manga.id)
                                        },
                                        onLongClick = { toggleSelect(manga.id) }
                                    )
                                )
                                if (isSelected) {
                                    Box(
                                        modifier = Modifier
                                            .align(Alignment.TopEnd)
                                            .padding(6.dp)
                                            .size(22.dp)
                                            .clip(CircleShape)
                                            .background(tokens.accent),
                                        contentAlignment = Alignment.Center
                                    ) {
                                        Icon(
                                            YomicIcons.Check,
                                            contentDescription = null,
                                            tint = tokens.onAccent,
                                            modifier = Modifier.size(13.dp)
                                        )
                                    }
                                }
                            }
                        }
                    }
                }
            }
            else -> {
                PullToRefreshBox(
                    isRefreshing = state.syncProgress.active,
                    onRefresh = onTriggerSync,
                    modifier = Modifier.fillMaxSize()
                ) {
                    LazyColumn(
                        contentPadding = PaddingValues(top = 4.dp, bottom = if (isSelectionMode) 84.dp else 4.dp),
                        modifier = Modifier.fillMaxSize()
                    ) {
                        items(filteredManga, key = { it.id }) { manga ->
                            val isSelected = manga.id in selectedIds
                            Box(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .background(if (isSelected) tokens.surfaceAlt else Color.Transparent)
                            ) {
                                LibraryListRow(
                                    manga = manga,
                                    showUnreadBadge = state.settings.showUnreadBadges,
                                    blurExplicit = state.settings.blurExplicitCovers,
                                    isSelected = isSelected,
                                    onClick = {
                                        if (isSelectionMode) toggleSelect(manga.id)
                                        else onOpenMangaDetail(manga.id)
                                    },
                                    onLongClick = { toggleSelect(manga.id) },
                                    onQuickRead = { onQuickRead(manga.id, manga.lastReadChapter) }
                                )
                            }
                        }
                    }
                }
            }
        }
    }

        // Mihon-style Floating Batch Action Bar when Multi-Select is active
        if (isSelectionMode) {
            Row(
                modifier = Modifier
                    .align(Alignment.BottomCenter)
                    .fillMaxWidth()
                    .padding(horizontal = 14.dp, vertical = 10.dp)
                    .clip(RoundedCornerShape(14.dp))
                    .background(tokens.surface)
                    .border(0.9.dp, tokens.borderStrong, RoundedCornerShape(14.dp))
                    .padding(horizontal = 8.dp, vertical = 8.dp),
                horizontalArrangement = Arrangement.SpaceEvenly,
                verticalAlignment = Alignment.CenterVertically
            ) {
                BatchActionButton(
                    icon = YomicIcons.Tag,
                    label = s.tabCategory,
                    onClick = { isBatchCategorySheetOpen = true },
                    modifier = Modifier.weight(1f)
                )
                BatchActionButton(
                    icon = YomicIcons.CheckCircle,
                    label = if (s.isEn) "Read" else "Dibaca",
                    onClick = {
                        onBatchMarkRead(selectedIds)
                        selectedIds = emptySet()
                    },
                    modifier = Modifier.weight(1f)
                )
                BatchActionButton(
                    icon = YomicIcons.Download,
                    label = s.download,
                    onClick = {
                        onBatchDownload(selectedIds)
                        selectedIds = emptySet()
                    },
                    modifier = Modifier.weight(1f)
                )
                BatchActionButton(
                    icon = YomicIcons.Trash,
                    label = s.delete,
                    isDanger = true,
                    onClick = {
                        onBatchRemove(selectedIds)
                        selectedIds = emptySet()
                    },
                    modifier = Modifier.weight(1f)
                )
            }
        }
    }

    // Batch Category Picker Sheet
    if (isBatchCategorySheetOpen) {
        ModalBottomSheet(
            onDismissRequest = { isBatchCategorySheetOpen = false },
            containerColor = tokens.surface
        ) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 20.dp)
                    .padding(bottom = 28.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                Text(
                    text = if (s.isEn) "Assign Category (${selectedIds.size})" else "Tetapkan Kategori (${selectedIds.size})",
                    style = MaterialTheme.typography.titleMedium,
                    color = tokens.inkPrimary
                )
                state.categories.forEach { cat ->
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(10.dp))
                            .background(tokens.surfaceAlt)
                            .clickable {
                                onBatchAssignCategory(selectedIds, cat.id)
                                isBatchCategorySheetOpen = false
                                selectedIds = emptySet()
                            }
                            .padding(horizontal = 14.dp, vertical = 12.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        Icon(YomicIcons.Tag, contentDescription = null, tint = tokens.inkSecondary, modifier = Modifier.size(18.dp))
                        Text(cat.name, color = tokens.inkPrimary, style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight.Medium)
                    }
                }
            }
        }
    }

    // Filter, Category, Source & Sort ModalBottomSheet (4 Tabs mirroring Yomic Desktop)
    if (isFilterSheetOpen) {
        LibraryFilterBottomSheet(
            state = state,
            hasActiveFilter = hasActiveFilter,
            onDismiss = { isFilterSheetOpen = false },
            onCategorySelect = onCategorySelect,
            onFilterModeSelect = onFilterModeSelect,
            onSourceFilterSelect = onSourceFilterSelect,
            onSortSelect = onSortSelect,
            onAddCategory = onAddCategory,
            onDeleteCategory = onDeleteCategory,
            onResetFilters = {
                onResetFilters()
                isFilterSheetOpen = false
            }
        )
    }

    // Long-Press Quick Action Sheet
    contextManga?.let { manga ->
        val freshManga = state.mangaList.find { it.id == manga.id } ?: manga
        ModalBottomSheet(
            onDismissRequest = { contextManga = null },
            containerColor = tokens.surface,
            sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
        ) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 20.dp)
                    .padding(bottom = 28.dp),
                verticalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    MangaCoverArtwork(
                        manga = freshManga,
                        compactThumbnail = true,
                        modifier = Modifier.size(width = 44.dp, height = 62.dp)
                    )
                    Column(modifier = Modifier.weight(1f)) {
                        Text(
                            text = freshManga.title,
                            style = MaterialTheme.typography.titleMedium,
                            color = tokens.inkPrimary,
                            maxLines = 2,
                            overflow = TextOverflow.Ellipsis
                        )
                        Text(
                            text = "${freshManga.sourceName} • ${freshManga.unreadCount} ${s.filterUnread.lowercase()}",
                            style = MaterialTheme.typography.bodySmall,
                            color = tokens.inkSecondary
                        )
                    }
                }

                HorizontalDivider(color = tokens.borderSubtle)

                Text(
                    text = s.tabCategory,
                    style = MaterialTheme.typography.labelLarge,
                    color = tokens.inkSecondary
                )
                state.categories.forEach { cat ->
                    val checked = cat.id in freshManga.categoryIds
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(8.dp))
                            .clickable { onToggleMangaCategory(freshManga.id, cat.id) }
                            .padding(vertical = 4.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Checkbox(
                            checked = checked,
                            onCheckedChange = { onToggleMangaCategory(freshManga.id, cat.id) },
                            colors = CheckboxDefaults.colors(checkedColor = tokens.accent)
                        )
                        Text(cat.name, color = tokens.inkPrimary, style = MaterialTheme.typography.bodyMedium)
                    }
                }

                HorizontalDivider(color = tokens.borderSubtle)

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    Button(
                        onClick = {
                            onMarkAllRead(freshManga.id)
                            contextManga = null
                        },
                        colors = ButtonDefaults.buttonColors(containerColor = tokens.accentTint),
                        shape = RoundedCornerShape(10.dp),
                        modifier = Modifier.weight(1f)
                    ) {
                        Text(
                            text = if (s.isEn) "Mark All Read" else "Tandai Dibaca",
                            color = tokens.accent,
                            fontWeight = FontWeight.SemiBold
                        )
                    }
                    Button(
                        onClick = {
                            onRemoveFromLibrary(freshManga.id)
                            contextManga = null
                        },
                        colors = ButtonDefaults.buttonColors(containerColor = tokens.roseBg),
                        shape = RoundedCornerShape(10.dp),
                        modifier = Modifier.weight(1f)
                    ) {
                        Text(
                            text = s.delete,
                            color = tokens.rose,
                            fontWeight = FontWeight.SemiBold
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun BatchActionButton(
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    label: String,
    isDanger: Boolean = false,
    onClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    val tokens = YomicThemeTokens.colors
    val tint = if (isDanger) tokens.rose else tokens.inkPrimary
    Column(
        modifier = modifier
            .clip(RoundedCornerShape(10.dp))
            .clickable(onClick = onClick)
            .padding(vertical = 6.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(4.dp)
    ) {
        Icon(icon, contentDescription = label, tint = tint, modifier = Modifier.size(19.dp))
        Text(
            text = label,
            color = tint,
            style = MaterialTheme.typography.labelSmall,
            fontWeight = FontWeight.Medium,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis
        )
    }
}

@OptIn(ExperimentalFoundationApi::class)
@Composable
private fun LibraryListRow(
    manga: MangaItem,
    showUnreadBadge: Boolean,
    blurExplicit: Boolean,
    isSelected: Boolean = false,
    onClick: () -> Unit,
    onLongClick: () -> Unit,
    onQuickRead: () -> Unit
) {
    val tokens = YomicThemeTokens.colors
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .combinedClickable(onClick = onClick, onLongClick = onLongClick)
            .padding(horizontal = 16.dp, vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        if (isSelected) {
            Box(
                modifier = Modifier
                    .size(20.dp)
                    .clip(CircleShape)
                    .background(tokens.accent),
                contentAlignment = Alignment.Center
            ) {
                Icon(YomicIcons.Check, contentDescription = null, tint = tokens.onAccent, modifier = Modifier.size(12.dp))
            }
        }
        MangaCoverArtwork(
            manga = manga,
            compactThumbnail = true,
            cornerRadius = 5.dp,
            blurCover = blurExplicit && manga.isExplicit,
            modifier = Modifier.size(width = 44.dp, height = 62.dp)
        )
        Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(5.dp)) {
            Text(
                text = manga.title,
                style = MaterialTheme.typography.bodyLarge,
                fontWeight = FontWeight.Medium,
                color = tokens.inkPrimary,
                maxLines = 2,
                overflow = TextOverflow.Ellipsis
            )
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(6.dp)
            ) {
                SourceAvatarBadge(
                    name = manga.sourceName,
                    accentColorHex = 0xFF27272A,
                    size = 14.dp
                )
                Text(
                    text = "${manga.lastReadTimeAgo} · Ch. ${manga.formattedLastReadChapter}",
                    style = MaterialTheme.typography.bodySmall,
                    color = tokens.inkMuted,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
            }
        }
        if (showUnreadBadge && manga.unreadCount > 0) {
            Box(
                modifier = Modifier
                    .clip(RoundedCornerShape(5.dp))
                    .background(tokens.surfaceAlt)
                    .border(1.dp, tokens.borderStrong, RoundedCornerShape(5.dp))
                    .padding(horizontal = 7.dp, vertical = 3.dp),
                contentAlignment = Alignment.Center
            ) {
                Text(
                    text = manga.unreadCount.toString(),
                    color = tokens.inkPrimary,
                    style = MaterialTheme.typography.labelSmall,
                    fontWeight = FontWeight.SemiBold
                )
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun LibraryFilterBottomSheet(
    state: YomicUiState,
    hasActiveFilter: Boolean,
    onDismiss: () -> Unit,
    onCategorySelect: (Int?) -> Unit,
    onFilterModeSelect: (LibraryFilterMode) -> Unit,
    onSourceFilterSelect: (String?) -> Unit,
    onSortSelect: (LibrarySortBy) -> Unit,
    onAddCategory: (String) -> Unit,
    onDeleteCategory: (Int) -> Unit,
    onResetFilters: () -> Unit
) {
    val tokens = YomicThemeTokens.colors
    val s = yomicStrings
    var activeTab by remember { mutableIntStateOf(0) }
    var newCategoryText by remember { mutableStateOf("") }

    ModalBottomSheet(
        onDismissRequest = onDismiss,
        containerColor = tokens.surface,
        sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(bottom = 24.dp)
        ) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 20.dp, vertical = 4.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(s.filterAndSort, style = MaterialTheme.typography.titleMedium, color = tokens.inkPrimary)
                if (hasActiveFilter) {
                    TextButton(onClick = onResetFilters) {
                        Text(s.reset, color = tokens.rose, fontWeight = FontWeight.SemiBold)
                    }
                }
            }

            val tabs = listOf(s.tabCategory, s.tabFilter, s.tabSource, s.tabSort)
            TabRow(
                selectedTabIndex = activeTab,
                containerColor = tokens.surface,
                contentColor = tokens.accent,
                divider = { HorizontalDivider(color = tokens.borderSubtle) },
                indicator = { positions ->
                    TabRowDefaults.SecondaryIndicator(
                        modifier = Modifier.tabIndicatorOffset(positions[activeTab]),
                        color = tokens.accent
                    )
                }
            ) {
                tabs.forEachIndexed { idx, label ->
                    Tab(
                        selected = idx == activeTab,
                        onClick = { activeTab = idx },
                        selectedContentColor = tokens.accent,
                        unselectedContentColor = tokens.inkSecondary,
                        text = { Text(label, fontSize = 12.5.sp, maxLines = 1) }
                    )
                }
            }

            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp, vertical = 12.dp),
                verticalArrangement = Arrangement.spacedBy(4.dp)
            ) {
                when (activeTab) {
                    0 -> {
                        SheetCheckOptionRow(
                            label = s.allCategories,
                            selected = state.libraryCategoryFilterId == null,
                            trailingText = state.mangaList.count { it.inLibrary }.toString(),
                            onClick = { onCategorySelect(null) }
                        )
                        state.categories.forEach { cat ->
                            val cnt = state.mangaList.count { it.inLibrary && cat.id in it.categoryIds }
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .clip(RoundedCornerShape(10.dp))
                                    .background(if (state.libraryCategoryFilterId == cat.id) tokens.accentTint else Color.Transparent)
                                    .clickable { onCategorySelect(cat.id) }
                                    .padding(horizontal = 12.dp, vertical = 8.dp),
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Box(modifier = Modifier.size(20.dp), contentAlignment = Alignment.Center) {
                                    if (state.libraryCategoryFilterId == cat.id) {
                                        Icon(YomicIcons.Check, contentDescription = null, tint = tokens.accent, modifier = Modifier.size(16.dp))
                                    }
                                }
                                Spacer(Modifier.width(10.dp))
                                Text(cat.name, color = tokens.inkPrimary, modifier = Modifier.weight(1f), style = MaterialTheme.typography.bodyMedium)
                                Text(cnt.toString(), color = tokens.inkMuted, style = MaterialTheme.typography.labelMedium)
                                IconButton(onClick = { onDeleteCategory(cat.id) }, modifier = Modifier.size(30.dp)) {
                                    Icon(YomicIcons.Trash, contentDescription = s.delete, tint = tokens.inkMuted, modifier = Modifier.size(16.dp))
                                }
                            }
                        }
                        Spacer(Modifier.height(8.dp))
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            OutlinedTextField(
                                value = newCategoryText,
                                onValueChange = { if (it.length <= 28) newCategoryText = it },
                                placeholder = { Text(s.addCategoryPlaceholder, fontSize = 13.sp) },
                                singleLine = true,
                                modifier = Modifier.weight(1f)
                            )
                            Button(
                                onClick = {
                                    onAddCategory(newCategoryText)
                                    newCategoryText = ""
                                },
                                colors = ButtonDefaults.buttonColors(
                                    containerColor = tokens.accent,
                                    contentColor = tokens.onAccent
                                ),
                                shape = RoundedCornerShape(10.dp),
                                modifier = Modifier.height(52.dp)
                            ) {
                                Icon(YomicIcons.Plus, contentDescription = s.add, tint = tokens.onAccent, modifier = Modifier.size(18.dp))
                            }
                        }
                    }

                    1 -> {
                        val options = listOf(
                            LibraryFilterMode.ALL to s.all,
                            LibraryFilterMode.UNREAD to s.filterUnread,
                            LibraryFilterMode.READING to s.filterReading,
                            LibraryFilterMode.COMPLETED to s.filterCompleted,
                            LibraryFilterMode.DOWNLOADED to s.filterDownloaded
                        )
                        options.forEach { (mode, label) ->
                            SheetCheckOptionRow(
                                label = label,
                                selected = state.libraryFilterMode == mode,
                                onClick = { onFilterModeSelect(mode) }
                            )
                        }
                    }

                    2 -> {
                        SheetCheckOptionRow(
                            label = s.allSources,
                            selected = state.librarySourceFilterId == null,
                            onClick = { onSourceFilterSelect(null) }
                        )
                        state.extensions.filter { it.installed }.forEach { src ->
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .clip(RoundedCornerShape(10.dp))
                                    .background(if (state.librarySourceFilterId == src.id) tokens.accentTint else Color.Transparent)
                                    .clickable { onSourceFilterSelect(src.id) }
                                    .padding(horizontal = 12.dp, vertical = 9.dp),
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Box(modifier = Modifier.size(20.dp), contentAlignment = Alignment.Center) {
                                    if (state.librarySourceFilterId == src.id) {
                                        Icon(YomicIcons.Check, contentDescription = null, tint = tokens.accent, modifier = Modifier.size(16.dp))
                                    }
                                }
                                Spacer(Modifier.width(10.dp))
                                SourceAvatarBadge(name = src.name, accentColorHex = src.accentColorHex, size = 24.dp)
                                Spacer(Modifier.width(10.dp))
                                Text(src.name, color = tokens.inkPrimary, style = MaterialTheme.typography.bodyMedium)
                            }
                        }
                    }

                    3 -> {
                        val sorts = listOf(
                            LibrarySortBy.LAST_READ to s.sortLastRead,
                            LibrarySortBy.UNREAD to s.sortUnread,
                            LibrarySortBy.UPDATED to s.sortUpdated,
                            LibrarySortBy.TITLE_ASC to s.sortTitleAsc,
                            LibrarySortBy.TITLE_DESC to s.sortTitleDesc
                        )
                        sorts.forEach { (sort, label) ->
                            SheetCheckOptionRow(
                                label = label,
                                selected = state.librarySortBy == sort,
                                onClick = { onSortSelect(sort) }
                            )
                        }
                    }
                }
            }
        }
    }
}

@Composable
internal fun SheetCheckOptionRow(
    label: String,
    selected: Boolean,
    trailingText: String? = null,
    onClick: () -> Unit
) {
    val tokens = YomicThemeTokens.colors
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(10.dp))
            .background(if (selected) tokens.accentTint else Color.Transparent)
            .clickable(onClick = onClick)
            .padding(horizontal = 12.dp, vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Box(modifier = Modifier.size(20.dp), contentAlignment = Alignment.Center) {
            if (selected) {
                Icon(YomicIcons.Check, contentDescription = null, tint = tokens.accent, modifier = Modifier.size(16.dp))
            }
        }
        Spacer(Modifier.width(10.dp))
        Text(
            text = label,
            color = if (selected) tokens.accent else tokens.inkPrimary,
            fontWeight = if (selected) FontWeight.SemiBold else FontWeight.Normal,
            style = MaterialTheme.typography.bodyMedium,
            modifier = Modifier.weight(1f)
        )
        if (trailingText != null) {
            Text(trailingText, color = tokens.inkMuted, style = MaterialTheme.typography.labelMedium)
        }
    }
}

@Preview(name = "Library Carbon Dark", showBackground = true, widthDp = 390, heightDp = 820)
@Composable
fun LibraryScreenDarkPreview() {
    val demoManga = DemoDataRepository.createMangaList()
    val state = YomicUiState(
        mangaList = demoManga,
        categories = DemoDataRepository.createCategories(),
        extensions = DemoDataRepository.createExtensions()
    )
    YomicTheme(darkTheme = true) {
        Scaffold(
            containerColor = YomicThemeTokens.colors.canvas,
            bottomBar = {
                YomicBottomNavigationBar(
                    currentRoute = YomicRoutes.LIBRARY,
                    newUpdatesCount = 4,
                    onSelectTab = {}
                )
            }
        ) { innerPadding ->
            Box(modifier = Modifier.fillMaxSize().padding(bottom = innerPadding.calculateBottomPadding())) {
                LibraryScreen(
                    state = state,
                    filteredManga = demoManga.filter { it.inLibrary },
                    onSearchChange = {}, onCategorySelect = {}, onFilterModeSelect = {},
                    onSourceFilterSelect = {}, onSortSelect = {}, onResetFilters = {},
                    onAddCategory = {}, onDeleteCategory = {}, onToggleMangaCategory = { _, _ -> },
                    onToggleViewMode = {}, onTriggerSync = {}, onOpenInsights = {},
                    onOpenMangaDetail = {}, onQuickRead = { _, _ -> }, onMarkAllRead = {},
                    onRemoveFromLibrary = {}, onGoToBrowse = {}, onOpenTutorial = {}
                )
            }
        }
    }
}

@Preview(name = "Library Oceanic Light", showBackground = true, widthDp = 390, heightDp = 820)
@Composable
fun LibraryScreenLightPreview() {
    val demoManga = DemoDataRepository.createMangaList()
    val state = YomicUiState(
        mangaList = demoManga,
        categories = DemoDataRepository.createCategories(),
        extensions = DemoDataRepository.createExtensions()
    )
    YomicTheme(darkTheme = false) {
        Scaffold(
            containerColor = YomicThemeTokens.colors.canvas,
            bottomBar = {
                YomicBottomNavigationBar(
                    currentRoute = YomicRoutes.LIBRARY,
                    newUpdatesCount = 4,
                    onSelectTab = {}
                )
            }
        ) { innerPadding ->
            Box(modifier = Modifier.fillMaxSize().padding(bottom = innerPadding.calculateBottomPadding())) {
                LibraryScreen(
                    state = state,
                    filteredManga = demoManga.filter { it.inLibrary },
                    onSearchChange = {}, onCategorySelect = {}, onFilterModeSelect = {},
                    onSourceFilterSelect = {}, onSortSelect = {}, onResetFilters = {},
                    onAddCategory = {}, onDeleteCategory = {}, onToggleMangaCategory = { _, _ -> },
                    onToggleViewMode = {}, onTriggerSync = {}, onOpenInsights = {},
                    onOpenMangaDetail = {}, onQuickRead = { _, _ -> }, onMarkAllRead = {},
                    onRemoveFromLibrary = {}, onGoToBrowse = {}, onOpenTutorial = {}
                )
            }
        }
    }
}
