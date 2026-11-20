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
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import id.yomic.mobile.data.DemoDataRepository
import id.yomic.mobile.model.ActivityUpdateItem
import id.yomic.mobile.model.MangaItem
import id.yomic.mobile.model.YomicUiState
import id.yomic.mobile.ui.components.MangaCoverArtwork
import id.yomic.mobile.ui.components.SyncProgressBanner
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
fun UpdatesScreen(
    state: YomicUiState,
    onTriggerSync: () -> Unit,
    onClearAll: () -> Unit,
    onOpenDetail: (String) -> Unit,
    onQuickRead: (String, Double) -> Unit,
    onDownloadChapter: (String, Double) -> Unit = { _, _ -> }
) {
    val tokens = YomicThemeTokens.colors
    val s = yomicStrings

    val grouped = remember(state.activityUpdates, s.today, s.yesterday, s.earlier) {
        val cal = Calendar.getInstance().apply {
            set(Calendar.HOUR_OF_DAY, 0)
            set(Calendar.MINUTE, 0)
            set(Calendar.SECOND, 0)
            set(Calendar.MILLISECOND, 0)
        }
        val todayStart = cal.timeInMillis
        val yesterdayStart = todayStart - 86_400_000L

        val today = mutableListOf<ActivityUpdateItem>()
        val yesterday = mutableListOf<ActivityUpdateItem>()
        val earlier = mutableListOf<ActivityUpdateItem>()

        state.activityUpdates.forEach { u ->
            when {
                u.dateFetchEpoch >= todayStart -> today += u
                u.dateFetchEpoch >= yesterdayStart -> yesterday += u
                else -> earlier += u
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
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(s.navUpdates, style = MaterialTheme.typography.titleLarge, color = tokens.inkPrimary)
                    Spacer(Modifier.width(6.dp))
                    Text(
                        text = "(${state.activityUpdates.size})",
                        style = MaterialTheme.typography.bodyMedium,
                        color = tokens.inkMuted,
                        fontWeight = FontWeight.Normal
                    )
                }
            },
            actions = {
                if (state.activityUpdates.isNotEmpty()) {
                    IconButton(onClick = onClearAll) {
                        Icon(YomicIcons.Trash, contentDescription = s.delete, tint = tokens.inkSecondary, modifier = Modifier.size(20.dp))
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
            }
        )

        SyncProgressBanner(progress = state.syncProgress, label = s.checkingUpdates)

        if (state.activityUpdates.isEmpty()) {
            YomicEmptyState(
                icon = YomicIcons.Updates,
                title = s.updatesEmptyTitle,
                description = s.updatesEmptyDesc,
                primaryActionLabel = s.checkUpdatesNow,
                onPrimaryAction = onTriggerSync
            )
        } else {
            PullToRefreshBox(
                isRefreshing = state.syncProgress.active,
                onRefresh = onTriggerSync,
                modifier = Modifier.fillMaxSize()
            ) {
                LazyColumn(
                    contentPadding = PaddingValues(bottom = 16.dp),
                    modifier = Modifier.fillMaxSize()
                ) {
                    grouped.forEachIndexed { groupIdx, (header, itemsList) ->
                        item(key = "hdr_$header") {
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
                        items(itemsList, key = { it.id }) { update ->
                            val manga = state.mangaList.find { it.id == update.mangaId }
                            val isDownloaded = manga?.chapters?.any {
                                kotlin.math.abs(it.number - update.chapterNumber) < 0.001 && it.isDownloaded
                            } == true
                            UpdateItemRow(
                                update = update,
                                manga = manga,
                                isDownloaded = isDownloaded,
                                onOpenDetail = { onOpenDetail(update.mangaId) },
                                onQuickRead = { onQuickRead(update.mangaId, update.chapterNumber) },
                                onDownload = { onDownloadChapter(update.mangaId, update.chapterNumber) }
                            )
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun UpdateItemRow(
    update: ActivityUpdateItem,
    manga: MangaItem?,
    isDownloaded: Boolean = false,
    onOpenDetail: () -> Unit,
    onQuickRead: () -> Unit,
    onDownload: () -> Unit = {}
) {
    val tokens = YomicThemeTokens.colors
    val s = yomicStrings
    val isRead = !update.isNew

    Row(
        modifier = Modifier
            .fillMaxWidth()
            .alpha(if (isRead) 0.65f else 1f)
            .clickable(onClick = onQuickRead)
            .padding(horizontal = 16.dp, vertical = 9.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        if (manga != null) {
            MangaCoverArtwork(
                manga = manga,
                compactThumbnail = true,
                cornerRadius = 6.dp,
                modifier = Modifier
                    .size(width = 44.dp, height = 62.dp)
                    .clickable(onClick = onOpenDetail)
            )
        }
        Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(3.dp)) {
            Text(
                text = update.mangaTitle,
                style = MaterialTheme.typography.bodyLarge,
                fontWeight = FontWeight.Medium,
                color = tokens.inkPrimary,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis
            )
            val extra = if (update.extraChaptersCount > 0) {
                " (+${update.extraChaptersCount} ${if (s.isEn) "ch." else "bab"})"
            } else ""
            val titlePart = if (update.chapterTitle.isNotBlank()) " · ${update.chapterTitle}" else ""
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(6.dp)
            ) {
                if (!isRead) {
                    Box(
                        modifier = Modifier
                            .size(6.dp)
                            .clip(androidx.compose.foundation.shape.CircleShape)
                            .background(tokens.accent)
                    )
                }
                Text(
                    text = "Ch. ${update.formattedChapterNumber}$titlePart$extra",
                    style = MaterialTheme.typography.bodySmall,
                    color = if (isRead) tokens.inkMuted else tokens.inkSecondary,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
            }
            Text(
                text = "${update.sourceName} · ${update.timeAgo}",
                style = MaterialTheme.typography.labelSmall,
                color = tokens.inkMuted
            )
        }
        IconButton(
            onClick = onDownload,
            enabled = !isDownloaded,
            modifier = Modifier.size(36.dp)
        ) {
            Icon(
                imageVector = if (isDownloaded) YomicIcons.DownloadDone else YomicIcons.Download,
                contentDescription = s.download,
                tint = if (isDownloaded) tokens.inkPrimary else tokens.inkMuted,
                modifier = Modifier.size(18.dp)
            )
        }
    }
}

@Preview(name = "Updates Carbon Dark", showBackground = true, widthDp = 390, heightDp = 820)
@Composable
fun UpdatesScreenPreview() {
    val state = YomicUiState(
        mangaList = DemoDataRepository.createMangaList(),
        activityUpdates = DemoDataRepository.createInitialUpdates()
    )
    YomicTheme(darkTheme = true) {
        Scaffold(
            containerColor = YomicThemeTokens.colors.canvas,
            bottomBar = {
                YomicBottomNavigationBar(
                    currentRoute = YomicRoutes.UPDATES,
                    newUpdatesCount = 4,
                    onSelectTab = {}
                )
            }
        ) { innerPadding ->
            Box(modifier = Modifier.fillMaxSize().padding(bottom = innerPadding.calculateBottomPadding())) {
                UpdatesScreen(
                    state = state,
                    onTriggerSync = {},
                    onClearAll = {},
                    onOpenDetail = {},
                    onQuickRead = { _, _ -> }
                )
            }
        }
    }
}
