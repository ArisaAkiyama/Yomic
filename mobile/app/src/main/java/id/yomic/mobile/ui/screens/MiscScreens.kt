package id.yomic.mobile.ui.screens

import androidx.compose.foundation.Image
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
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.pager.HorizontalPager
import androidx.compose.foundation.pager.rememberPagerState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FilterChipDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import id.yomic.mobile.R
import id.yomic.mobile.data.DemoDataRepository
import id.yomic.mobile.model.AnnouncementItem
import id.yomic.mobile.model.CategoryItem
import id.yomic.mobile.ui.i18n.yomicStrings
import id.yomic.mobile.ui.theme.YomicIcons
import id.yomic.mobile.ui.theme.YomicTheme
import id.yomic.mobile.ui.theme.YomicThemeTokens
import kotlinx.coroutines.launch

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AnnouncementsScreen(
    announcements: List<AnnouncementItem>,
    onMarkRead: () -> Unit,
    onBack: () -> Unit,
    isRefreshing: Boolean = false,
    onRefresh: () -> Unit = {}
) {
    val tokens = YomicThemeTokens.colors
    val s = yomicStrings

    LaunchedEffect(Unit) { onMarkRead() }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(tokens.canvas)
    ) {
        TopAppBar(
            colors = TopAppBarDefaults.topAppBarColors(containerColor = tokens.canvas),
            navigationIcon = {
                IconButton(onClick = onBack) {
                    Icon(YomicIcons.ArrowBack, contentDescription = "Back", tint = tokens.inkPrimary, modifier = Modifier.size(21.dp))
                }
            },
            title = { Text(s.navAnnouncements, style = MaterialTheme.typography.titleLarge, color = tokens.inkPrimary) },
            actions = {
                IconButton(onClick = onRefresh, enabled = !isRefreshing) {
                    Icon(
                        imageVector = YomicIcons.Updates,
                        contentDescription = s.refresh,
                        tint = if (isRefreshing) tokens.accent else tokens.inkPrimary,
                        modifier = Modifier.size(20.dp)
                    )
                }
            }
        )

        if (isRefreshing) {
            LinearProgressIndicator(
                color = tokens.accent,
                trackColor = tokens.borderSubtle,
                gapSize = 0.dp,
                modifier = Modifier.fillMaxWidth().height(2.5.dp)
            )
        }

        LazyColumn(
            contentPadding = PaddingValues(horizontal = 14.dp, vertical = 10.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
            modifier = Modifier.fillMaxSize()
        ) {
            items(announcements, key = { it.id }) { item ->
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(14.dp))
                        .background(tokens.surface)
                        .border(0.8.dp, tokens.borderSubtle, RoundedCornerShape(14.dp))
                        .padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Box(
                            modifier = Modifier
                                .clip(RoundedCornerShape(6.dp))
                                .background(tokens.accentTint)
                                .padding(horizontal = 8.dp, vertical = 3.dp)
                        ) {
                            Text(item.typeLabel, color = tokens.accent, fontSize = 11.sp, fontWeight = FontWeight.Bold)
                        }
                        Text(formatAnnouncementDate(item.date), color = tokens.inkMuted, style = MaterialTheme.typography.labelSmall)
                    }
                    Text(item.title, style = MaterialTheme.typography.titleMedium, color = tokens.inkPrimary)
                    Text(item.content, style = MaterialTheme.typography.bodyMedium, color = tokens.inkSecondary)
                }
            }
        }
    }
}

private fun formatAnnouncementDate(iso: String): String {
    val parts = iso.trim().split("-")
    if (parts.size != 3) return iso
    val months = listOf("Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des")
    val mIdx = (parts[1].toIntOrNull() ?: 1) - 1
    val day = parts[2].toIntOrNull()?.toString() ?: parts[2]
    val month = months.getOrElse(mIdx) { parts[1] }
    return "$day $month ${parts[0]}"
}

@OptIn(ExperimentalMaterial3Api::class, ExperimentalLayoutApi::class)
@Composable
fun FeedbackScreen(
    onBack: () -> Unit,
    onSubmitSuccess: (String) -> Unit
) {
    val tokens = YomicThemeTokens.colors
    val s = yomicStrings
    val types = if (s.isEn) {
        listOf("Bug Report", "Feature Request", "Extension Issue", "Performance", "General")
    } else {
        listOf("Laporan Bug", "Permintaan Fitur", "Kendala Ekstensi", "Performa & Jaringan", "Saran Umum")
    }
    var selectedType by remember(s.isEn) { mutableStateOf(types.first()) }
    var message by remember { mutableStateOf("") }
    var attachedMock by remember { mutableStateOf(false) }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(tokens.canvas)
    ) {
        TopAppBar(
            colors = TopAppBarDefaults.topAppBarColors(containerColor = tokens.canvas),
            navigationIcon = {
                IconButton(onClick = onBack) {
                    Icon(YomicIcons.ArrowBack, contentDescription = "Back", tint = tokens.inkPrimary, modifier = Modifier.size(21.dp))
                }
            },
            title = { Text(s.navFeedback, style = MaterialTheme.typography.titleLarge, color = tokens.inkPrimary) }
        )

        LazyColumn(
            contentPadding = PaddingValues(16.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp),
            modifier = Modifier.fillMaxSize()
        ) {
            item {
                Text(s.feedbackTypeTitle, style = MaterialTheme.typography.titleSmall, color = tokens.inkPrimary)
                Spacer(Modifier.height(8.dp))
                FlowRow(
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    verticalArrangement = Arrangement.spacedBy(6.dp)
                ) {
                    types.forEach { t ->
                        FilterChip(
                            selected = selectedType == t,
                            onClick = { selectedType = t },
                            label = { Text(t, fontSize = 12.sp) },
                            colors = FilterChipDefaults.filterChipColors(
                                selectedContainerColor = tokens.accentTint,
                                selectedLabelColor = tokens.accent
                            )
                        )
                    }
                }
            }

            item {
                OutlinedTextField(
                    value = message,
                    onValueChange = { message = it },
                    placeholder = { Text(s.feedbackDescPlaceholder, fontSize = 13.sp) },
                    minLines = 5,
                    maxLines = 8,
                    modifier = Modifier.fillMaxWidth()
                )
            }

            item {
                Row(
                    modifier = Modifier
                        .clip(RoundedCornerShape(8.dp))
                        .clickable { attachedMock = !attachedMock }
                        .padding(vertical = 8.dp, horizontal = 4.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    Icon(
                        imageVector = if (attachedMock) YomicIcons.CheckCircle else YomicIcons.ImageAttach,
                        contentDescription = null,
                        tint = if (attachedMock) tokens.emerald else tokens.accent,
                        modifier = Modifier.size(20.dp)
                    )
                    Text(
                        text = if (attachedMock) "screenshot_yomic_mobile.png" else s.feedbackAttach,
                        style = MaterialTheme.typography.bodyMedium,
                        fontWeight = FontWeight.Medium,
                        color = if (attachedMock) tokens.emerald else tokens.inkPrimary
                    )
                }
            }

            item {
                Button(
                    onClick = {
                        if (message.isBlank()) {
                            onSubmitSuccess(if (s.isEn) "Please enter a description first." else "Mohon isi deskripsi masukan terlebih dahulu.")
                        } else {
                            onSubmitSuccess(if (s.isEn) "Thank you! Your feedback has been sent." else "Terima kasih! Masukan Anda berhasil dikirim.")
                            onBack()
                        }
                    },
                    colors = ButtonDefaults.buttonColors(
                        containerColor = tokens.accent,
                        contentColor = tokens.onAccent
                    ),
                    shape = RoundedCornerShape(12.dp),
                    modifier = Modifier.fillMaxWidth().height(48.dp)
                ) {
                    Text(s.feedbackSubmit, color = tokens.onAccent, fontWeight = FontWeight.Bold)
                }
            }
        }
    }
}

@Composable
fun TutorialScreen(
    onFinish: () -> Unit
) {
    val tokens = YomicThemeTokens.colors
    val s = yomicStrings
    val pagerState = rememberPagerState(initialPage = 0) { 3 }
    val scope = rememberCoroutineScope()

    val slides = listOf(
        Triple(
            R.drawable.tutorial_welcome,
            if (s.isEn) "Welcome to Yomic" else "Selamat Datang di Yomic",
            if (s.isEn) "A lightweight platform to manage and enjoy digital comics efficiently. This quick guide will help you configure reading sources and get started."
            else "Platform untuk mengelola dan menikmati bacaan komik digital secara efisien. Panduan singkat ini akan membantu Anda mengonfigurasi sumber bacaan dan memulai penggunaan aplikasi."
        ),
        Triple(
            R.drawable.tutorial_extensions,
            if (s.isEn) "Modular Source Extensions" else "Integrasi Ekstensi Sumber",
            if (s.isEn) "Yomic uses a modular extension architecture. Open the Browse → Extensions tab to pick comic sources you need, then tap Install."
            else "Yomic menggunakan arsitektur modular berbasis ekstensi. Buka menu Jelajahi → Ekstensi untuk memilih sumber komik yang dibutuhkan, lalu ketuk Pasang."
        ),
        Triple(
            R.drawable.tutorial_browse,
            if (s.isEn) "Explore Catalog & Library" else "Eksplorasi Katalog & Pustaka",
            if (s.isEn) "Browse catalogs from your installed sources to discover titles. Save favorites to your Library to track chapter updates automatically."
            else "Akses katalog melalui menu Jelajahi untuk menemukan berbagai judul komik. Simpan judul pilihan ke dalam Pustaka untuk memantau pembaruan bab secara berkala."
        )
    )

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(tokens.canvas)
            .statusBarsPadding()
            .navigationBarsPadding()
            .padding(20.dp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.End
        ) {
            TextButton(onClick = onFinish) {
                Text(s.tutorialSkip, color = tokens.inkSecondary)
            }
        }

        HorizontalPager(
            state = pagerState,
            modifier = Modifier.weight(1f)
        ) { idx ->
            val (drawableRes, title, desc) = slides[idx]
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(horizontal = 16.dp),
                verticalArrangement = Arrangement.Center,
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                Image(
                    painter = painterResource(id = drawableRes),
                    contentDescription = title,
                    contentScale = ContentScale.Fit,
                    modifier = Modifier.size(230.dp)
                )
                Spacer(Modifier.height(22.dp))
                Text(
                    text = title,
                    style = MaterialTheme.typography.headlineSmall,
                    fontWeight = FontWeight.Bold,
                    color = tokens.inkPrimary,
                    textAlign = TextAlign.Center
                )
                Spacer(Modifier.height(10.dp))
                Text(
                    text = desc,
                    style = MaterialTheme.typography.bodyMedium,
                    color = tokens.inkSecondary,
                    textAlign = TextAlign.Center
                )
            }
        }

        // Animated Step Dots
        Row(
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            verticalAlignment = Alignment.CenterVertically,
            modifier = Modifier.padding(vertical = 18.dp)
        ) {
            repeat(3) { i ->
                val active = pagerState.currentPage == i
                Box(
                    modifier = Modifier
                        .height(8.dp)
                        .width(if (active) 24.dp else 8.dp)
                        .clip(CircleShape)
                        .background(if (active) tokens.accent else tokens.borderStrong)
                )
            }
        }

        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            if (pagerState.currentPage > 0) {
                OutlinedButton(
                    onClick = { scope.launch { pagerState.animateScrollToPage(pagerState.currentPage - 1) } },
                    shape = RoundedCornerShape(12.dp),
                    modifier = Modifier.weight(1f).height(48.dp)
                ) {
                    Text(if (s.isEn) "Back" else "Kembali", color = tokens.inkPrimary)
                }
            }
            Button(
                onClick = {
                    if (pagerState.currentPage < 2) {
                        scope.launch { pagerState.animateScrollToPage(pagerState.currentPage + 1) }
                    } else {
                        onFinish()
                    }
                },
                colors = ButtonDefaults.buttonColors(
                    containerColor = tokens.accent,
                    contentColor = tokens.onAccent
                ),
                shape = RoundedCornerShape(12.dp),
                modifier = Modifier.weight(1.4f).height(48.dp)
            ) {
                Text(
                    text = if (pagerState.currentPage == 2) s.tutorialFinish else s.nextBtn,
                    color = tokens.onAccent,
                    fontWeight = FontWeight.Bold
                )
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CategoryManagerBottomSheet(
    categories: List<CategoryItem>,
    onAddCategory: (String) -> Unit,
    onDeleteCategory: (Int) -> Unit,
    onDismiss: () -> Unit
) {
    val tokens = YomicThemeTokens.colors
    val s = yomicStrings
    var newName by remember { mutableStateOf("") }

    ModalBottomSheet(
        onDismissRequest = onDismiss,
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
            Text(s.navCategories, style = MaterialTheme.typography.titleMedium, color = tokens.inkPrimary)
            categories.forEach { cat ->
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(10.dp))
                        .background(tokens.surfaceAlt)
                        .padding(horizontal = 12.dp, vertical = 8.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Icon(YomicIcons.Tag, contentDescription = null, tint = tokens.accent, modifier = Modifier.size(17.dp))
                    Spacer(Modifier.width(10.dp))
                    Text(cat.name, color = tokens.inkPrimary, modifier = Modifier.weight(1f), style = MaterialTheme.typography.bodyMedium)
                    IconButton(onClick = { onDeleteCategory(cat.id) }, modifier = Modifier.size(30.dp)) {
                        Icon(YomicIcons.Trash, contentDescription = s.delete, tint = tokens.rose, modifier = Modifier.size(17.dp))
                    }
                }
            }
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedTextField(
                    value = newName,
                    onValueChange = { if (it.length <= 28) newName = it },
                    placeholder = { Text(s.addCategoryPlaceholder, fontSize = 13.sp) },
                    singleLine = true,
                    modifier = Modifier.weight(1f)
                )
                Button(
                    onClick = {
                        onAddCategory(newName)
                        newName = ""
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
    }
}

@Preview(name = "Announcements Carbon Dark", showBackground = true, widthDp = 390, heightDp = 820)
@Composable
fun AnnouncementsScreenPreview() {
    YomicTheme(darkTheme = true) {
        AnnouncementsScreen(
            announcements = DemoDataRepository.createAnnouncements(),
            onMarkRead = {},
            onBack = {},
            onRefresh = {}
        )
    }
}

@Preview(name = "Feedback Carbon Dark", showBackground = true, widthDp = 390, heightDp = 820)
@Composable
fun FeedbackScreenPreview() {
    YomicTheme(darkTheme = true) {
        FeedbackScreen(
            onBack = {},
            onSubmitSuccess = {}
        )
    }
}

@Preview(name = "Tutorial Onboarding Dark", showBackground = true, widthDp = 390, heightDp = 820)
@Composable
fun TutorialScreenPreview() {
    YomicTheme(darkTheme = true) {
        TutorialScreen(onFinish = {})
    }
}
