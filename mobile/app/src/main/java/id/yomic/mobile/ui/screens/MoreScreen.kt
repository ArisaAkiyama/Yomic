package id.yomic.mobile.ui.screens

import androidx.compose.foundation.Image
import androidx.compose.foundation.background
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
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import id.yomic.mobile.R
import id.yomic.mobile.data.DemoDataRepository
import id.yomic.mobile.model.DownloadStatus
import id.yomic.mobile.model.YomicUiState
import id.yomic.mobile.ui.i18n.yomicStrings
import id.yomic.mobile.ui.navigation.YomicBottomNavigationBar
import id.yomic.mobile.ui.navigation.YomicRoutes
import id.yomic.mobile.ui.theme.YomicIcons
import id.yomic.mobile.ui.theme.YomicTheme
import id.yomic.mobile.ui.theme.YomicThemeTokens

@Composable
fun MoreScreen(
    state: YomicUiState,
    onToggleDarkMode: (Boolean) -> Unit,
    onToggleOfflineMode: (Boolean) -> Unit,
    onToggleIncognitoMode: (Boolean) -> Unit,
    onAddCategory: (String) -> Unit,
    onDeleteCategory: (Int) -> Unit,
    onOpenDownloads: () -> Unit,
    onOpenInsights: () -> Unit,
    onOpenStorage: () -> Unit,
    onOpenAnnouncements: () -> Unit,
    onOpenFeedback: () -> Unit,
    onOpenTutorial: () -> Unit,
    onOpenSettings: () -> Unit,
    onOpenAbout: () -> Unit
) {
    val tokens = YomicThemeTokens.colors
    val s = yomicStrings
    var showCategorySheet by remember { mutableStateOf(false) }

    val activeDownloadsCount = state.downloads.count { it.status != DownloadStatus.COMPLETED }
    val hasUnreadAnnouncement = state.announcements.any { it.isUnread }

    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .background(tokens.canvas)
            .statusBarsPadding(),
        contentPadding = PaddingValues(bottom = 24.dp)
    ) {
        // 1. Centered Mihon-style Hero Brand Logo (Clean, borderless, generous breathing room)
        item {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(top = 36.dp, bottom = 28.dp),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                Image(
                    painter = painterResource(id = R.drawable.yomic_logo),
                    contentDescription = "Yomic Logo",
                    modifier = Modifier.size(64.dp)
                )
                Spacer(Modifier.height(10.dp))
                Text(
                    text = "Yomic",
                    style = MaterialTheme.typography.titleLarge,
                    fontWeight = FontWeight.SemiBold,
                    letterSpacing = 0.4.sp,
                    color = tokens.inkPrimary
                )
                Spacer(Modifier.height(2.dp))
                Text(
                    text = "v2.1.0",
                    style = MaterialTheme.typography.labelMedium,
                    color = tokens.inkMuted
                )
            }
            HorizontalDivider(color = tokens.borderSubtle, thickness = 0.8.dp)
        }

        // 2. Quick Toggles (Flat Material 3 — Dark Mode, Downloaded Only, Incognito)
        item {
            Spacer(Modifier.height(4.dp))
            MoreToggleRow(
                icon = YomicIcons.Moon,
                title = s.darkMode,
                subtitle = if (s.isEn) "Carbon Dark theme for night reading" else "Tema gelap Carbon Dark untuk malam hari",
                checked = state.settings.isDarkMode,
                onCheckedChange = onToggleDarkMode
            )
            val offlineCount = remember(state.mangaList) { state.mangaList.count { it.inLibrary && it.downloadedCount > 0 } }
            MoreToggleRow(
                icon = YomicIcons.WifiOff,
                title = if (s.isEn) "Downloaded only" else "Hanya unduhan",
                subtitle = if (state.settings.isOfflineMode) {
                    if (s.isEn) "Active · Showing $offlineCount offline titles" else "Aktif · Menampilkan $offlineCount komik offline"
                } else {
                    if (s.isEn) "Filters all entries in your library" else "Hanya tampilkan komik yang sudah diunduh"
                },
                checked = state.settings.isOfflineMode,
                onCheckedChange = onToggleOfflineMode
            )
            MoreToggleRow(
                icon = YomicIcons.Incognito,
                title = if (s.isEn) "Incognito mode" else "Mode penyamaran",
                subtitle = if (s.isEn) "Pauses reading history" else "Menjeda pencatatan riwayat baca",
                checked = state.settings.isIncognitoMode,
                onCheckedChange = onToggleIncognitoMode
            )
            Spacer(Modifier.height(4.dp))
            HorizontalDivider(color = tokens.borderSubtle, thickness = 0.8.dp)
        }

        // 3. Primary Tools Group (Mihon-style: Download Queue, Categories, Statistics, Data & Storage)
        item {
            Spacer(Modifier.height(4.dp))
            MoreNavRow(
                icon = YomicIcons.Download,
                title = if (s.isEn) "Download queue" else "Antrean unduhan",
                subtitle = "${state.downloads.size} ${if (s.isEn) "items in queue" else "item di antrean"}",
                badgeText = if (activeDownloadsCount > 0) activeDownloadsCount.toString() else null,
                onClick = onOpenDownloads
            )
            MoreNavRow(
                icon = YomicIcons.Tag,
                title = s.navCategories,
                subtitle = "${state.categories.size} ${if (s.isEn) "library categories" else "kategori pustaka"}",
                onClick = { showCategorySheet = true }
            )
            MoreNavRow(
                icon = YomicIcons.Insights,
                title = s.navInsights,
                subtitle = if (s.isEn) "Reading streak, genres & 14-day chart" else "Streak harian, genre & grafik 14 hari",
                onClick = onOpenInsights
            )
            MoreNavRow(
                icon = YomicIcons.Storage,
                title = if (s.isEn) "Data and storage" else "Data dan penyimpanan",
                subtitle = "${state.settings.cacheSizeText} · ${if (s.isEn) "Backup & cache" else "Cadangan & cache"}",
                onClick = onOpenStorage
            )
            Spacer(Modifier.height(4.dp))
            HorizontalDivider(color = tokens.borderSubtle, thickness = 0.8.dp)
        }

        // 4. Settings, About & Yomic Help Group
        item {
            Spacer(Modifier.height(4.dp))
            MoreNavRow(
                icon = YomicIcons.Settings,
                title = s.navSettings,
                subtitle = if (s.isEn) "Appearance, reader, downloads & more" else "Tampilan, pembaca, unduhan & lainnya",
                onClick = onOpenSettings
            )
            MoreNavRow(
                icon = YomicIcons.Info,
                title = if (s.isEn) "About" else "Tentang",
                subtitle = "Yomic v2.1.0",
                onClick = onOpenAbout
            )
            MoreNavRow(
                icon = YomicIcons.Bell,
                title = s.navAnnouncements,
                subtitle = if (s.isEn) "Developer news & release notes" else "Info developer & catatan rilis",
                showUnreadDot = hasUnreadAnnouncement,
                onClick = onOpenAnnouncements
            )
            MoreNavRow(
                icon = YomicIcons.Help,
                title = s.navTutorial,
                subtitle = if (s.isEn) "3-step quick start guide" else "Panduan singkat 3 langkah",
                onClick = onOpenTutorial
            )
            MoreNavRow(
                icon = YomicIcons.Feedback,
                title = s.navFeedback,
                subtitle = if (s.isEn) "Report bugs or suggest features" else "Laporkan bug atau kirim saran fitur",
                onClick = onOpenFeedback
            )
        }
    }

    if (showCategorySheet) {
        CategoryManagerBottomSheet(
            categories = state.categories,
            onAddCategory = onAddCategory,
            onDeleteCategory = onDeleteCategory,
            onDismiss = { showCategorySheet = false }
        )
    }
}

@Composable
private fun MoreToggleRow(
    icon: ImageVector,
    title: String,
    subtitle: String,
    checked: Boolean,
    onCheckedChange: (Boolean) -> Unit
) {
    val tokens = YomicThemeTokens.colors
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clickable { onCheckedChange(!checked) }
            .padding(horizontal = 20.dp, vertical = 14.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(18.dp)
    ) {
        Icon(icon, contentDescription = null, tint = tokens.inkSecondary, modifier = Modifier.size(22.dp))
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = title,
                style = MaterialTheme.typography.bodyLarge,
                fontWeight = FontWeight.Medium,
                color = tokens.inkPrimary,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis
            )
            Text(
                text = subtitle,
                style = MaterialTheme.typography.bodySmall,
                color = tokens.inkMuted,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis
            )
        }
        Switch(
            checked = checked,
            onCheckedChange = onCheckedChange,
            colors = SwitchDefaults.colors(
                checkedThumbColor = tokens.onAccent,
                checkedTrackColor = tokens.accent,
                uncheckedThumbColor = tokens.inkMuted,
                uncheckedTrackColor = tokens.surface,
                uncheckedBorderColor = tokens.borderStrong
            )
        )
    }
}

@Composable
private fun MoreNavRow(
    icon: ImageVector,
    title: String,
    subtitle: String,
    badgeText: String? = null,
    showUnreadDot: Boolean = false,
    onClick: () -> Unit
) {
    val tokens = YomicThemeTokens.colors
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick)
            .padding(horizontal = 20.dp, vertical = 14.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(18.dp)
    ) {
        Box {
            Icon(icon, contentDescription = null, tint = tokens.inkSecondary, modifier = Modifier.size(22.dp))
            if (showUnreadDot) {
                Box(
                    modifier = Modifier
                        .size(7.dp)
                        .align(Alignment.TopEnd)
                        .clip(CircleShape)
                        .background(tokens.rose)
                )
            }
        }
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = title,
                style = MaterialTheme.typography.bodyLarge,
                fontWeight = FontWeight.Medium,
                color = tokens.inkPrimary,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis
            )
            Text(
                text = subtitle,
                style = MaterialTheme.typography.bodySmall,
                color = tokens.inkMuted,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis
            )
        }
        if (badgeText != null) {
            Box(
                modifier = Modifier
                    .clip(RoundedCornerShape(99.dp))
                    .background(tokens.surfaceAlt)
                    .padding(horizontal = 8.dp, vertical = 2.dp)
            ) {
                Text(badgeText, color = tokens.inkPrimary, fontSize = 11.sp, fontWeight = FontWeight.SemiBold)
            }
        }
    }
}

@Preview(name = "More Carbon Dark", showBackground = true, widthDp = 390, heightDp = 820)
@Composable
fun MoreScreenPreview() {
    val state = YomicUiState(
        categories = DemoDataRepository.createCategories(),
        downloads = DemoDataRepository.createInitialDownloads(),
        announcements = DemoDataRepository.createAnnouncements()
    )
    YomicTheme(darkTheme = true) {
        Scaffold(
            containerColor = YomicThemeTokens.colors.canvas,
            bottomBar = {
                YomicBottomNavigationBar(
                    currentRoute = YomicRoutes.MORE,
                    newUpdatesCount = 4,
                    onSelectTab = {}
                )
            }
        ) { innerPadding ->
            Box(modifier = Modifier.fillMaxSize().padding(bottom = innerPadding.calculateBottomPadding())) {
                MoreScreen(
                    state = state,
                    onToggleDarkMode = {},
                    onToggleOfflineMode = {},
                    onToggleIncognitoMode = {},
                    onAddCategory = {},
                    onDeleteCategory = {},
                    onOpenDownloads = {},
                    onOpenInsights = {},
                    onOpenStorage = {},
                    onOpenAnnouncements = {},
                    onOpenFeedback = {},
                    onOpenTutorial = {},
                    onOpenSettings = {},
                    onOpenAbout = {}
                )
            }
        }
    }
}
