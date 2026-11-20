package id.yomic.mobile.ui.screens

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInVertically
import androidx.compose.animation.slideOutVertically
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.awaitEachGesture
import androidx.compose.foundation.gestures.awaitFirstDown
import androidx.compose.foundation.gestures.calculatePan
import androidx.compose.foundation.gestures.calculateZoom
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.pager.HorizontalPager
import androidx.compose.foundation.pager.rememberPagerState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Slider
import androidx.compose.material3.SliderDefaults
import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.derivedStateOf
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.IntSize
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import id.yomic.mobile.data.DemoDataRepository
import id.yomic.mobile.model.ReaderMode
import id.yomic.mobile.model.ReadingDirection
import id.yomic.mobile.model.YomicUiState
import id.yomic.mobile.ui.components.ComicPageCanvas
import id.yomic.mobile.ui.i18n.yomicStrings
import id.yomic.mobile.ui.theme.ReaderAccent
import id.yomic.mobile.ui.theme.ReaderBg
import id.yomic.mobile.ui.theme.ReaderBorder
import id.yomic.mobile.ui.theme.ReaderHud
import id.yomic.mobile.ui.theme.ReaderInk
import id.yomic.mobile.ui.theme.ReaderInkMuted
import id.yomic.mobile.ui.theme.ReaderOnAccent
import id.yomic.mobile.ui.theme.ReaderSurface
import id.yomic.mobile.ui.theme.YomicIcons
import id.yomic.mobile.ui.theme.YomicTheme
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlin.math.abs
import kotlin.math.roundToInt

private enum class ReaderSheetType { NONE, CHAPTERS, MODE, IMAGE }

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ReaderScreen(
    mangaId: String,
    initialChapterNumber: Double,
    state: YomicUiState,
    onClose: () -> Unit,
    onRecordProgress: (String, Double, Int, Int) -> Unit,
    onUpdatePageProgress: (String, Double, Int, Int) -> Unit = { _, _, _, _ -> },
    onUpdateDimmer: (Float) -> Unit = {},
    onToggleBookmark: (String, Double) -> Unit = { _, _ -> },
    onToggleImageSetting: (String, Boolean) -> Unit,
    onToast: (String) -> Unit
) {
    val s = yomicStrings
    val manga = state.mangaList.find { it.id == mangaId } ?: return
    val sortedChaptersAsc = remember(manga.chapters) { manga.chapters.sortedBy { it.number } }
    val sortedChaptersDesc = remember(manga.chapters) { manga.chapters.sortedByDescending { it.number } }

    var activeChapterNum by remember(mangaId, initialChapterNumber) { mutableStateOf(initialChapterNumber) }
    val activeChapter = remember(manga.chapters, activeChapterNum) {
        manga.chapters.find { abs(it.number - activeChapterNum) < 0.001 } ?: sortedChaptersDesc.firstOrNull()
    }
    val totalPages = (activeChapter?.totalPages ?: 12).coerceAtLeast(1)

    var readerMode by remember { mutableStateOf(state.settings.defaultReaderMode) }
    var readingDirection by remember { mutableStateOf(state.settings.readingDirection) }
    var zoomScale by remember { mutableFloatStateOf(1f) }
    var panOffset by remember { mutableStateOf(Offset.Zero) }
    var containerSize by remember { mutableStateOf(IntSize.Zero) }
    var dimmerAlpha by remember(state.settings.readerDimmerAlpha) { mutableFloatStateOf(state.settings.readerDimmerAlpha) }
    var autoScrollActive by remember { mutableStateOf(false) }
    var hudVisible by remember { mutableStateOf(true) }
    var activeSheet by remember { mutableStateOf(ReaderSheetType.NONE) }
    var currentPage by remember(activeChapterNum) { mutableIntStateOf(1) }

    val scope = rememberCoroutineScope()
    val webtoonListState = rememberLazyListState()
    val pagerCount = remember(readerMode, totalPages) {
        if (readerMode == ReaderMode.DUAL) (totalPages + 1) / 2 else totalPages
    }
    val pagerState = rememberPagerState(initialPage = 0) { pagerCount }

    // Record progress when opening or changing chapter
    LaunchedEffect(mangaId, activeChapterNum) {
        onRecordProgress(mangaId, activeChapterNum, 1, totalPages)
    }

    // Auto-save reading page progress as user reads through the chapter
    LaunchedEffect(mangaId, activeChapterNum, currentPage) {
        if (currentPage > 1) {
            onUpdatePageProgress(mangaId, activeChapterNum, currentPage, totalPages)
        }
    }

    // Track current page in Webtoon mode
    val visibleWebtoonPage by remember {
        derivedStateOf { (webtoonListState.firstVisibleItemIndex + 1).coerceIn(1, totalPages) }
    }
    LaunchedEffect(visibleWebtoonPage, readerMode) {
        if (readerMode == ReaderMode.WEBTOON) {
            currentPage = visibleWebtoonPage
        }
    }

    // Track current page in Pager mode
    LaunchedEffect(pagerState.currentPage, readerMode) {
        if (readerMode != ReaderMode.WEBTOON) {
            currentPage = if (readerMode == ReaderMode.DUAL) {
                (pagerState.currentPage * 2 + 1).coerceIn(1, totalPages)
            } else {
                (pagerState.currentPage + 1).coerceIn(1, totalPages)
            }
        }
    }

    // Auto-hide HUD after 3.2 seconds unless a sheet is open
    LaunchedEffect(hudVisible, activeSheet) {
        if (hudVisible && activeSheet == ReaderSheetType.NONE) {
            delay(3200L)
            hudVisible = false
        }
    }

    // Smooth Webtoon Auto-Scroll
    LaunchedEffect(autoScrollActive, readerMode) {
        if (autoScrollActive && readerMode == ReaderMode.WEBTOON) {
            while (autoScrollActive) {
                delay(45L)
                webtoonListState.scroll { scrollBy(5.5f) }
            }
        }
    }

    fun stepChapter(delta: Int) {
        val idx = sortedChaptersAsc.indexOfFirst { abs(it.number - activeChapterNum) < 0.001 }
        if (idx == -1) return
        val nextIdx = idx + delta
        if (nextIdx !in sortedChaptersAsc.indices) {
            onToast(
                if (delta < 0) (if (s.isEn) "This is the first chapter." else "Ini adalah bab pertama.")
                else (if (s.isEn) "This is the latest chapter." else "Ini adalah bab terbaru.")
            )
            return
        }
        activeChapterNum = sortedChaptersAsc[nextIdx].number
        currentPage = 1
        zoomScale = 1f
        panOffset = Offset.Zero
        scope.launch {
            webtoonListState.scrollToItem(0)
            pagerState.scrollToPage(0)
        }
    }

    fun jumpToPage(targetPage: Int) {
        val clamped = targetPage.coerceIn(1, totalPages)
        currentPage = clamped
        scope.launch {
            if (readerMode == ReaderMode.WEBTOON) {
                webtoonListState.animateScrollToItem(clamped - 1)
            } else {
                val pIdx = if (readerMode == ReaderMode.DUAL) (clamped - 1) / 2 else clamped - 1
                pagerState.animateScrollToPage(pIdx.coerceIn(0, pagerCount - 1))
            }
        }
    }

    fun handleHorizontalTap(isRightZone: Boolean) {
        val forward = if (readingDirection == ReadingDirection.RTL) !isRightZone else isRightZone
        val delta = if (forward) 1 else -1
        if (readerMode == ReaderMode.WEBTOON) {
            jumpToPage(currentPage + delta)
        } else {
            val targetIdx = pagerState.currentPage + delta
            if (targetIdx in 0 until pagerCount) {
                scope.launch { pagerState.animateScrollToPage(targetIdx) }
            } else {
                stepChapter(delta)
            }
        }
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(ReaderBg)
            .onSizeChanged { containerSize = it }
            .pointerInput(readerMode, readingDirection) {
                detectTapGestures(
                    onDoubleTap = {
                        if (zoomScale > 1.15f) {
                            zoomScale = 1f
                            panOffset = Offset.Zero
                        } else {
                            zoomScale = 1.75f
                        }
                    },
                    onTap = { offset ->
                        val w = size.width.toFloat().coerceAtLeast(1f)
                        val relX = offset.x / w
                        when {
                            relX < 0.28f -> handleHorizontalTap(isRightZone = false)
                            relX > 0.72f -> handleHorizontalTap(isRightZone = true)
                            else -> hudVisible = !hudVisible
                        }
                    }
                )
            }
            .pointerInput(Unit) {
                awaitEachGesture {
                    awaitFirstDown(requireUnconsumed = false)
                    do {
                        val event = awaitPointerEvent()
                        val zoom = event.calculateZoom()
                        val pan = event.calculatePan()
                        val isMultiTouch = event.changes.count { it.pressed } >= 2
                        val isZoomed = zoomScale > 1.02f

                        if (isMultiTouch || isZoomed) {
                            val newScale = (zoomScale * zoom).coerceIn(1f, 2.5f)
                            if (newScale <= 1.02f) {
                                zoomScale = 1f
                                panOffset = Offset.Zero
                            } else {
                                val maxX = (containerSize.width * (newScale - 1f)) / 2f
                                val maxY = (containerSize.height * (newScale - 1f)) / 2f
                                zoomScale = newScale
                                panOffset = Offset(
                                    x = (panOffset.x + pan.x).coerceIn(-maxX, maxX),
                                    y = (panOffset.y + pan.y).coerceIn(-maxY, maxY)
                                )
                            }
                            if (isMultiTouch || pan != Offset.Zero) {
                                event.changes.forEach { if (it.pressed) it.consume() }
                            }
                        }
                    } while (event.changes.any { it.pressed })
                }
            }
    ) {
        // =================================================================
        // CANVAS LAYER (Webtoon / Single Page / Dual Page)
        // =================================================================
        Box(
            modifier = Modifier
                .fillMaxSize()
                .graphicsLayer(
                    scaleX = zoomScale,
                    scaleY = zoomScale,
                    translationX = panOffset.x,
                    translationY = panOffset.y
                )
        ) {
            val chNumLabel = activeChapter?.formattedNumber ?: activeChapterNum.toInt().toString()
            val chTitle = activeChapter?.title.orEmpty()

            if (readerMode == ReaderMode.WEBTOON) {
                LazyColumn(
                    state = webtoonListState,
                    userScrollEnabled = zoomScale <= 1.02f,
                    modifier = Modifier.fillMaxSize(),
                    contentPadding = PaddingValues(vertical = 20.dp),
                    verticalArrangement = Arrangement.spacedBy(2.dp)
                ) {
                    items(totalPages) { index ->
                        ComicPageCanvas(
                            manga = manga,
                            chapterNumber = chNumLabel,
                            chapterTitle = chTitle,
                            pageIndex = index + 1,
                            totalPages = totalPages,
                            sharpened = state.settings.enableImageSharpening,
                            autoCrop = state.settings.enableAutoCropBorders
                        )
                    }
                    // End of Chapter Footer (Yomic Desktop 1:1 Mirror — minimal muted auto-load hint)
                    item(key = "chapter_end_footer_$activeChapterNum") {
                        val activeIdx = sortedChaptersAsc.indexOfFirst { abs(it.number - activeChapterNum) < 0.001 }
                        val hasNextChapter = activeIdx in 0 until (sortedChaptersAsc.size - 1)
                        LaunchedEffect(activeChapterNum, hasNextChapter) {
                            if (hasNextChapter) {
                                delay(650L)
                                stepChapter(+1)
                            }
                        }
                        Box(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clickable(enabled = hasNextChapter) { stepChapter(+1) }
                                .padding(top = 36.dp, bottom = 84.dp, start = 24.dp, end = 24.dp),
                            contentAlignment = Alignment.Center
                        ) {
                            Text(
                                text = if (hasNextChapter) {
                                    if (s.isEn) "Auto-loading on scroll down" else "Memuat otomatis saat scroll ke bawah"
                                } else {
                                    if (s.isEn) "This is the latest chapter" else "Ini adalah bab terbaru"
                                },
                                color = ReaderInkMuted.copy(alpha = 0.55f),
                                fontSize = 12.sp,
                                fontWeight = FontWeight.Normal
                            )
                        }
                    }
                }
            } else {
                HorizontalPager(
                    state = pagerState,
                    reverseLayout = readingDirection == ReadingDirection.RTL,
                    userScrollEnabled = zoomScale <= 1.02f,
                    modifier = Modifier.fillMaxSize()
                ) { pageIdx ->
                    Box(
                        modifier = Modifier
                            .fillMaxSize()
                            .padding(horizontal = 6.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        if (readerMode == ReaderMode.SINGLE) {
                            ComicPageCanvas(
                                manga = manga,
                                chapterNumber = chNumLabel,
                                chapterTitle = chTitle,
                                pageIndex = pageIdx + 1,
                                totalPages = totalPages,
                                sharpened = state.settings.enableImageSharpening,
                                autoCrop = state.settings.enableAutoCropBorders
                            )
                        } else {
                            // Dual Page Spread
                            val p1 = pageIdx * 2 + 1
                            val p2 = (pageIdx * 2 + 2).coerceAtMost(totalPages)
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.spacedBy(4.dp)
                            ) {
                                ComicPageCanvas(
                                    manga = manga,
                                    chapterNumber = chNumLabel,
                                    chapterTitle = chTitle,
                                    pageIndex = p1,
                                    totalPages = totalPages,
                                    sharpened = state.settings.enableImageSharpening,
                                    autoCrop = state.settings.enableAutoCropBorders,
                                    modifier = Modifier.weight(1f)
                                )
                                if (p2 != p1) {
                                    ComicPageCanvas(
                                        manga = manga,
                                        chapterNumber = chNumLabel,
                                        chapterTitle = chTitle,
                                        pageIndex = p2,
                                        totalPages = totalPages,
                                        sharpened = state.settings.enableImageSharpening,
                                        autoCrop = state.settings.enableAutoCropBorders,
                                        modifier = Modifier.weight(1f)
                                    )
                                }
                            }
                        }
                    }
                }
            }
        }

        // Night Reading Dimmer Overlay (non-interactive)
        if (dimmerAlpha > 0.01f) {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .background(Color.Black.copy(alpha = dimmerAlpha.coerceIn(0f, 0.7f)))
            )
        }

        // Quick Reset Zoom Pill when zoomed in
        if (zoomScale > 1.05f) {
            Box(
                modifier = Modifier
                    .align(Alignment.TopEnd)
                    .statusBarsPadding()
                    .padding(top = if (hudVisible) 64.dp else 14.dp, end = 14.dp)
                    .clip(RoundedCornerShape(99.dp))
                    .background(ReaderHud)
                    .border(0.8.dp, ReaderBorder, RoundedCornerShape(99.dp))
                    .clickable {
                        zoomScale = 1f
                        panOffset = Offset.Zero
                    }
                    .padding(horizontal = 12.dp, vertical = 6.dp)
            ) {
                Text(
                    text = "${String.format(java.util.Locale.US, "%.1f", zoomScale)}x · Reset",
                    color = ReaderInk,
                    fontSize = 11.5.sp,
                    fontWeight = FontWeight.SemiBold
                )
            }
        }

        // Subtle Floating Page Pill when HUD is hidden
        if (!hudVisible) {
            Box(
                modifier = Modifier
                    .align(Alignment.BottomCenter)
                    .navigationBarsPadding()
                    .padding(bottom = 12.dp)
                    .clip(RoundedCornerShape(99.dp))
                    .background(Color(0x99000000))
                    .padding(horizontal = 12.dp, vertical = 4.dp)
            ) {
                Text(
                    text = "$currentPage / $totalPages",
                    color = Color.White.copy(alpha = 0.85f),
                    fontSize = 11.5.sp,
                    fontWeight = FontWeight.SemiBold
                )
            }
        }

        // =================================================================
        // TOP HUD BAR (Deep-Ocean Translucent Dark)
        // =================================================================
        AnimatedVisibility(
            visible = hudVisible,
            enter = fadeIn() + slideInVertically { -it },
            exit = fadeOut() + slideOutVertically { -it },
            modifier = Modifier.align(Alignment.TopCenter)
        ) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(ReaderHud)
                    .statusBarsPadding()
                    .padding(horizontal = 10.dp, vertical = 8.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                IconButton(
                    onClick = onClose,
                    modifier = Modifier.size(40.dp)
                ) {
                    Icon(YomicIcons.ArrowBack, contentDescription = "Close", tint = ReaderInk, modifier = Modifier.size(21.dp))
                }

                Column(
                    modifier = Modifier
                        .weight(1f)
                        .clip(RoundedCornerShape(9.dp))
                        .clickable { activeSheet = ReaderSheetType.CHAPTERS }
                        .padding(horizontal = 4.dp, vertical = 2.dp)
                ) {
                    Text(
                        text = manga.title,
                        color = ReaderInk,
                        fontSize = 14.sp,
                        fontWeight = FontWeight.Bold,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                        Text(
                            text = "Chapter ${activeChapter?.formattedNumber ?: activeChapterNum.toInt()}",
                            color = ReaderAccent,
                            fontSize = 12.sp,
                            fontWeight = FontWeight.SemiBold
                        )
                        Icon(YomicIcons.ChevronDown, contentDescription = null, tint = ReaderAccent, modifier = Modifier.size(14.dp))
                    }
                }

                val isBookmarked = activeChapter?.isBookmarked == true
                IconButton(
                    onClick = { onToggleBookmark(mangaId, activeChapterNum) },
                    modifier = Modifier.size(40.dp)
                ) {
                    Icon(
                        imageVector = if (isBookmarked) YomicIcons.BookmarkFilled else YomicIcons.Bookmark,
                        contentDescription = s.bookmarked,
                        tint = if (isBookmarked) ReaderAccent else ReaderInk,
                        modifier = Modifier.size(20.dp)
                    )
                }

                IconButton(
                    onClick = { onToast(if (s.isEn) "Pages reloaded." else "Halaman dimuat ulang.") },
                    modifier = Modifier.size(40.dp)
                ) {
                    Icon(YomicIcons.Updates, contentDescription = s.refresh, tint = ReaderInk, modifier = Modifier.size(20.dp))
                }
            }
        }

        // =================================================================
        // BOTTOM HUD BAR (Mihon-Style Floating Pill Scrubber + Circular Prev/Next)
        // =================================================================
        AnimatedVisibility(
            visible = hudVisible,
            enter = fadeIn() + slideInVertically { it },
            exit = fadeOut() + slideOutVertically { it },
            modifier = Modifier.align(Alignment.BottomCenter)
        ) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .navigationBarsPadding()
                    .padding(horizontal = 14.dp, vertical = 12.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                // Circular Prev Chapter Button
                Box(
                    modifier = Modifier
                        .size(44.dp)
                        .clip(CircleShape)
                        .background(ReaderHud)
                        .border(0.8.dp, ReaderBorder.copy(alpha = 0.65f), CircleShape)
                        .clickable { stepChapter(-1) },
                    contentAlignment = Alignment.Center
                ) {
                    Icon(YomicIcons.ArrowBack, contentDescription = s.prevBtn, tint = ReaderInk, modifier = Modifier.size(19.dp))
                }

                // Floating Pill Scrubber
                Row(
                    modifier = Modifier
                        .weight(1f)
                        .height(44.dp)
                        .clip(RoundedCornerShape(99.dp))
                        .background(ReaderHud)
                        .border(0.8.dp, ReaderBorder.copy(alpha = 0.65f), RoundedCornerShape(99.dp))
                        .padding(horizontal = 14.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    Text(
                        text = currentPage.toString(),
                        color = ReaderInk,
                        fontSize = 12.sp,
                        fontWeight = FontWeight.SemiBold
                    )

                    Slider(
                        value = currentPage.toFloat(),
                        onValueChange = { jumpToPage(it.roundToInt()) },
                        valueRange = 1f..totalPages.toFloat().coerceAtLeast(1f),
                        thumb = {
                            Box(
                                modifier = Modifier
                                    .size(16.dp)
                                    .clip(CircleShape)
                                    .background(ReaderAccent)
                                    .border(2.dp, Color.White, CircleShape)
                            )
                        },
                        track = { sliderState ->
                            val span = (sliderState.valueRange.endInclusive - sliderState.valueRange.start).coerceAtLeast(1f)
                            val fraction = ((sliderState.value - sliderState.valueRange.start) / span).coerceIn(0f, 1f)
                            Box(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .height(4.dp)
                                    .clip(RoundedCornerShape(99.dp))
                                    .background(ReaderBorder)
                            ) {
                                Box(
                                    modifier = Modifier
                                        .fillMaxWidth(fraction.coerceAtLeast(0.02f))
                                        .height(4.dp)
                                        .clip(RoundedCornerShape(99.dp))
                                        .background(ReaderAccent)
                                )
                            }
                        },
                        modifier = Modifier.weight(1f)
                    )

                    Text(
                        text = totalPages.toString(),
                        color = ReaderInkMuted,
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Medium
                    )
                }

                // Circular Next Chapter Button
                Box(
                    modifier = Modifier
                        .size(44.dp)
                        .clip(CircleShape)
                        .background(ReaderHud)
                        .border(0.8.dp, ReaderBorder.copy(alpha = 0.65f), CircleShape)
                        .clickable { stepChapter(+1) },
                    contentAlignment = Alignment.Center
                ) {
                    Icon(YomicIcons.ArrowForward, contentDescription = s.nextBtn, tint = ReaderInk, modifier = Modifier.size(19.dp))
                }
            }
        }
    }

    // =====================================================================
    // READER DARK BOTTOM SHEETS (Chapters, Mode, Zoom, Image Processing)
    // =====================================================================
    if (activeSheet != ReaderSheetType.NONE) {
        ModalBottomSheet(
            onDismissRequest = { activeSheet = ReaderSheetType.NONE },
            containerColor = ReaderSurface,
            contentColor = ReaderInk,
            sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
        ) {
            when (activeSheet) {
                ReaderSheetType.CHAPTERS -> {
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 16.dp)
                            .padding(bottom = 24.dp)
                    ) {
                        Text(s.selectChapter, color = ReaderInk, style = MaterialTheme.typography.titleMedium, modifier = Modifier.padding(bottom = 10.dp))
                        LazyColumn(
                            modifier = Modifier.height(340.dp),
                            verticalArrangement = Arrangement.spacedBy(4.dp)
                        ) {
                            items(sortedChaptersDesc, key = { it.id }) { ch ->
                                val isCurrent = abs(ch.number - activeChapterNum) < 0.001
                                Row(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .clip(RoundedCornerShape(10.dp))
                                        .background(if (isCurrent) ReaderAccent.copy(alpha = 0.2f) else Color.Transparent)
                                        .clickable {
                                            activeChapterNum = ch.number
                                            currentPage = 1
                                            activeSheet = ReaderSheetType.NONE
                                            scope.launch {
                                                webtoonListState.scrollToItem(0)
                                                pagerState.scrollToPage(0)
                                            }
                                        }
                                        .padding(horizontal = 12.dp, vertical = 10.dp),
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Text(
                                        text = "Chapter ${ch.formattedNumber}${if (ch.title.isNotBlank()) " — ${ch.title}" else ""}",
                                        color = if (isCurrent) ReaderAccent else ReaderInk,
                                        fontWeight = if (isCurrent) FontWeight.Bold else FontWeight.Normal,
                                        modifier = Modifier.weight(1f),
                                        maxLines = 1,
                                        overflow = TextOverflow.Ellipsis
                                    )
                                    if (isCurrent) {
                                        Icon(YomicIcons.Check, contentDescription = null, tint = ReaderAccent, modifier = Modifier.size(16.dp))
                                    }
                                }
                            }
                        }
                    }
                }

                ReaderSheetType.MODE -> {
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 18.dp)
                            .padding(bottom = 28.dp),
                        verticalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        Text(s.readingMode, color = ReaderInk, style = MaterialTheme.typography.titleMedium)
                        listOf(
                            ReaderMode.WEBTOON to s.modeWebtoon,
                            ReaderMode.SINGLE to s.modeSingle,
                            ReaderMode.DUAL to s.modeDual
                        ).forEach { (mode, label) ->
                            val selected = readerMode == mode
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .clip(RoundedCornerShape(10.dp))
                                    .background(if (selected) ReaderAccent.copy(alpha = 0.2f) else Color.Transparent)
                                    .clickable { readerMode = mode }
                                    .padding(horizontal = 12.dp, vertical = 11.dp),
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Text(label, color = if (selected) ReaderAccent else ReaderInk, modifier = Modifier.weight(1f), fontWeight = if (selected) FontWeight.Bold else FontWeight.Normal)
                                if (selected) Icon(YomicIcons.Check, contentDescription = null, tint = ReaderAccent, modifier = Modifier.size(17.dp))
                            }
                        }
                        HorizontalDivider(color = ReaderBorder)
                        Text(s.readingDirection, color = ReaderInk, style = MaterialTheme.typography.titleSmall)
                        Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                            listOf(ReadingDirection.LTR to "LTR (→)", ReadingDirection.RTL to "RTL Manga (←)").forEach { (dir, label) ->
                                val active = readingDirection == dir
                                Box(
                                    modifier = Modifier
                                        .weight(1f)
                                        .clip(RoundedCornerShape(10.dp))
                                        .background(if (active) ReaderAccent else ReaderBorder)
                                        .clickable { readingDirection = dir }
                                        .padding(vertical = 10.dp),
                                    contentAlignment = Alignment.Center
                                ) {
                                    Text(
                                        label,
                                        color = if (active) ReaderOnAccent else ReaderInk,
                                        fontWeight = FontWeight.SemiBold,
                                        fontSize = 13.sp
                                    )
                                }
                            }
                        }
                        if (readerMode == ReaderMode.WEBTOON) {
                            HorizontalDivider(color = ReaderBorder)
                            ReaderToggleOption(
                                title = s.autoScroll,
                                desc = if (s.isEn) "Scroll webtoon pages automatically" else "Gulir halaman webtoon secara otomatis",
                                checked = autoScrollActive,
                                onCheckedChange = { autoScrollActive = it }
                            )
                        }
                        Text(s.tapZoneHint, color = ReaderInkMuted, fontSize = 11.5.sp)
                    }
                }

                ReaderSheetType.IMAGE -> {
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 18.dp)
                            .padding(bottom = 28.dp),
                        verticalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        Text(s.imageProcessing, color = ReaderInk, style = MaterialTheme.typography.titleMedium)
                        Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Text(
                                    text = if (s.isEn) "Screen Dimmer (Night)" else "Peredup Layar (Malam)",
                                    color = ReaderInk,
                                    fontWeight = FontWeight.SemiBold,
                                    fontSize = 14.sp
                                )
                                Text(
                                    text = "${(dimmerAlpha * 100f).roundToInt()}%",
                                    color = ReaderInkMuted,
                                    fontSize = 12.sp
                                )
                            }
                            Slider(
                                value = dimmerAlpha,
                                onValueChange = {
                                    dimmerAlpha = it
                                    onUpdateDimmer(it)
                                },
                                valueRange = 0f..0.7f,
                                colors = SliderDefaults.colors(
                                    thumbColor = ReaderAccent,
                                    activeTrackColor = ReaderAccent,
                                    inactiveTrackColor = ReaderBorder
                                )
                            )
                        }
                        HorizontalDivider(color = ReaderBorder)
                        ReaderToggleOption(
                            title = if (s.isEn) "Auto-Crop Borders" else "Potong Tepi Putih (Auto-Crop)",
                            desc = if (s.isEn) "Trim blank margins & letterbox edges" else "Pangkas margin kosong di tepi halaman",
                            checked = state.settings.enableAutoCropBorders,
                            onCheckedChange = { onToggleImageSetting("crop", it) }
                        )
                        ReaderToggleOption(
                            title = if (s.isEn) "Image Sharpening" else "Penajaman Gambar (Sharpening)",
                            desc = if (s.isEn) "Enhance lineart & text clarity" else "Tingkatkan ketajaman garis dan teks komik",
                            checked = state.settings.enableImageSharpening,
                            onCheckedChange = { onToggleImageSetting("sharpen", it) }
                        )
                        ReaderToggleOption(
                            title = if (s.isEn) "Smart Memory Optimization" else "Optimasi Gambar Cerdas",
                            desc = if (s.isEn) "Reduce GPU memory footprint" else "Hemat memori RAM dan beban GPU perangkat",
                            checked = state.settings.enableImageOptimization,
                            onCheckedChange = { onToggleImageSetting("opt", it) }
                        )
                    }
                }

                ReaderSheetType.NONE -> Unit
            }
        }
    }
}

@Composable
private fun ReaderToggleOption(
    title: String,
    desc: String,
    checked: Boolean,
    onCheckedChange: (Boolean) -> Unit
) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.SpaceBetween
    ) {
        Column(modifier = Modifier.weight(1f).padding(end = 12.dp)) {
            Text(title, color = ReaderInk, fontWeight = FontWeight.SemiBold, fontSize = 14.sp)
            Text(desc, color = ReaderInkMuted, fontSize = 12.sp)
        }
        Switch(
            checked = checked,
            onCheckedChange = onCheckedChange,
            colors = SwitchDefaults.colors(
                checkedThumbColor = ReaderOnAccent,
                checkedTrackColor = ReaderAccent,
                uncheckedThumbColor = ReaderInkMuted,
                uncheckedTrackColor = ReaderSurface,
                uncheckedBorderColor = ReaderBorder
            )
        )
    }
}

@Preview(name = "Reader Mobile OLED", showBackground = true, widthDp = 390, heightDp = 820)
@Composable
fun ReaderScreenPreview() {
    val list = DemoDataRepository.createMangaList()
    YomicTheme(darkTheme = true) {
        ReaderScreen(
            mangaId = list.first().id,
            initialChapterNumber = 207.0,
            state = YomicUiState(mangaList = list),
            onClose = {},
            onRecordProgress = { _, _, _, _ -> },
            onToggleImageSetting = { _, _ -> },
            onToast = {}
        )
    }
}
