package id.yomic.mobile.ui.screens

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.animateContentSize
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
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
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExtendedFloatingActionButton
import androidx.compose.material3.FloatingActionButtonDefaults
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FilterChipDefaults
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.derivedStateOf
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import id.yomic.mobile.data.DemoDataRepository
import id.yomic.mobile.model.ChapterFilterMode
import id.yomic.mobile.model.ChapterItem
import id.yomic.mobile.model.MalSearchResult
import id.yomic.mobile.model.MangaItem
import id.yomic.mobile.model.MangaStatus
import id.yomic.mobile.model.YomicUiState
import id.yomic.mobile.ui.components.MangaCoverArtwork
import id.yomic.mobile.ui.components.SourceAvatarBadge
import id.yomic.mobile.ui.components.YomicConfirmDialog
import id.yomic.mobile.ui.i18n.yomicStrings
import id.yomic.mobile.ui.theme.StatusCompletedBlue
import id.yomic.mobile.ui.theme.StatusHiatusAmber
import id.yomic.mobile.ui.theme.StatusOngoingRed
import id.yomic.mobile.ui.theme.YomicIcons
import id.yomic.mobile.ui.theme.YomicTheme
import id.yomic.mobile.ui.theme.YomicThemeTokens

@OptIn(ExperimentalMaterial3Api::class, ExperimentalLayoutApi::class)
@Composable
fun MangaDetailScreen(
    mangaId: String,
    state: YomicUiState,
    onBack: () -> Unit,
    onToggleInLibrary: (String) -> Unit,
    onOpenReader: (String, Double) -> Unit,
    onDownloadUnread: (String) -> Unit,
    onDownloadSingle: (String, Double) -> Unit,
    onDeleteSingleDownload: (String, Double) -> Unit,
    onDeleteAllDownloads: (String) -> Unit,
    onToggleBookmark: (String, Double) -> Unit,
    onToggleChapterRead: (String, Double) -> Unit,
    onMarkPreviousRead: (String, Double) -> Unit,
    onChapterFilterChange: (ChapterFilterMode) -> Unit,
    onToggleChapterOrder: () -> Unit,
    onSaveMalTracking: (String, String, Int, Int, Int, String) -> Unit,
    onUnbindMal: (String) -> Unit,
    onOpenSettings: () -> Unit,
    onToast: (String) -> Unit,
    onMarkAllRead: (String) -> Unit = {}
) {
    val tokens = YomicThemeTokens.colors
    val s = yomicStrings
    val manga = state.mangaList.find { it.id == mangaId } ?: return

    var isSynopsisExpanded by remember { mutableStateOf(false) }
    var isFilterSheetOpen by remember { mutableStateOf(false) }
    var isMalSheetOpen by remember { mutableStateOf(false) }
    var showDeleteAllDlDialog by remember { mutableStateOf(false) }
    var showCoverLightbox by remember { mutableStateOf(false) }
    var showTopOverflow by remember { mutableStateOf(false) }
    var selectedChapterMenu by remember { mutableStateOf<ChapterItem?>(null) }

    val latestChapterNumber = remember(manga.chapters) {
        manga.chapters.maxOfOrNull { it.number } ?: 0.0
    }

    val filteredChapters = remember(manga.chapters, state.detailChapterFilter, state.detailChapterAsc) {
        val base = when (state.detailChapterFilter) {
            ChapterFilterMode.ALL -> manga.chapters
            ChapterFilterMode.UNREAD -> manga.chapters.filter { !it.isRead }
            ChapterFilterMode.BOOKMARKED -> manga.chapters.filter { it.isBookmarked }
        }
        if (state.detailChapterAsc) base.sortedBy { it.number } else base.sortedByDescending { it.number }
    }

    val statusColor = when (manga.status) {
        MangaStatus.ONGOING -> StatusOngoingRed
        MangaStatus.COMPLETED -> StatusCompletedBlue
        MangaStatus.HIATUS -> StatusHiatusAmber
    }
    val statusText = when (manga.status) {
        MangaStatus.ONGOING -> s.ongoing
        MangaStatus.COMPLETED -> if (s.isEn) "Completed" else "Tamat Terbit"
        MangaStatus.HIATUS -> s.hiatus
    }
    val matchedSource = remember(state.extensions, manga.sourceId, manga.sourceName) {
        state.extensions.find {
            it.id.equals(manga.sourceId, ignoreCase = true) ||
                it.name.equals(manga.sourceName, ignoreCase = true)
        }
    }

    val resumeChapter = remember(manga) {
        manga.chapters.filter { !it.isRead }.minByOrNull { it.number }?.number ?: manga.lastReadChapter
    }
    val resumeLabel = if (resumeChapter % 1.0 == 0.0) resumeChapter.toInt().toString() else resumeChapter.toString()

    val listState = rememberLazyListState()
    val isTopBarCollapsed by remember {
        derivedStateOf {
            listState.firstVisibleItemIndex > 0 || listState.firstVisibleItemScrollOffset > 140
        }
    }
    val topBarBg by animateColorAsState(
        targetValue = if (isTopBarCollapsed) tokens.canvas else Color.Transparent,
        label = "detailTopBarBg"
    )

    Scaffold(
        containerColor = tokens.canvas,
        floatingActionButton = {
            ExtendedFloatingActionButton(
                onClick = { onOpenReader(manga.id, resumeChapter) },
                containerColor = tokens.accent,
                contentColor = tokens.onAccent,
                shape = RoundedCornerShape(14.dp),
                elevation = FloatingActionButtonDefaults.elevation(
                    defaultElevation = 0.dp,
                    pressedElevation = 0.dp,
                    focusedElevation = 0.dp,
                    hoveredElevation = 0.dp
                ),
                icon = { Icon(YomicIcons.Play, contentDescription = null, modifier = Modifier.size(18.dp)) },
                text = {
                    Text(
                        text = "${s.continueReading} Ch. $resumeLabel",
                        fontWeight = FontWeight.Bold
                    )
                }
            )
        }
    ) { innerPadding ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(tokens.canvas)
        ) {
            LazyColumn(
                state = listState,
                modifier = Modifier.fillMaxSize(),
                contentPadding = PaddingValues(bottom = innerPadding.calculateBottomPadding() + 88.dp)
            ) {
                // 1. Ambient Gradient Header + 2-Column Mobile Hero
                item(key = "hero") {
                    Box(modifier = Modifier.fillMaxWidth()) {
                        // Ambient Cover Gradient Backdrop (Mirrors MangaDetailView.axaml)
                        Box(
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(270.dp)
                                .background(
                                    Brush.verticalGradient(
                                        colors = listOf(
                                            Color(manga.coverPalette.second).copy(alpha = if (tokens.isDark) 0.45f else 0.22f),
                                            Color(manga.coverPalette.first).copy(alpha = if (tokens.isDark) 0.35f else 0.10f),
                                            tokens.canvas
                                        )
                                    )
                                )
                        )

                        Column(
                            modifier = Modifier
                                .fillMaxWidth()
                                .statusBarsPadding()
                                .padding(top = 52.dp)
                        ) {
                            // 2-Column Cover + Vertical Meta Stack (1:1 Mirror of Yomic Windows Desktop v1-meta-stack)
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(horizontal = 16.dp, vertical = 10.dp),
                            horizontalArrangement = Arrangement.spacedBy(14.dp),
                            verticalAlignment = Alignment.Bottom
                        ) {
                            MangaCoverArtwork(
                                manga = manga,
                                cornerRadius = 10.dp,
                                blurCover = state.settings.blurExplicitCovers && manga.isExplicit,
                                modifier = Modifier
                                    .size(width = 112.dp, height = 168.dp)
                                    .clickable { showCoverLightbox = true }
                            )

                            Column(
                                modifier = Modifier.weight(1f),
                                verticalArrangement = Arrangement.spacedBy(8.dp)
                            ) {
                                Text(
                                    text = manga.title,
                                    style = MaterialTheme.typography.titleLarge,
                                    color = tokens.inkPrimary,
                                    maxLines = 3,
                                    overflow = TextOverflow.Ellipsis
                                )
                                // 1. Author (information-line icon)
                                Row(
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.spacedBy(7.dp)
                                ) {
                                    Icon(
                                        imageVector = YomicIcons.Info,
                                        contentDescription = null,
                                        tint = tokens.inkSecondary,
                                        modifier = Modifier.size(15.dp)
                                    )
                                    Text(
                                        text = if (manga.artist.isNotBlank() && manga.artist != manga.author) {
                                            "${manga.author} (${manga.artist})"
                                        } else {
                                            manga.author
                                        },
                                        style = MaterialTheme.typography.bodySmall,
                                        color = tokens.inkSecondary,
                                        maxLines = 1,
                                        overflow = TextOverflow.Ellipsis
                                    )
                                }
                                // 2. Status (time-line icon + Desktop StatusToColorConverter color)
                                Row(
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.spacedBy(7.dp)
                                ) {
                                    Icon(
                                        imageVector = YomicIcons.Clock,
                                        contentDescription = null,
                                        tint = statusColor,
                                        modifier = Modifier.size(15.dp)
                                    )
                                    Text(
                                        text = statusText,
                                        color = statusColor,
                                        style = MaterialTheme.typography.bodySmall,
                                        fontWeight = FontWeight.SemiBold
                                    )
                                }
                                // 3. Source (Real PNG Source Logo 18dp + Source Name)
                                Row(
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.spacedBy(7.dp)
                                ) {
                                    SourceAvatarBadge(
                                        name = manga.sourceName,
                                        accentColorHex = matchedSource?.accentColorHex ?: 0xFF2563EB,
                                        size = 18.dp
                                    )
                                    Text(
                                        text = manga.sourceName,
                                        color = tokens.inkSecondary,
                                        style = MaterialTheme.typography.bodySmall,
                                        maxLines = 1,
                                        overflow = TextOverflow.Ellipsis
                                    )
                                }
                            }
                        }
                    }
                }
            }

            // 2. Mobile 5-Action Bar (Library, Track MAL, Browser, Download, Refresh)
            item(key = "actions") {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 8.dp, vertical = 8.dp),
                    horizontalArrangement = Arrangement.SpaceEvenly
                ) {
                    DetailActionItem(
                        icon = if (manga.inLibrary) YomicIcons.BookmarkFilled else YomicIcons.Bookmark,
                        label = if (manga.inLibrary) s.inLibrary else s.addToLibrary,
                        active = manga.inLibrary,
                        onClick = { onToggleInLibrary(manga.id) },
                        modifier = Modifier.weight(1f)
                    )
                    DetailActionItem(
                        icon = YomicIcons.CheckCircle,
                        label = if (s.isEn) "Track" else "Lacak",
                        active = manga.malTracked,
                        onClick = { isMalSheetOpen = true },
                        modifier = Modifier.weight(1f)
                    )
                    DetailActionItem(
                        icon = YomicIcons.Globe,
                        label = s.browser,
                        active = false,
                        onClick = { onToast("${manga.sourceName}: ${manga.title}") },
                        modifier = Modifier.weight(1f)
                    )
                    DetailActionItem(
                        icon = YomicIcons.Download,
                        label = s.download,
                        active = manga.downloadedCount > 0,
                        onClick = { onDownloadUnread(manga.id) },
                        modifier = Modifier.weight(1f)
                    )
                    DetailActionItem(
                        icon = YomicIcons.Updates,
                        label = s.refresh,
                        active = false,
                        onClick = { onToast(if (s.isEn) "Metadata refreshed." else "Metadata komik disegarkan.") },
                        modifier = Modifier.weight(1f)
                    )
                }
            }

            // 3. Genre Chips + Expandable Synopsis
            item(key = "synopsis") {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 16.dp, vertical = 6.dp)
                        .animateContentSize(),
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    if (isSynopsisExpanded) {
                        FlowRow(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.spacedBy(7.dp),
                            verticalArrangement = Arrangement.spacedBy(7.dp)
                        ) {
                            manga.genres.forEach { genre ->
                                Box(
                                    modifier = Modifier
                                        .clip(RoundedCornerShape(8.dp))
                                        .background(tokens.surfaceAlt)
                                        .border(0.8.dp, tokens.borderSubtle, RoundedCornerShape(8.dp))
                                        .padding(horizontal = 10.dp, vertical = 5.dp)
                                ) {
                                    Text(
                                        text = genre,
                                        color = tokens.inkSecondary,
                                        style = MaterialTheme.typography.labelMedium
                                    )
                                }
                            }
                        }
                    } else {
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .horizontalScroll(rememberScrollState()),
                            horizontalArrangement = Arrangement.spacedBy(7.dp)
                        ) {
                            manga.genres.forEach { genre ->
                                Box(
                                    modifier = Modifier
                                        .clip(RoundedCornerShape(8.dp))
                                        .background(tokens.surfaceAlt)
                                        .border(0.8.dp, tokens.borderSubtle, RoundedCornerShape(8.dp))
                                        .padding(horizontal = 10.dp, vertical = 5.dp)
                                ) {
                                    Text(
                                        text = genre,
                                        color = tokens.inkSecondary,
                                        style = MaterialTheme.typography.labelMedium
                                    )
                                }
                            }
                        }
                    }

                    Text(
                        text = manga.synopsis,
                        color = tokens.inkSecondary,
                        style = MaterialTheme.typography.bodyMedium,
                        maxLines = if (isSynopsisExpanded) Int.MAX_VALUE else 3,
                        overflow = TextOverflow.Ellipsis,
                        modifier = Modifier.clickable { isSynopsisExpanded = !isSynopsisExpanded }
                    )

                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(8.dp))
                            .clickable { isSynopsisExpanded = !isSynopsisExpanded }
                            .padding(vertical = 2.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        Icon(
                            imageVector = if (isSynopsisExpanded) YomicIcons.ChevronUp else YomicIcons.ChevronDown,
                            contentDescription = "Expand Synopsis",
                            tint = tokens.accent,
                            modifier = Modifier.size(20.dp)
                        )
                    }
                }
            }

            // 4. Chapters Section Header
            item(key = "ch_header") {
                HorizontalDivider(color = tokens.borderSubtle, modifier = Modifier.padding(top = 6.dp))
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 16.dp, vertical = 10.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        Text(s.chapters, style = MaterialTheme.typography.titleMedium, color = tokens.inkPrimary)
                        Text(
                            text = "(${filteredChapters.size})",
                            style = MaterialTheme.typography.labelLarge,
                            color = tokens.inkMuted
                        )
                    }
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        IconButton(onClick = { isFilterSheetOpen = true }, modifier = Modifier.size(36.dp)) {
                            Icon(
                                YomicIcons.Filter,
                                contentDescription = s.tabFilter,
                                tint = if (state.detailChapterFilter != ChapterFilterMode.ALL) tokens.accent else tokens.inkSecondary,
                                modifier = Modifier.size(19.dp)
                            )
                        }
                        IconButton(onClick = onToggleChapterOrder, modifier = Modifier.size(36.dp)) {
                            Icon(YomicIcons.Sort, contentDescription = s.tabSort, tint = tokens.inkSecondary, modifier = Modifier.size(19.dp))
                        }
                    }
                }
            }

            // 5. Chapters List
            items(filteredChapters, key = { it.id }) { chapter ->
                val isNewRelease = !chapter.isRead && chapter.number == latestChapterNumber
                ChapterRowItem(
                    chapter = chapter,
                    isNewRelease = isNewRelease,
                    newBadgeText = s.newBadge,
                    onOpen = { onOpenReader(manga.id, chapter.number) },
                    onToggleBookmark = { onToggleBookmark(manga.id, chapter.number) },
                    onDownloadClick = {
                        if (chapter.isDownloaded) onDeleteSingleDownload(manga.id, chapter.number)
                        else onDownloadSingle(manga.id, chapter.number)
                    },
                    onMoreClick = { selectedChapterMenu = chapter }
                )
            }
        }

            // Sticky Collapsing TopAppBar (Back button & title remain visible when scrolling chapters)
            Column(
                modifier = Modifier
                    .align(Alignment.TopCenter)
                    .fillMaxWidth()
                    .background(topBarBg)
                    .statusBarsPadding()
            ) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(52.dp)
                        .padding(horizontal = 4.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    IconButton(onClick = onBack) {
                        Icon(
                            YomicIcons.ArrowBack,
                            contentDescription = "Back",
                            tint = tokens.inkPrimary,
                            modifier = Modifier.size(22.dp)
                        )
                    }
                    Box(modifier = Modifier.weight(1f)) {
                        androidx.compose.animation.AnimatedVisibility(
                            visible = isTopBarCollapsed,
                            enter = fadeIn(),
                            exit = fadeOut()
                        ) {
                            Text(
                                text = manga.title,
                                style = MaterialTheme.typography.titleMedium,
                                color = tokens.inkPrimary,
                                maxLines = 1,
                                overflow = TextOverflow.Ellipsis,
                                modifier = Modifier.padding(end = 8.dp)
                            )
                        }
                    }
                    IconButton(onClick = { onDownloadUnread(manga.id) }) {
                        Icon(
                            YomicIcons.Download,
                            contentDescription = s.download,
                            tint = tokens.inkPrimary,
                            modifier = Modifier.size(20.dp)
                        )
                    }
                    Box {
                        IconButton(onClick = { showTopOverflow = true }) {
                            Icon(
                                YomicIcons.MoreVert,
                                contentDescription = "More",
                                tint = tokens.inkPrimary,
                                modifier = Modifier.size(20.dp)
                            )
                        }
                        DropdownMenu(
                            expanded = showTopOverflow,
                            onDismissRequest = { showTopOverflow = false },
                            containerColor = tokens.surface
                        ) {
                            DropdownMenuItem(
                                text = {
                                    Text(
                                        text = if (s.isEn) "Mark all as read" else "Tandai semua dibaca",
                                        color = tokens.inkPrimary
                                    )
                                },
                                onClick = {
                                    showTopOverflow = false
                                    onMarkAllRead(manga.id)
                                }
                            )
                            DropdownMenuItem(
                                text = {
                                    Text(
                                        text = if (s.isEn) "Refresh metadata" else "Segarkan metadata",
                                        color = tokens.inkPrimary
                                    )
                                },
                                onClick = {
                                    showTopOverflow = false
                                    onToast(if (s.isEn) "Metadata refreshed." else "Metadata komik disegarkan.")
                                }
                            )
                            if (manga.downloadedCount > 0) {
                                DropdownMenuItem(
                                    text = {
                                        Text(
                                            text = if (s.isEn) "Delete all downloads" else "Hapus semua unduhan",
                                            color = tokens.rose
                                        )
                                    },
                                    onClick = {
                                        showTopOverflow = false
                                        showDeleteAllDlDialog = true
                                    }
                                )
                            }
                        }
                    }
                }
                if (isTopBarCollapsed) {
                    HorizontalDivider(color = tokens.borderSubtle, thickness = 0.75.dp)
                }
            }
        }
    }

    // Chapter Filter BottomSheet
    if (isFilterSheetOpen) {
        ModalBottomSheet(
            onDismissRequest = { isFilterSheetOpen = false },
            containerColor = tokens.surface
        ) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp)
                    .padding(bottom = 26.dp),
                verticalArrangement = Arrangement.spacedBy(4.dp)
            ) {
                Text(
                    text = s.chapters,
                    style = MaterialTheme.typography.titleMedium,
                    color = tokens.inkPrimary,
                    modifier = Modifier.padding(horizontal = 8.dp, vertical = 6.dp)
                )
                SheetCheckOptionRow(s.allChapters, state.detailChapterFilter == ChapterFilterMode.ALL) {
                    onChapterFilterChange(ChapterFilterMode.ALL)
                    isFilterSheetOpen = false
                }
                SheetCheckOptionRow(s.filterUnread, state.detailChapterFilter == ChapterFilterMode.UNREAD) {
                    onChapterFilterChange(ChapterFilterMode.UNREAD)
                    isFilterSheetOpen = false
                }
                SheetCheckOptionRow(s.bookmarked, state.detailChapterFilter == ChapterFilterMode.BOOKMARKED) {
                    onChapterFilterChange(ChapterFilterMode.BOOKMARKED)
                    isFilterSheetOpen = false
                }
                if (manga.downloadedCount > 0) {
                    HorizontalDivider(color = tokens.borderSubtle, modifier = Modifier.padding(vertical = 6.dp))
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(10.dp))
                            .clickable {
                                isFilterSheetOpen = false
                                showDeleteAllDlDialog = true
                            }
                            .padding(horizontal = 10.dp, vertical = 12.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        Icon(YomicIcons.Trash, contentDescription = null, tint = tokens.rose, modifier = Modifier.size(18.dp))
                        Text(
                            text = if (s.isEn) "Delete All Downloaded Chapters (${manga.downloadedCount})" else "Hapus Semua Unduhan (${manga.downloadedCount})",
                            style = MaterialTheme.typography.bodyMedium,
                            color = tokens.rose,
                            fontWeight = FontWeight.Medium
                        )
                    }
                }
            }
        }
    }

    // Chapter More Options BottomSheet
    selectedChapterMenu?.let { ch ->
        ModalBottomSheet(
            onDismissRequest = { selectedChapterMenu = null },
            containerColor = tokens.surface
        ) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp)
                    .padding(bottom = 28.dp),
                verticalArrangement = Arrangement.spacedBy(4.dp)
            ) {
                Text(
                    text = "Chapter ${ch.formattedNumber}${if (ch.title.isNotBlank()) " — ${ch.title}" else ""}",
                    style = MaterialTheme.typography.titleSmall,
                    color = tokens.inkPrimary,
                    modifier = Modifier.padding(horizontal = 10.dp, vertical = 6.dp)
                )
                SheetCheckOptionRow(
                    label = if (ch.isRead) {
                        if (s.isEn) "Mark as Unread" else "Tandai Belum Dibaca"
                    } else {
                        if (s.isEn) "Mark as Read" else "Tandai Sudah Dibaca"
                    },
                    selected = false
                ) {
                    onToggleChapterRead(manga.id, ch.number)
                    selectedChapterMenu = null
                }
                SheetCheckOptionRow(
                    label = if (s.isEn) "Mark Previous Chapters as Read" else "Tandai Bab Sebelumnya Sudah Dibaca",
                    selected = false
                ) {
                    onMarkPreviousRead(manga.id, ch.number)
                    selectedChapterMenu = null
                }
                SheetCheckOptionRow(
                    label = if (ch.isBookmarked) {
                        if (s.isEn) "Remove Bookmark" else "Hapus Penanda"
                    } else {
                        if (s.isEn) "Bookmark Chapter" else "Tandai Chapter"
                    },
                    selected = ch.isBookmarked
                ) {
                    onToggleBookmark(manga.id, ch.number)
                    selectedChapterMenu = null
                }
            }
        }
    }

    // MyAnimeList Tracker BottomSheet
    if (isMalSheetOpen) {
        MalTrackerBottomSheet(
            manga = manga,
            isMalConnected = state.settings.isMalConnected,
            malUser = state.settings.malConnectedUser,
            onDismiss = { isMalSheetOpen = false },
            onGoToSettings = {
                isMalSheetOpen = false
                onOpenSettings()
            },
            onSave = { st, ch, score, malId, malTitle ->
                onSaveMalTracking(manga.id, st, ch, score, malId, malTitle)
                isMalSheetOpen = false
            },
            onUnbind = {
                onUnbindMal(manga.id)
                isMalSheetOpen = false
            }
        )
    }

    if (showDeleteAllDlDialog) {
        YomicConfirmDialog(
            title = if (s.isEn) "Delete All Downloads?" else "Hapus Semua Unduhan?",
            message = if (s.isEn) "Remove all downloaded chapters for ${manga.title}?" else "Hapus semua bab yang telah diunduh untuk ${manga.title}?",
            confirmText = s.delete,
            cancelText = s.cancel,
            isDanger = true,
            onConfirm = {
                showDeleteAllDlDialog = false
                onDeleteAllDownloads(manga.id)
            },
            onDismiss = { showDeleteAllDlDialog = false }
        )
    }

    // Fullscreen Cover Lightbox (Mihon-style tap-cover preview)
    if (showCoverLightbox) {
        Dialog(
            onDismissRequest = { showCoverLightbox = false },
            properties = DialogProperties(usePlatformDefaultWidth = false)
        ) {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .background(Color(0xEB08080A))
                    .clickable { showCoverLightbox = false }
                    .padding(24.dp),
                contentAlignment = Alignment.Center
            ) {
                Column(
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.spacedBy(14.dp)
                ) {
                    MangaCoverArtwork(
                        manga = manga,
                        cornerRadius = 14.dp,
                        blurCover = false,
                        modifier = Modifier.size(width = 250.dp, height = 375.dp)
                    )
                    Text(
                        text = manga.title,
                        style = MaterialTheme.typography.titleMedium,
                        color = Color.White,
                        maxLines = 2,
                        overflow = TextOverflow.Ellipsis
                    )
                    Text(
                        text = if (s.isEn) "Tap anywhere to close" else "Ketuk di mana saja untuk menutup",
                        style = MaterialTheme.typography.labelSmall,
                        color = Color.White.copy(alpha = 0.6f)
                    )
                }
            }
        }
    }
}

@Composable
private fun DetailActionItem(
    icon: ImageVector,
    label: String,
    active: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    val tokens = YomicThemeTokens.colors
    val tint = if (active) tokens.accent else tokens.inkSecondary
    Column(
        modifier = modifier
            .clip(RoundedCornerShape(10.dp))
            .clickable(onClick = onClick)
            .padding(vertical = 8.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(4.dp)
    ) {
        Icon(icon, contentDescription = label, tint = tint, modifier = Modifier.size(22.dp))
        Text(
            text = label,
            color = tint,
            style = MaterialTheme.typography.labelMedium,
            fontWeight = if (active) FontWeight.Bold else FontWeight.Medium,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis
        )
    }
}

@Composable
private fun ChapterRowItem(
    chapter: ChapterItem,
    isNewRelease: Boolean,
    newBadgeText: String,
    onOpen: () -> Unit,
    onToggleBookmark: () -> Unit,
    onDownloadClick: () -> Unit,
    onMoreClick: () -> Unit
) {
    val tokens = YomicThemeTokens.colors
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onOpen)
            .padding(horizontal = 16.dp, vertical = 10.dp)
            .alpha(if (chapter.isRead) 0.52f else 1f),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(3.dp)) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(7.dp)
            ) {
                Text(
                    text = "Chapter ${chapter.formattedNumber}${if (chapter.title.isNotBlank()) " — ${chapter.title}" else ""}",
                    style = MaterialTheme.typography.bodyMedium,
                    fontWeight = if (chapter.isRead) FontWeight.Normal else FontWeight.SemiBold,
                    color = if (chapter.isBookmarked) tokens.accent else tokens.inkPrimary,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.weight(1f, fill = false)
                )
                if (isNewRelease) {
                    Box(
                        modifier = Modifier
                            .clip(RoundedCornerShape(4.dp))
                            .background(tokens.accentTint)
                            .padding(horizontal = 6.dp, vertical = 1.5.dp)
                    ) {
                        Text(newBadgeText, color = tokens.accent, fontSize = 10.sp, fontWeight = FontWeight.Bold)
                    }
                }
            }
            val sRow = yomicStrings
            val pageProgress = if (!chapter.isRead && chapter.lastPageRead > 1) {
                " • ${sRow.pageLabel} ${chapter.lastPageRead}/${chapter.totalPages}"
            } else ""
            Text(
                text = "${chapter.releaseDate}${if (chapter.scanlator.isNotBlank()) " • ${chapter.scanlator}" else ""}$pageProgress",
                style = MaterialTheme.typography.labelSmall,
                color = tokens.inkMuted
            )
        }
        IconButton(onClick = onToggleBookmark, modifier = Modifier.size(34.dp)) {
            Icon(
                imageVector = if (chapter.isBookmarked) YomicIcons.BookmarkFilled else YomicIcons.Bookmark,
                contentDescription = "Bookmark",
                tint = if (chapter.isBookmarked) tokens.accent else tokens.inkMuted,
                modifier = Modifier.size(17.dp)
            )
        }
        IconButton(onClick = onDownloadClick, modifier = Modifier.size(34.dp)) {
            Icon(
                imageVector = if (chapter.isDownloaded) YomicIcons.DownloadDone else YomicIcons.Download,
                contentDescription = "Download",
                tint = if (chapter.isDownloaded) tokens.emerald else tokens.inkMuted,
                modifier = Modifier.size(18.dp)
            )
        }
        IconButton(onClick = onMoreClick, modifier = Modifier.size(30.dp)) {
            Icon(YomicIcons.MoreVert, contentDescription = "More", tint = tokens.inkMuted, modifier = Modifier.size(17.dp))
        }
    }
    HorizontalDivider(color = tokens.borderSubtle.copy(alpha = 0.55f), modifier = Modifier.padding(horizontal = 16.dp))
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun MalTrackerBottomSheet(
    manga: MangaItem,
    isMalConnected: Boolean,
    malUser: String,
    onDismiss: () -> Unit,
    onGoToSettings: () -> Unit,
    onSave: (String, Int, Int, Int, String) -> Unit,
    onUnbind: () -> Unit
) {
    val tokens = YomicThemeTokens.colors
    ModalBottomSheet(
        onDismissRequest = onDismiss,
        containerColor = tokens.surface,
        sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    ) {
        MalTrackerSheetContent(
            manga = manga,
            isMalConnected = isMalConnected,
            malUser = malUser,
            onGoToSettings = onGoToSettings,
            onSave = onSave,
            onUnbind = onUnbind
        )
    }
}

@Composable
private fun MalTrackerSheetContent(
    manga: MangaItem,
    isMalConnected: Boolean,
    malUser: String,
    onGoToSettings: () -> Unit,
    onSave: (String, Int, Int, Int, String) -> Unit,
    onUnbind: () -> Unit,
    initialSearchMode: Boolean = !manga.malTracked
) {
    val tokens = YomicThemeTokens.colors
    val s = yomicStrings

    var isSearchMode by remember(manga.id, initialSearchMode) { mutableStateOf(initialSearchMode) }
    var searchQuery by remember(manga.id) { mutableStateOf(manga.title) }
    var searchResults by remember(manga.id) { mutableStateOf(DemoDataRepository.searchMalCatalog(manga.title)) }
    var boundEntry by remember(manga.id) {
        mutableStateOf(
            if (manga.malTracked) {
                MalSearchResult(
                    id = manga.malId.takeIf { it > 0 } ?: 144267,
                    title = manga.malTitle.ifBlank { manga.title },
                    mediaType = manga.type.name.lowercase().replaceFirstChar { it.uppercase() },
                    chapters = manga.totalChapters,
                    score = manga.rating,
                    accentColorHex = 0xFF2E51A2
                )
            } else null
        )
    }

    var selectedStatus by remember(manga.id) { mutableStateOf(manga.malStatus) }
    var chaptersRead by remember(manga.id) { mutableIntStateOf(manga.malChaptersRead.coerceAtLeast(manga.lastReadChapter.toInt())) }
    var selectedScore by remember(manga.id) { mutableIntStateOf(manga.malScore) }

    Column(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 20.dp)
            .padding(bottom = 28.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        if (!isMalConnected) {
            Text("MyAnimeList Tracker", style = MaterialTheme.typography.titleMedium, color = tokens.inkPrimary)
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(12.dp))
                    .background(tokens.amberBg)
                    .padding(14.dp),
                verticalArrangement = Arrangement.spacedBy(6.dp)
            ) {
                Text(s.malNotConnectedTitle, color = tokens.amber, fontWeight = FontWeight.Bold)
                Text(s.malNotConnectedDesc, color = tokens.inkSecondary, style = MaterialTheme.typography.bodySmall)
            }
            Button(
                onClick = onGoToSettings,
                colors = ButtonDefaults.buttonColors(
                    containerColor = tokens.accent,
                    contentColor = tokens.onAccent
                ),
                shape = RoundedCornerShape(10.dp),
                modifier = Modifier.fillMaxWidth()
            ) {
                Text(s.openSettings, color = tokens.onAccent)
            }
        } else if (isSearchMode) {
            // MODE 1: MAL Search & Bind (1:1 Mirror of Desktop manga-detail.ts)
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                if (manga.malTracked || boundEntry != null) {
                    IconButton(onClick = { isSearchMode = false }, modifier = Modifier.size(32.dp)) {
                        Icon(YomicIcons.ArrowBack, contentDescription = "Back", tint = tokens.inkPrimary, modifier = Modifier.size(19.dp))
                    }
                }
                Text(
                    text = if (s.isEn) "Search MyAnimeList" else "Cari di MyAnimeList",
                    style = MaterialTheme.typography.titleMedium,
                    color = tokens.inkPrimary
                )
            }

            Text(
                text = "${if (s.isEn) "Searching entry for" else "Mencari entri untuk"}: ${manga.title}",
                style = MaterialTheme.typography.bodySmall,
                color = tokens.inkSecondary,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis
            )

            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                OutlinedTextField(
                    value = searchQuery,
                    onValueChange = {
                        searchQuery = it
                        searchResults = DemoDataRepository.searchMalCatalog(it)
                    },
                    placeholder = {
                        Text(
                            text = if (s.isEn) "Search title on MAL..." else "Cari judul di MyAnimeList...",
                            fontSize = 13.sp
                        )
                    },
                    singleLine = true,
                    modifier = Modifier.weight(1f)
                )
                Button(
                    onClick = { searchResults = DemoDataRepository.searchMalCatalog(searchQuery) },
                    colors = ButtonDefaults.buttonColors(
                        containerColor = tokens.accent,
                        contentColor = tokens.onAccent
                    ),
                    shape = RoundedCornerShape(10.dp),
                    contentPadding = PaddingValues(horizontal = 14.dp, vertical = 14.dp)
                ) {
                    Text(if (s.isEn) "Search" else "Cari", color = tokens.onAccent, fontWeight = FontWeight.SemiBold, fontSize = 13.sp)
                }
            }

            Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
                searchResults.take(4).forEachIndexed { idx, entry ->
                    if (idx > 0) {
                        HorizontalDivider(color = tokens.borderSubtle, thickness = 0.7.dp)
                    }
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clickable {
                                boundEntry = entry
                                isSearchMode = false
                            }
                            .padding(vertical = 10.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        Box(
                            modifier = Modifier
                                .size(width = 38.dp, height = 52.dp)
                                .clip(RoundedCornerShape(6.dp))
                                .background(Color(entry.accentColorHex).copy(alpha = 0.85f)),
                            contentAlignment = Alignment.Center
                        ) {
                            Text(
                                text = entry.title.split(" ").take(2).mapNotNull { it.firstOrNull()?.uppercaseChar() }.joinToString(""),
                                color = Color.White,
                                fontWeight = FontWeight.SemiBold,
                                fontSize = 12.sp
                            )
                        }
                        Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                            Text(
                                text = entry.title,
                                style = MaterialTheme.typography.bodyMedium,
                                fontWeight = FontWeight.Medium,
                                color = tokens.inkPrimary,
                                maxLines = 1,
                                overflow = TextOverflow.Ellipsis
                            )
                            Text(
                                text = "MAL #${entry.id} · ${entry.mediaType} · ★ ${entry.score}",
                                style = MaterialTheme.typography.labelSmall,
                                color = tokens.inkMuted
                            )
                        }
                        Box(
                            modifier = Modifier
                                .clip(RoundedCornerShape(8.dp))
                                .background(tokens.accentTint)
                                .clickable {
                                    boundEntry = entry
                                    isSearchMode = false
                                }
                                .padding(horizontal = 12.dp, vertical = 6.dp)
                        ) {
                            Text(
                                text = if (s.isEn) "Select" else "Pilih",
                                color = tokens.accent,
                                fontSize = 12.sp,
                                fontWeight = FontWeight.SemiBold
                            )
                        }
                    }
                }
            }
        } else {
            // MODE 2: Edit Tracking Status (with Change Entry button)
            val activeMalId = boundEntry?.id ?: manga.malId
            val activeMalTitle = boundEntry?.title ?: manga.malTitle.ifBlank { manga.title }

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = if (s.isEn) "Tracking Status" else "Status Pelacakan",
                    style = MaterialTheme.typography.titleMedium,
                    color = tokens.inkPrimary
                )
                TextButton(onClick = { isSearchMode = true }) {
                    Text(if (s.isEn) "Change Entry" else "Ganti Entri", color = tokens.accent, fontSize = 12.5.sp)
                }
            }

            Text(
                text = "$activeMalTitle${if (activeMalId > 0) " · MAL #$activeMalId" else ""} · @$malUser",
                style = MaterialTheme.typography.bodySmall,
                color = tokens.inkSecondary,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis
            )

            Text(s.malStatusLabel, style = MaterialTheme.typography.labelLarge, color = tokens.inkPrimary)
            Row(
                modifier = Modifier.horizontalScroll(rememberScrollState()),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                listOf("Reading", "Completed", "On Hold", "Plan to Read", "Dropped").forEach { st ->
                    FilterChip(
                        selected = selectedStatus == st,
                        onClick = { selectedStatus = st },
                        label = { Text(st, fontSize = 12.sp) },
                        colors = FilterChipDefaults.filterChipColors(
                            selectedContainerColor = tokens.accentTint,
                            selectedLabelColor = tokens.accent
                        )
                    )
                }
            }

            // Chapter Stepper
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(s.malProgressLabel, style = MaterialTheme.typography.labelLarge, color = tokens.inkPrimary)
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    IconButton(
                        onClick = { if (chaptersRead > 0) chaptersRead-- },
                        modifier = Modifier.size(34.dp).clip(RoundedCornerShape(8.dp)).background(tokens.surfaceAlt)
                    ) {
                        Icon(YomicIcons.Minus, contentDescription = "-", tint = tokens.inkPrimary, modifier = Modifier.size(16.dp))
                    }
                    Text(
                        text = "Ch. $chaptersRead",
                        style = MaterialTheme.typography.titleSmall,
                        color = tokens.inkPrimary
                    )
                    IconButton(
                        onClick = { chaptersRead++ },
                        modifier = Modifier.size(34.dp).clip(RoundedCornerShape(8.dp)).background(tokens.surfaceAlt)
                    ) {
                        Icon(YomicIcons.Plus, contentDescription = "+", tint = tokens.inkPrimary, modifier = Modifier.size(16.dp))
                    }
                }
            }

            // Score 0..10 selector
            Text("${s.malScoreLabel}: ${if (selectedScore == 0) "-" else "$selectedScore / 10"}", style = MaterialTheme.typography.labelLarge, color = tokens.inkPrimary)
            Row(
                modifier = Modifier.horizontalScroll(rememberScrollState()),
                horizontalArrangement = Arrangement.spacedBy(6.dp)
            ) {
                (0..10).forEach { score ->
                    val active = selectedScore == score
                    Box(
                        modifier = Modifier
                            .clip(RoundedCornerShape(8.dp))
                            .background(if (active) tokens.accent else tokens.surfaceAlt)
                            .clickable { selectedScore = score }
                            .padding(horizontal = 11.dp, vertical = 7.dp)
                    ) {
                        Text(
                            text = if (score == 0) "-" else score.toString(),
                            color = if (active) tokens.onAccent else tokens.inkPrimary,
                            fontWeight = FontWeight.Bold,
                            fontSize = 12.5.sp
                        )
                    }
                }
            }

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                if (manga.malTracked) {
                    OutlinedButton(
                        onClick = onUnbind,
                        shape = RoundedCornerShape(10.dp),
                        modifier = Modifier.weight(1f)
                    ) {
                        Text(s.malUnbind, color = tokens.rose)
                    }
                }
                Button(
                    onClick = { onSave(selectedStatus, chaptersRead, selectedScore, activeMalId, activeMalTitle) },
                    colors = ButtonDefaults.buttonColors(
                        containerColor = tokens.accent,
                        contentColor = tokens.onAccent
                    ),
                    shape = RoundedCornerShape(10.dp),
                    modifier = Modifier.weight(1.4f)
                ) {
                    Text(s.save, color = tokens.onAccent, fontWeight = FontWeight.Bold)
                }
            }
        }
    }
}

@Preview(name = "Manga Detail Carbon Dark", showBackground = true, widthDp = 390, heightDp = 820)
@Composable
fun MangaDetailPreview() {
    val list = DemoDataRepository.createMangaList()
    YomicTheme(darkTheme = true) {
        MangaDetailScreen(
            mangaId = list.first().id,
            state = YomicUiState(mangaList = list),
            onBack = {}, onToggleInLibrary = {}, onOpenReader = { _, _ -> },
            onDownloadUnread = {}, onDownloadSingle = { _, _ -> }, onDeleteSingleDownload = { _, _ -> },
            onDeleteAllDownloads = {}, onToggleBookmark = { _, _ -> }, onToggleChapterRead = { _, _ -> },
            onMarkPreviousRead = { _, _ -> }, onChapterFilterChange = {}, onToggleChapterOrder = {},
            onSaveMalTracking = { _, _, _, _, _, _ -> }, onUnbindMal = {}, onOpenSettings = {}, onToast = {}
        )
    }
}

@Preview(name = "MAL Search & Bind Sheet", showBackground = true, widthDp = 390, heightDp = 520)
@Composable
fun MalSearchBindPreview() {
    val orv = DemoDataRepository.createMangaList().first { !it.malTracked }
    YomicTheme(darkTheme = true) {
        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(YomicThemeTokens.colors.surface)
                .padding(top = 18.dp)
        ) {
            MalTrackerSheetContent(
                manga = orv,
                isMalConnected = true,
                malUser = "ArisaReader",
                onGoToSettings = {},
                onSave = { _, _, _, _, _ -> },
                onUnbind = {},
                initialSearchMode = true
            )
        }
    }
}
