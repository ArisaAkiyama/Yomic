package id.yomic.mobile.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
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
import id.yomic.mobile.model.MangaItem
import id.yomic.mobile.model.YomicUiState
import id.yomic.mobile.ui.components.InlineSearchInput
import id.yomic.mobile.ui.components.MangaCoverArtwork
import id.yomic.mobile.ui.components.MangaGridCard
import id.yomic.mobile.ui.components.YomicConfirmDialog
import id.yomic.mobile.ui.components.YomicEmptyState
import id.yomic.mobile.ui.i18n.yomicStrings
import id.yomic.mobile.ui.navigation.YomicBottomNavigationBar
import id.yomic.mobile.ui.navigation.YomicRoutes
import id.yomic.mobile.ui.theme.YomicIcons
import id.yomic.mobile.ui.theme.YomicTheme
import id.yomic.mobile.ui.theme.YomicThemeTokens
import java.util.Calendar

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun HistoryScreen(
    state: YomicUiState,
    onSearchChange: (String) -> Unit,
    onToggleViewMode: () -> Unit,
    onOpenInsights: () -> Unit,
    onRemoveItem: (String) -> Unit,
    onRestoreItem: (String) -> Unit = {},
    onClearAll: () -> Unit,
    onOpenDetail: (String) -> Unit,
    onContinueRead: (String, Double) -> Unit
) {
    val tokens = YomicThemeTokens.colors
    val s = yomicStrings
    var isSearchOpen by remember { mutableStateOf(false) }
    var showClearDialog by remember { mutableStateOf(false) }
    var lastRemovedManga by remember { mutableStateOf<MangaItem?>(null) }

    val historyItems = remember(state.mangaList, state.removedHistoryIds, state.historySearchQuery) {
        val q = state.historySearchQuery.trim().lowercase()
        state.mangaList
            .filter { it.id !in state.removedHistoryIds && it.lastViewedEpoch > 0L }
            .filter { q.isEmpty() || it.title.lowercase().contains(q) || it.sourceName.lowercase().contains(q) }
            .sortedByDescending { it.lastViewedEpoch }
    }

    val grouped = remember(historyItems, s.today, s.yesterday, s.earlier) {
        val cal = Calendar.getInstance().apply {
            set(Calendar.HOUR_OF_DAY, 0)
            set(Calendar.MINUTE, 0)
            set(Calendar.SECOND, 0)
            set(Calendar.MILLISECOND, 0)
        }
        val todayStart = cal.timeInMillis
        val yesterdayStart = todayStart - 86_400_000L
        val today = mutableListOf<MangaItem>()
        val yesterday = mutableListOf<MangaItem>()
        val earlier = mutableListOf<MangaItem>()
        historyItems.forEach { m ->
            when {
                m.lastViewedEpoch >= todayStart -> today += m
                m.lastViewedEpoch >= yesterdayStart -> yesterday += m
                else -> earlier += m
            }
        }
        buildList {
            if (today.isNotEmpty()) add(s.today to today)
            if (yesterday.isNotEmpty()) add(s.yesterday to yesterday)
            if (earlier.isNotEmpty()) add(s.earlier to earlier)
        }
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(tokens.canvas)
    ) {
        TopAppBar(
            colors = TopAppBarDefaults.topAppBarColors(containerColor = tokens.canvas),
            title = {
                if (isSearchOpen) {
                    InlineSearchInput(
                        query = state.historySearchQuery,
                        placeholder = s.librarySearchHint,
                        onQueryChange = onSearchChange,
                        onClose = {
                            isSearchOpen = false
                            onSearchChange("")
                        }
                    )
                } else {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text(s.navHistory, style = MaterialTheme.typography.titleLarge, color = tokens.inkPrimary)
                        Spacer(Modifier.width(6.dp))
                        Text(
                            text = "(${historyItems.size})",
                            style = MaterialTheme.typography.bodyMedium,
                            color = tokens.inkMuted,
                            fontWeight = FontWeight.Normal
                        )
                    }
                }
            },
            actions = {
                if (!isSearchOpen) {
                    IconButton(onClick = { isSearchOpen = true }) {
                        Icon(YomicIcons.Search, contentDescription = s.search, tint = tokens.inkPrimary, modifier = Modifier.size(20.dp))
                    }
                    if (historyItems.isNotEmpty()) {
                        IconButton(onClick = { showClearDialog = true }) {
                            Icon(YomicIcons.Trash, contentDescription = s.delete, tint = tokens.inkSecondary, modifier = Modifier.size(20.dp))
                        }
                    }
                    IconButton(onClick = onToggleViewMode) {
                        Icon(
                            if (state.historyIsGridMode) YomicIcons.ListView else YomicIcons.Grid,
                            contentDescription = "Toggle view",
                            tint = tokens.inkPrimary,
                            modifier = Modifier.size(20.dp)
                        )
                    }
                }
            }
        )

        // Subtle Undo Banner after removing a history item
        lastRemovedManga?.let { removed ->
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(tokens.surfaceAlt)
                    .padding(horizontal = 16.dp, vertical = 8.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Text(
                    text = if (s.isEn) "Removed \"${removed.title}\"" else "Dihapus: ${removed.title}",
                    style = MaterialTheme.typography.bodySmall,
                    color = tokens.inkSecondary,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.weight(1f).padding(end = 10.dp)
                )
                Text(
                    text = if (s.isEn) "Undo" else "Urungkan",
                    style = MaterialTheme.typography.labelMedium,
                    fontWeight = FontWeight.SemiBold,
                    color = tokens.inkPrimary,
                    modifier = Modifier
                        .clip(RoundedCornerShape(6.dp))
                        .clickable {
                            onRestoreItem(removed.id)
                            lastRemovedManga = null
                        }
                        .padding(horizontal = 8.dp, vertical = 4.dp)
                )
            }
        }

        if (historyItems.isEmpty()) {
            YomicEmptyState(
                icon = YomicIcons.History,
                title = s.historyEmptyTitle,
                description = s.historyEmptyDesc
            )
        } else if (state.historyIsGridMode) {
            LazyVerticalGrid(
                columns = GridCells.Fixed(state.settings.gridColumns.coerceIn(2, 4)),
                contentPadding = PaddingValues(12.dp),
                horizontalArrangement = Arrangement.spacedBy(10.dp),
                verticalArrangement = Arrangement.spacedBy(14.dp),
                modifier = Modifier.fillMaxSize()
            ) {
                items(historyItems, key = { it.id }) { manga ->
                    MangaGridCard(
                        manga = manga,
                        showUnreadBadge = false,
                        blurExplicit = state.settings.blurExplicitCovers,
                        subtitle = "Ch. ${manga.formattedLastReadChapter} · ${manga.lastReadTimeAgo}",
                        modifier = Modifier.clickable { onOpenDetail(manga.id) }
                    )
                }
            }
        } else {
            LazyColumn(
                contentPadding = PaddingValues(bottom = 16.dp),
                modifier = Modifier.fillMaxSize()
            ) {
                grouped.forEachIndexed { groupIdx, (header, itemsList) ->
                    item(key = "h_hdr_$header") {
                        if (groupIdx > 0) {
                            androidx.compose.material3.HorizontalDivider(
                                color = tokens.borderSubtle,
                                thickness = 0.8.dp,
                                modifier = Modifier.padding(vertical = 6.dp)
                            )
                        }
                        Text(
                            text = header,
                            style = MaterialTheme.typography.labelLarge,
                            color = tokens.inkSecondary,
                            modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp)
                        )
                    }
                    items(itemsList, key = { it.id }) { manga ->
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clickable { onContinueRead(manga.id, manga.lastReadChapter) }
                                .padding(horizontal = 16.dp, vertical = 9.dp),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(12.dp)
                        ) {
                            MangaCoverArtwork(
                                manga = manga,
                                compactThumbnail = true,
                                cornerRadius = 6.dp,
                                modifier = Modifier
                                    .size(width = 46.dp, height = 64.dp)
                                    .clickable { onOpenDetail(manga.id) }
                            )
                            Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(3.dp)) {
                                Text(
                                    text = manga.title,
                                    style = MaterialTheme.typography.bodyLarge,
                                    fontWeight = FontWeight.Medium,
                                    color = tokens.inkPrimary,
                                    maxLines = 2,
                                    overflow = TextOverflow.Ellipsis
                                )
                                Text(
                                    text = "Ch. ${manga.formattedLastReadChapter} · ${s.pageLabel} ${manga.lastReadPage}/${manga.lastReadTotalPages}",
                                    style = MaterialTheme.typography.bodySmall,
                                    color = tokens.inkSecondary,
                                    maxLines = 1,
                                    overflow = TextOverflow.Ellipsis
                                )
                                Text(
                                    text = "${manga.sourceName} · ${manga.lastReadTimeAgo}",
                                    style = MaterialTheme.typography.labelSmall,
                                    color = tokens.inkMuted,
                                    maxLines = 1,
                                    overflow = TextOverflow.Ellipsis
                                )
                            }
                            IconButton(
                                onClick = { onContinueRead(manga.id, manga.lastReadChapter) },
                                modifier = Modifier.size(36.dp)
                            ) {
                                Icon(YomicIcons.Play, contentDescription = s.read, tint = tokens.inkPrimary, modifier = Modifier.size(17.dp))
                            }
                            IconButton(
                                onClick = {
                                    lastRemovedManga = manga
                                    onRemoveItem(manga.id)
                                },
                                modifier = Modifier.size(36.dp)
                            ) {
                                Icon(YomicIcons.Trash, contentDescription = s.delete, tint = tokens.inkMuted, modifier = Modifier.size(18.dp))
                            }
                        }
                    }
                }
            }
        }
    }

    if (showClearDialog) {
        YomicConfirmDialog(
            title = s.clearHistoryTitle,
            message = s.clearHistoryMsg,
            confirmText = s.delete,
            cancelText = s.cancel,
            isDanger = true,
            onConfirm = {
                showClearDialog = false
                onClearAll()
            },
            onDismiss = { showClearDialog = false }
        )
    }
}

@Preview(name = "History Carbon Dark", showBackground = true, widthDp = 390, heightDp = 820)
@Composable
fun HistoryScreenPreview() {
    val state = YomicUiState(mangaList = DemoDataRepository.createMangaList())
    YomicTheme(darkTheme = true) {
        Scaffold(
            containerColor = YomicThemeTokens.colors.canvas,
            bottomBar = {
                YomicBottomNavigationBar(
                    currentRoute = YomicRoutes.HISTORY,
                    newUpdatesCount = 4,
                    onSelectTab = {}
                )
            }
        ) { innerPadding ->
            Box(modifier = Modifier.fillMaxSize().padding(bottom = innerPadding.calculateBottomPadding())) {
                HistoryScreen(
                    state = state,
                    onSearchChange = {},
                    onToggleViewMode = {},
                    onOpenInsights = {},
                    onRemoveItem = {},
                    onClearAll = {},
                    onOpenDetail = {},
                    onContinueRead = { _, _ -> }
                )
            }
        }
    }
}
