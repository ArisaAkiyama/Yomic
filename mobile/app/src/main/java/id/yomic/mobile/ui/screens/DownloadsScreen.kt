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
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExtendedFloatingActionButton
import androidx.compose.material3.FloatingActionButtonDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LinearProgressIndicator
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
import id.yomic.mobile.model.DownloadQueueItem
import id.yomic.mobile.model.DownloadStatus
import id.yomic.mobile.model.MangaItem
import id.yomic.mobile.model.YomicUiState
import id.yomic.mobile.ui.components.MangaCoverArtwork
import id.yomic.mobile.ui.components.YomicConfirmDialog
import id.yomic.mobile.ui.components.YomicEmptyState
import id.yomic.mobile.ui.i18n.yomicStrings
import id.yomic.mobile.ui.theme.YomicIcons
import id.yomic.mobile.ui.theme.YomicTheme
import id.yomic.mobile.ui.theme.YomicThemeTokens

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun DownloadsScreen(
    state: YomicUiState,
    onBack: () -> Unit,
    onPauseAll: () -> Unit,
    onResumeAll: () -> Unit,
    onClearCompleted: () -> Unit,
    onTogglePause: (String) -> Unit,
    onRemoveEntry: (String) -> Unit,
    onOpenDetail: (String) -> Unit,
    onQuickRead: (String, Double) -> Unit
) {
    val tokens = YomicThemeTokens.colors
    val s = yomicStrings
    var showClearDialog by remember { mutableStateOf(false) }

    val hasPaused = state.downloads.any { it.status == DownloadStatus.PAUSED }
    val hasActive = state.downloads.any { it.status == DownloadStatus.DOWNLOADING || it.status == DownloadStatus.QUEUED }
    val hasCompleted = state.downloads.any { it.status == DownloadStatus.COMPLETED }

    Scaffold(
        containerColor = tokens.canvas,
        topBar = {
            TopAppBar(
                colors = TopAppBarDefaults.topAppBarColors(containerColor = tokens.canvas),
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(YomicIcons.ArrowBack, contentDescription = "Back", tint = tokens.inkPrimary, modifier = Modifier.size(21.dp))
                    }
                },
                title = {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text(s.navDownloads, style = MaterialTheme.typography.titleLarge, color = tokens.inkPrimary)
                        Spacer(Modifier.width(7.dp))
                        Text("(${state.downloads.size})", style = MaterialTheme.typography.labelLarge, color = tokens.inkMuted)
                    }
                },
                actions = {
                    if (hasCompleted) {
                        IconButton(onClick = { showClearDialog = true }) {
                            Icon(
                                YomicIcons.Trash,
                                contentDescription = s.clearCompleted,
                                tint = tokens.inkSecondary,
                                modifier = Modifier.size(19.dp)
                            )
                        }
                    }
                }
            )
        },
        floatingActionButton = {
            if (hasActive || hasPaused) {
                ExtendedFloatingActionButton(
                    onClick = if (hasActive) onPauseAll else onResumeAll,
                    containerColor = tokens.accent,
                    contentColor = tokens.onAccent,
                    shape = RoundedCornerShape(14.dp),
                    elevation = FloatingActionButtonDefaults.elevation(
                        defaultElevation = 0.dp,
                        pressedElevation = 0.dp,
                        focusedElevation = 0.dp,
                        hoveredElevation = 0.dp
                    ),
                    icon = {
                        Icon(
                            imageVector = if (hasActive) YomicIcons.Pause else YomicIcons.Play,
                            contentDescription = if (hasActive) s.pauseAll else s.resumeAll,
                            modifier = Modifier.size(16.dp)
                        )
                    },
                    text = {
                        Text(
                            text = if (hasActive) (if (s.isEn) "Pause" else "Jeda") else (if (s.isEn) "Resume" else "Lanjutkan"),
                            fontWeight = FontWeight.SemiBold
                        )
                    }
                )
            }
        }
    ) { innerPadding ->
        if (state.downloads.isEmpty()) {
            Box(modifier = Modifier.fillMaxSize().padding(innerPadding)) {
                YomicEmptyState(
                    icon = YomicIcons.Download,
                    title = s.downloadsEmptyTitle,
                    description = s.downloadsEmptyDesc
                )
            }
        } else {
            LazyColumn(
                contentPadding = PaddingValues(top = 4.dp, bottom = 88.dp),
                modifier = Modifier
                    .fillMaxSize()
                    .padding(innerPadding)
            ) {
                items(state.downloads, key = { it.id }) { dl ->
                    val manga = state.mangaList.find { it.id == dl.mangaId }
                    DownloadItemCard(
                        item = dl,
                        manga = manga,
                        onOpenDetail = { onOpenDetail(dl.mangaId) },
                        onTogglePause = { onTogglePause(dl.id) },
                        onRemove = { onRemoveEntry(dl.id) },
                        onRead = { onQuickRead(dl.mangaId, dl.chapterNumber) }
                    )
                }
            }
        }
    }

    if (showClearDialog) {
        YomicConfirmDialog(
            title = s.clearCompleted,
            message = if (s.isEn) "Remove completed entries from the download list? Offline files remain safe." else "Bersihkan daftar unduhan yang telah selesai? Berkas offline tetap aman.",
            confirmText = s.confirm,
            cancelText = s.cancel,
            isDanger = true,
            onConfirm = {
                showClearDialog = false
                onClearCompleted()
            },
            onDismiss = { showClearDialog = false }
        )
    }
}

@Composable
private fun DownloadItemCard(
    item: DownloadQueueItem,
    manga: MangaItem?,
    onOpenDetail: () -> Unit,
    onTogglePause: () -> Unit,
    onRemove: () -> Unit,
    onRead: () -> Unit
) {
    val tokens = YomicThemeTokens.colors
    val s = yomicStrings
    val isDone = item.status == DownloadStatus.COMPLETED
    val isPaused = item.status == DownloadStatus.PAUSED

    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = if (isDone) onRead else onOpenDetail)
            .padding(horizontal = 16.dp, vertical = 10.dp),
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
        Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Text(
                text = item.mangaTitle,
                style = MaterialTheme.typography.bodyLarge,
                fontWeight = FontWeight.Medium,
                color = tokens.inkPrimary,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis
            )
            Text(
                text = "${item.chapterLabel} · ${item.sourceName}",
                style = MaterialTheme.typography.bodySmall,
                color = tokens.inkSecondary
            )
            if (isDone) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(5.dp)
                ) {
                    Icon(
                        imageVector = YomicIcons.DownloadDone,
                        contentDescription = null,
                        tint = tokens.inkMuted,
                        modifier = Modifier.size(13.dp)
                    )
                    Text(
                        text = "${item.sizeText} · ${s.statusSaved}",
                        style = MaterialTheme.typography.labelSmall,
                        color = tokens.inkMuted
                    )
                }
            } else {
                LinearProgressIndicator(
                    progress = { item.progressPercent / 100f },
                    color = if (isPaused) tokens.amber else tokens.accent,
                    trackColor = tokens.borderSubtle,
                    gapSize = 0.dp,
                    drawStopIndicator = {},
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(4.dp)
                        .clip(RoundedCornerShape(99.dp))
                )
                Text(
                    text = if (isPaused) "${s.statusPaused} (${item.progressPercent}%)" else "${item.progressPercent}% · ${item.speedText}",
                    style = MaterialTheme.typography.labelSmall,
                    color = tokens.inkMuted
                )
            }
        }
        if (!isDone) {
            IconButton(onClick = onTogglePause, modifier = Modifier.size(36.dp)) {
                Icon(
                    imageVector = if (isPaused) YomicIcons.Play else YomicIcons.Pause,
                    contentDescription = "Pause/Resume",
                    tint = tokens.inkSecondary,
                    modifier = Modifier.size(15.dp)
                )
            }
        }
        IconButton(onClick = onRemove, modifier = Modifier.size(34.dp)) {
            Icon(YomicIcons.Trash, contentDescription = s.delete, tint = tokens.inkMuted, modifier = Modifier.size(17.dp))
        }
    }
}

@Preview(name = "Downloads Carbon Dark", showBackground = true, widthDp = 390, heightDp = 820)
@Composable
fun DownloadsScreenPreview() {
    val state = YomicUiState(
        mangaList = DemoDataRepository.createMangaList(),
        downloads = DemoDataRepository.createInitialDownloads()
    )
    YomicTheme(darkTheme = true) {
        DownloadsScreen(
            state = state,
            onBack = {},
            onPauseAll = {},
            onResumeAll = {},
            onClearCompleted = {},
            onTogglePause = {},
            onRemoveEntry = {},
            onOpenDetail = {},
            onQuickRead = { _, _ -> }
        )
    }
}
