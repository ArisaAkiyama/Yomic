package id.yomic.mobile.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FilterChipDefaults
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Tab
import androidx.compose.material3.TabRow
import androidx.compose.material3.TabRowDefaults
import androidx.compose.material3.TabRowDefaults.tabIndicatorOffset
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
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
import id.yomic.mobile.model.MangaStatus
import id.yomic.mobile.model.MangaType
import id.yomic.mobile.model.SourceFeedSort
import id.yomic.mobile.model.SourceLang
import id.yomic.mobile.model.YomicUiState
import id.yomic.mobile.ui.components.InlineSearchInput
import id.yomic.mobile.ui.components.MangaGridCard
import id.yomic.mobile.ui.components.SourceAvatarBadge
import id.yomic.mobile.ui.components.YomicEmptyState
import id.yomic.mobile.ui.i18n.yomicStrings
import id.yomic.mobile.ui.theme.YomicIcons
import id.yomic.mobile.ui.theme.YomicTheme
import id.yomic.mobile.ui.theme.YomicThemeTokens

@OptIn(ExperimentalMaterial3Api::class, ExperimentalLayoutApi::class)
@Composable
fun SourceCatalogScreen(
    sourceId: String,
    state: YomicUiState,
    onBack: () -> Unit,
    onSearchChange: (String) -> Unit,
    onSortChange: (SourceFeedSort) -> Unit,
    onStatusChange: (MangaStatus?) -> Unit,
    onTypeChange: (MangaType?) -> Unit,
    onGenreChange: (String?) -> Unit,
    onResetFilters: () -> Unit,
    onToggleMangaDexLang: (SourceLang) -> Unit,
    onOpenMangaDetail: (String) -> Unit
) {
    val tokens = YomicThemeTokens.colors
    val s = yomicStrings
    val source = state.extensions.find { it.id == sourceId }
    val isMangaDex = sourceId.contains("mangadex", ignoreCase = true)

    var isSearchOpen by remember { mutableStateOf(false) }
    var isFilterOpen by remember { mutableStateOf(false) }
    var filterTab by remember { mutableIntStateOf(0) }

    val hasActiveFilter = state.catalogSort != SourceFeedSort.POPULAR ||
        state.catalogStatusFilter != null ||
        state.catalogTypeFilter != null ||
        state.catalogGenreFilter != null

    val catalogItems = remember(
        state.mangaList,
        sourceId,
        state.catalogSearchQuery,
        state.catalogSort,
        state.catalogStatusFilter,
        state.catalogTypeFilter,
        state.catalogGenreFilter
    ) {
        val q = state.catalogSearchQuery.trim().lowercase()
        val exactSource = state.mangaList.filter { it.sourceId == sourceId }
        val pool = if (exactSource.size >= 3) exactSource else state.mangaList
        val filtered = pool.filter { m ->
            (state.catalogStatusFilter == null || m.status == state.catalogStatusFilter) &&
                (state.catalogTypeFilter == null || m.type == state.catalogTypeFilter) &&
                (state.catalogGenreFilter == null || state.catalogGenreFilter in m.genres) &&
                (q.isEmpty() || m.title.lowercase().contains(q) || m.author.lowercase().contains(q) || m.genres.any { it.lowercase().contains(q) })
        }
        if (state.catalogSort == SourceFeedSort.LATEST) filtered.sortedByDescending { it.lastUpdateEpoch }
        else filtered.sortedByDescending { it.rating }
    }

    val allGenres = remember(state.mangaList) {
        state.mangaList.flatMap { it.genres }.distinct().sorted()
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(tokens.canvas)
    ) {
        TopAppBar(
            colors = TopAppBarDefaults.topAppBarColors(containerColor = tokens.canvas),
            navigationIcon = {
                IconButton(onClick = onBack) {
                    Icon(YomicIcons.ArrowBack, contentDescription = "Back", tint = tokens.inkPrimary, modifier = Modifier.size(22.dp))
                }
            },
            title = {
                if (isSearchOpen) {
                    InlineSearchInput(
                        query = state.catalogSearchQuery,
                        placeholder = "${s.search} ${source?.name ?: ""}...",
                        onQueryChange = onSearchChange,
                        onClose = {
                            isSearchOpen = false
                            onSearchChange("")
                        }
                    )
                } else {
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(9.dp)) {
                        if (source != null) {
                            SourceAvatarBadge(name = source.name, accentColorHex = source.accentColorHex, size = 28.dp)
                        }
                        Text(
                            text = source?.name ?: "Katalog",
                            style = MaterialTheme.typography.titleMedium,
                            color = tokens.inkPrimary,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis
                        )
                    }
                }
            },
            actions = {
                if (!isSearchOpen) {
                    if (isMangaDex) {
                        val cur = state.settings.mangaDexLanguage
                        Row(
                            modifier = Modifier
                                .clip(RoundedCornerShape(8.dp))
                                .background(tokens.surfaceAlt)
                                .border(0.8.dp, tokens.borderSubtle, RoundedCornerShape(8.dp))
                                .padding(2.dp),
                            horizontalArrangement = Arrangement.spacedBy(2.dp)
                        ) {
                            listOf(SourceLang.ID to "ID", SourceLang.EN to "EN").forEach { (lang, label) ->
                                val active = cur == lang
                                Box(
                                    modifier = Modifier
                                        .clip(RoundedCornerShape(6.dp))
                                        .background(if (active) tokens.accent else Color.Transparent)
                                        .clickable { onToggleMangaDexLang(lang) }
                                        .padding(horizontal = 7.dp, vertical = 4.dp)
                                ) {
                                    Text(
                                        text = label,
                                        color = if (active) tokens.onAccent else tokens.inkSecondary,
                                        fontSize = 11.sp,
                                        fontWeight = FontWeight.Bold
                                    )
                                }
                            }
                        }
                        Spacer(Modifier.width(4.dp))
                    }
                    IconButton(onClick = { isSearchOpen = true }) {
                        Icon(YomicIcons.Search, contentDescription = s.search, tint = tokens.inkPrimary, modifier = Modifier.size(20.dp))
                    }
                    IconButton(onClick = { isFilterOpen = true }) {
                        Box {
                            Icon(
                                YomicIcons.Filter,
                                contentDescription = s.filterAndSort,
                                tint = if (hasActiveFilter) tokens.accent else tokens.inkPrimary,
                                modifier = Modifier.size(20.dp)
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
                }
            }
        )

        // Quick Sort Pill Bar (Popular / Latest)
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 14.dp, vertical = 4.dp),
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            FilterChip(
                selected = state.catalogSort == SourceFeedSort.POPULAR,
                onClick = { onSortChange(SourceFeedSort.POPULAR) },
                label = { Text(s.sortPopular, fontSize = 12.sp) },
                colors = FilterChipDefaults.filterChipColors(
                    selectedContainerColor = tokens.accentTint,
                    selectedLabelColor = tokens.accent
                )
            )
            FilterChip(
                selected = state.catalogSort == SourceFeedSort.LATEST,
                onClick = { onSortChange(SourceFeedSort.LATEST) },
                label = { Text(s.sortLatest, fontSize = 12.sp) },
                colors = FilterChipDefaults.filterChipColors(
                    selectedContainerColor = tokens.accentTint,
                    selectedLabelColor = tokens.accent
                )
            )
            if (state.catalogGenreFilter != null) {
                FilterChip(
                    selected = true,
                    onClick = { onGenreChange(null) },
                    label = { Text("${state.catalogGenreFilter} ×", fontSize = 12.sp) },
                    colors = FilterChipDefaults.filterChipColors(
                        selectedContainerColor = tokens.accentTint,
                        selectedLabelColor = tokens.accent
                    )
                )
            }
        }

        if (state.settings.isOfflineMode) {
            YomicEmptyState(
                icon = YomicIcons.WifiOff,
                title = s.offlineMode,
                description = if (s.isEn) "Disable Offline Mode in More/Settings to browse online catalogs." else "Nonaktifkan Mode Offline di Lainnya/Pengaturan untuk menjelajahi katalog online."
            )
        } else if (catalogItems.isEmpty()) {
            YomicEmptyState(
                icon = YomicIcons.Search,
                title = s.libraryEmptyFilteredTitle,
                description = s.libraryEmptyFilteredDesc,
                primaryActionLabel = s.reset,
                onPrimaryAction = onResetFilters
            )
        } else {
            LazyVerticalGrid(
                columns = GridCells.Fixed(3),
                contentPadding = PaddingValues(horizontal = 12.dp, vertical = 10.dp),
                horizontalArrangement = Arrangement.spacedBy(10.dp),
                verticalArrangement = Arrangement.spacedBy(14.dp),
                modifier = Modifier.fillMaxSize()
            ) {
                items(catalogItems, key = { it.id }) { manga ->
                    MangaGridCard(
                        manga = manga,
                        showUnreadBadge = false,
                        blurExplicit = state.settings.blurExplicitCovers,
                        subtitle = "${manga.type.name} • ${if (manga.status == MangaStatus.ONGOING) s.ongoing else s.completed}",
                        showInLibraryTag = true,
                        inLibraryLabel = s.inLibrary,
                        modifier = Modifier.clickable { onOpenMangaDetail(manga.id) }
                    )
                }
            }
        }
    }

    if (isFilterOpen) {
        ModalBottomSheet(
            onDismissRequest = { isFilterOpen = false },
            containerColor = tokens.surface,
            sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
        ) {
            Column(modifier = Modifier.fillMaxWidth().padding(bottom = 24.dp)) {
                Row(
                    modifier = Modifier.fillMaxWidth().padding(horizontal = 20.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(s.filterAndSort, style = MaterialTheme.typography.titleMedium, color = tokens.inkPrimary)
                    if (hasActiveFilter) {
                        TextButton(onClick = {
                            onResetFilters()
                            isFilterOpen = false
                        }) {
                            Text(s.reset, color = tokens.rose)
                        }
                    }
                }
                TabRow(
                    selectedTabIndex = filterTab,
                    containerColor = tokens.surface,
                    contentColor = tokens.accent,
                    divider = { HorizontalDivider(color = tokens.borderSubtle) },
                    indicator = { positions ->
                        TabRowDefaults.SecondaryIndicator(
                            modifier = Modifier.tabIndicatorOffset(positions[filterTab]),
                            color = tokens.accent
                        )
                    }
                ) {
                    listOf(s.tabFilter, s.genre, s.tabSort).forEachIndexed { idx, label ->
                        Tab(
                            selected = idx == filterTab,
                            onClick = { filterTab = idx },
                            selectedContentColor = tokens.accent,
                            unselectedContentColor = tokens.inkSecondary,
                            text = { Text(label) }
                        )
                    }
                }
                Column(
                    modifier = Modifier.fillMaxWidth().padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(6.dp)
                ) {
                    when (filterTab) {
                        0 -> {
                            Text(s.comicStatus, style = MaterialTheme.typography.labelLarge, color = tokens.inkSecondary)
                            SheetCheckOptionRow(s.all, state.catalogStatusFilter == null) { onStatusChange(null) }
                            SheetCheckOptionRow(s.ongoing, state.catalogStatusFilter == MangaStatus.ONGOING) { onStatusChange(MangaStatus.ONGOING) }
                            SheetCheckOptionRow(s.completed, state.catalogStatusFilter == MangaStatus.COMPLETED) { onStatusChange(MangaStatus.COMPLETED) }
                            Spacer(Modifier.height(6.dp))
                            Text(s.comicType, style = MaterialTheme.typography.labelLarge, color = tokens.inkSecondary)
                            SheetCheckOptionRow(s.all, state.catalogTypeFilter == null) { onTypeChange(null) }
                            SheetCheckOptionRow("Manhwa", state.catalogTypeFilter == MangaType.MANHWA) { onTypeChange(MangaType.MANHWA) }
                            SheetCheckOptionRow("Manga", state.catalogTypeFilter == MangaType.MANGA) { onTypeChange(MangaType.MANGA) }
                            SheetCheckOptionRow("Manhua", state.catalogTypeFilter == MangaType.MANHUA) { onTypeChange(MangaType.MANHUA) }
                        }
                        1 -> {
                            FlowRow(
                                horizontalArrangement = Arrangement.spacedBy(8.dp),
                                verticalArrangement = Arrangement.spacedBy(6.dp)
                            ) {
                                FilterChip(
                                    selected = state.catalogGenreFilter == null,
                                    onClick = { onGenreChange(null) },
                                    label = { Text(s.allGenres, fontSize = 12.sp) }
                                )
                                allGenres.forEach { genre ->
                                    FilterChip(
                                        selected = state.catalogGenreFilter == genre,
                                        onClick = { onGenreChange(genre) },
                                        label = { Text(genre, fontSize = 12.sp) },
                                        colors = FilterChipDefaults.filterChipColors(
                                            selectedContainerColor = tokens.accentTint,
                                            selectedLabelColor = tokens.accent
                                        )
                                    )
                                }
                            }
                        }
                        2 -> {
                            SheetCheckOptionRow(s.sortPopular, state.catalogSort == SourceFeedSort.POPULAR) { onSortChange(SourceFeedSort.POPULAR) }
                            SheetCheckOptionRow(s.sortLatest, state.catalogSort == SourceFeedSort.LATEST) { onSortChange(SourceFeedSort.LATEST) }
                        }
                    }
                }
            }
        }
    }
}

@Preview(name = "Source Catalog Dark", showBackground = true, widthDp = 390, heightDp = 820)
@Composable
fun SourceCatalogPreview() {
    val state = YomicUiState(
        mangaList = DemoDataRepository.createMangaList(),
        extensions = DemoDataRepository.createExtensions()
    )
    YomicTheme(darkTheme = true) {
        SourceCatalogScreen(
            sourceId = "komiku",
            state = state,
            onBack = {},
            onSearchChange = {},
            onSortChange = {},
            onStatusChange = {},
            onTypeChange = {},
            onGenreChange = {},
            onResetFilters = {},
            onToggleMangaDexLang = {},
            onOpenMangaDetail = {}
        )
    }
}
