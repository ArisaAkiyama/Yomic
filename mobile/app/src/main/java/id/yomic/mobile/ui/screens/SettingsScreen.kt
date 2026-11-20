package id.yomic.mobile.ui.screens

import androidx.activity.compose.BackHandler
import androidx.compose.animation.animateContentSize
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import id.yomic.mobile.R
import id.yomic.mobile.model.AppLanguage
import id.yomic.mobile.model.AppSettingsState
import id.yomic.mobile.model.ReaderFitMode
import id.yomic.mobile.model.ReaderMode
import id.yomic.mobile.model.ReadingDirection
import id.yomic.mobile.model.SourceLang
import id.yomic.mobile.ui.components.YomicConfirmDialog
import id.yomic.mobile.ui.i18n.yomicStrings
import id.yomic.mobile.ui.theme.YomicIcons
import id.yomic.mobile.ui.theme.YomicTheme
import id.yomic.mobile.ui.theme.YomicThemeTokens
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

enum class SettingsCategory {
    APPEARANCE,
    LIBRARY,
    READER,
    DOWNLOADS,
    TRACKER,
    BROWSE,
    STORAGE,
    SECURITY,
    ADVANCED,
    ABOUT
}

private data class ChoiceSheetRequest(
    val title: String,
    val options: List<Pair<String, String>>,
    val selectedKey: String,
    val onSelect: (String) -> Unit
)

private data class SettingsCategoryMeta(
    val category: SettingsCategory,
    val icon: ImageVector,
    val title: String
)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SettingsScreen(
    settings: AppSettingsState,
    onBack: () -> Unit,
    onUpdateSettings: ((AppSettingsState) -> AppSettingsState, String?) -> Unit,
    onClearHistory: () -> Unit,
    onResetApp: () -> Unit,
    onToast: (String) -> Unit,
    initialCategory: SettingsCategory? = null
) {
    val tokens = YomicThemeTokens.colors
    val s = yomicStrings

    var activeCategory by remember(initialCategory) { mutableStateOf(initialCategory) }
    var activeChoiceSheet by remember { mutableStateOf<ChoiceSheetRequest?>(null) }
    var showResetDialog by remember { mutableStateOf(false) }

    val canReturnToHub = activeCategory != null && initialCategory == null

    BackHandler(enabled = canReturnToHub) {
        activeCategory = null
    }

    val categoryMetas = listOf(
        SettingsCategoryMeta(SettingsCategory.APPEARANCE, YomicIcons.Palette, if (s.isEn) "Appearance" else "Tampilan"),
        SettingsCategoryMeta(SettingsCategory.LIBRARY, YomicIcons.Library, if (s.isEn) "Library" else "Pustaka"),
        SettingsCategoryMeta(SettingsCategory.READER, YomicIcons.BookOpen, if (s.isEn) "Reader" else "Pembaca"),
        SettingsCategoryMeta(SettingsCategory.DOWNLOADS, YomicIcons.Download, if (s.isEn) "Downloads" else "Unduhan"),
        SettingsCategoryMeta(SettingsCategory.TRACKER, YomicIcons.Link, if (s.isEn) "Tracking" else "Pelacakan"),
        SettingsCategoryMeta(SettingsCategory.BROWSE, YomicIcons.Browse, if (s.isEn) "Browse" else "Jelajahi"),
        SettingsCategoryMeta(SettingsCategory.STORAGE, YomicIcons.Storage, if (s.isEn) "Data and storage" else "Data dan penyimpanan"),
        SettingsCategoryMeta(SettingsCategory.SECURITY, YomicIcons.Shield, if (s.isEn) "Security and privacy" else "Keamanan dan privasi"),
        SettingsCategoryMeta(SettingsCategory.ADVANCED, YomicIcons.Code, if (s.isEn) "Advanced" else "Lanjutan"),
        SettingsCategoryMeta(SettingsCategory.ABOUT, YomicIcons.Info, if (s.isEn) "About" else "Tentang")
    )

    val topTitle = when (activeCategory) {
        null -> s.navSettings
        else -> categoryMetas.find { it.category == activeCategory }?.title ?: s.navSettings
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(tokens.canvas)
    ) {
        TopAppBar(
            colors = TopAppBarDefaults.topAppBarColors(containerColor = tokens.canvas),
            navigationIcon = {
                IconButton(
                    onClick = {
                        if (canReturnToHub) activeCategory = null else onBack()
                    }
                ) {
                    Icon(YomicIcons.ArrowBack, contentDescription = "Back", tint = tokens.inkPrimary, modifier = Modifier.size(21.dp))
                }
            },
            title = {
                Text(
                    text = topTitle,
                    style = MaterialTheme.typography.titleLarge,
                    color = tokens.inkPrimary,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
            }
        )

        if (activeCategory == null) {
            // 10-Category Flat Material 3 Settings Hub (Mihon-inspired)
            LazyColumn(
                contentPadding = PaddingValues(vertical = 4.dp),
                modifier = Modifier.fillMaxSize()
            ) {
                items(categoryMetas, key = { it.category.name }) { meta ->
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clickable { activeCategory = meta.category }
                            .padding(horizontal = 20.dp, vertical = 15.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(18.dp)
                    ) {
                        Icon(meta.icon, contentDescription = null, tint = tokens.accent, modifier = Modifier.size(22.dp))
                        Text(
                            text = meta.title,
                            style = MaterialTheme.typography.bodyLarge,
                            fontWeight = FontWeight.Medium,
                            color = tokens.inkPrimary,
                            modifier = Modifier.weight(1f),
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis
                        )
                    }
                }
            }
        } else {
            // Flat Edge-to-Edge Material 3 Sub-Pages (Zero card borders)
            LazyColumn(
                contentPadding = PaddingValues(bottom = 32.dp),
                modifier = Modifier.fillMaxSize()
            ) {
                when (activeCategory) {
                    SettingsCategory.APPEARANCE -> item {
                        SettingsGroupHeader(if (s.isEn) "Theme" else "Tema")
                        SettingsSwitchRow(
                            title = s.darkMode,
                            subtitle = if (s.isEn) "Antigravity Carbon Dark vs Oceanic Light" else "Beralih antara Carbon Dark dan Oceanic Light",
                            checked = settings.isDarkMode,
                            onCheckedChange = { v -> onUpdateSettings({ it.copy(isDarkMode = v) }, null) }
                        )
                        SettingsSwitchRow(
                            title = if (s.isEn) "Pure black dark mode" else "Mode gelap hitam pekat (OLED)",
                            subtitle = if (s.isEn) "Use true #000000 black background on OLED screens" else "Gunakan latar hitam pekat #000000 hemat daya OLED",
                            checked = settings.pureBlackDarkMode,
                            onCheckedChange = { v ->
                                onUpdateSettings(
                                    { it.copy(pureBlackDarkMode = v, isDarkMode = if (v) true else it.isDarkMode) },
                                    null
                                )
                            }
                        )
                        SettingsGroupDivider()
                        SettingsGroupHeader(if (s.isEn) "Display & Language" else "Tampilan & Bahasa")
                        SettingsChoiceRow(
                            title = s.interfaceLanguage,
                            valueLabel = if (settings.appLanguage == AppLanguage.EN) "English (EN)" else "Bahasa Indonesia (ID)",
                            onClick = {
                                activeChoiceSheet = ChoiceSheetRequest(
                                    title = s.interfaceLanguage,
                                    options = listOf("id" to "Bahasa Indonesia (ID)", "en" to "English (EN)"),
                                    selectedKey = settings.appLanguage.code,
                                    onSelect = { code ->
                                        val lang = if (code == "en") AppLanguage.EN else AppLanguage.ID
                                        onUpdateSettings(
                                            { it.copy(appLanguage = lang) },
                                            if (lang == AppLanguage.EN) "Language switched to English." else "Bahasa diubah ke Indonesia."
                                        )
                                    }
                                )
                            }
                        )
                        SettingsSwitchRow(
                            title = if (s.isEn) "Unread badges" else "Lencana bab belum dibaca",
                            subtitle = if (s.isEn) "Show unread chapter counter on library covers" else "Tampilkan jumlah bab baru pada sampul pustaka",
                            checked = settings.showUnreadBadges,
                            onCheckedChange = { v -> onUpdateSettings({ it.copy(showUnreadBadges = v) }, null) }
                        )
                        SettingsChoiceRow(
                            title = if (s.isEn) "Grid columns" else "Jumlah kolom grid",
                            valueLabel = if (s.isEn) "${settings.gridColumns} columns" else "${settings.gridColumns} kolom",
                            onClick = {
                                activeChoiceSheet = ChoiceSheetRequest(
                                    title = if (s.isEn) "Grid columns" else "Jumlah kolom grid",
                                    options = listOf(
                                        "2" to (if (s.isEn) "2 columns (Large covers)" else "2 kolom (Sampul besar)"),
                                        "3" to (if (s.isEn) "3 columns (Standard)" else "3 kolom (Standar)"),
                                        "4" to (if (s.isEn) "4 columns (Compact)" else "4 kolom (Ringkas)")
                                    ),
                                    selectedKey = settings.gridColumns.toString(),
                                    onSelect = { key ->
                                        val cols = key.toIntOrNull()?.coerceIn(2, 4) ?: 3
                                        onUpdateSettings(
                                            { it.copy(gridColumns = cols) },
                                            if (s.isEn) "Grid set to $cols columns." else "Grid diatur ke $cols kolom."
                                        )
                                    }
                                )
                            }
                        )
                    }

                    SettingsCategory.LIBRARY -> item {
                        SettingsGroupHeader(if (s.isEn) "Global update" else "Pembaruan global")
                        SettingsChoiceRow(
                            title = if (s.isEn) "Automatic updates" else "Interval pembaruan otomatis",
                            valueLabel = when (settings.backgroundUpdateInterval) {
                                "0" -> if (s.isEn) "Manual" else "Manual"
                                "6h" -> if (s.isEn) "Every 6 hours" else "Setiap 6 jam"
                                "12h" -> if (s.isEn) "Every 12 hours" else "Setiap 12 jam"
                                "24h" -> if (s.isEn) "Daily" else "Setiap hari"
                                else -> settings.backgroundUpdateInterval
                            },
                            onClick = {
                                activeChoiceSheet = ChoiceSheetRequest(
                                    title = if (s.isEn) "Automatic updates" else "Interval pembaruan otomatis",
                                    options = listOf(
                                        "0" to if (s.isEn) "Manual" else "Manual",
                                        "6h" to if (s.isEn) "Every 6 hours" else "Setiap 6 jam",
                                        "12h" to if (s.isEn) "Every 12 hours" else "Setiap 12 jam",
                                        "24h" to if (s.isEn) "Daily" else "Setiap hari"
                                    ),
                                    selectedKey = settings.backgroundUpdateInterval,
                                    onSelect = { v -> onUpdateSettings({ it.copy(backgroundUpdateInterval = v) }, null) }
                                )
                            }
                        )
                        SettingsSwitchRow(
                            title = if (s.isEn) "Auto-sync on startup" else "Sinkronisasi saat aplikasi dibuka",
                            subtitle = if (s.isEn) "Check library updates automatically on launch" else "Periksa pembaruan bab pustaka otomatis saat mulai",
                            checked = settings.autoSyncStartup,
                            onCheckedChange = { v -> onUpdateSettings({ it.copy(autoSyncStartup = v) }, null) }
                        )
                        SettingsSwitchRow(
                            title = if (s.isEn) "Smart update" else "Pembaruan cerdas (Smart Update)",
                            subtitle = if (s.isEn) "Skip completed manga and entries with unread chapters" else "Lewati komik tamat dan komik yang masih punya bab belum dibaca",
                            checked = settings.smartUpdate,
                            onCheckedChange = { v -> onUpdateSettings({ it.copy(smartUpdate = v) }, null) }
                        )
                    }

                    SettingsCategory.READER -> item {
                        SettingsGroupHeader(if (s.isEn) "Default layout" else "Tata letak bawaan")
                        SettingsChoiceRow(
                            title = s.readingMode,
                            valueLabel = when (settings.defaultReaderMode) {
                                ReaderMode.WEBTOON -> s.modeWebtoon
                                ReaderMode.SINGLE -> s.modeSingle
                                ReaderMode.DUAL -> s.modeDual
                            },
                            onClick = {
                                activeChoiceSheet = ChoiceSheetRequest(
                                    title = s.readingMode,
                                    options = listOf(
                                        ReaderMode.WEBTOON.name to s.modeWebtoon,
                                        ReaderMode.SINGLE.name to s.modeSingle,
                                        ReaderMode.DUAL.name to s.modeDual
                                    ),
                                    selectedKey = settings.defaultReaderMode.name,
                                    onSelect = { key ->
                                        onUpdateSettings({ it.copy(defaultReaderMode = ReaderMode.valueOf(key)) }, null)
                                    }
                                )
                            }
                        )
                        SettingsChoiceRow(
                            title = s.readingDirection,
                            valueLabel = if (settings.readingDirection == ReadingDirection.RTL) "RTL Manga (←)" else "LTR (→)",
                            onClick = {
                                activeChoiceSheet = ChoiceSheetRequest(
                                    title = s.readingDirection,
                                    options = listOf(
                                        ReadingDirection.LTR.name to "LTR (Kiri ke Kanan)",
                                        ReadingDirection.RTL.name to "RTL (Manga Kanan ke Kiri)"
                                    ),
                                    selectedKey = settings.readingDirection.name,
                                    onSelect = { key ->
                                        onUpdateSettings({ it.copy(readingDirection = ReadingDirection.valueOf(key)) }, null)
                                    }
                                )
                            }
                        )
                        SettingsChoiceRow(
                            title = if (s.isEn) "Scale type" else "Penyesuaian halaman",
                            valueLabel = when (settings.readerFitMode) {
                                ReaderFitMode.FIT_WIDTH -> if (s.isEn) "Fit width" else "Sesuaikan lebar"
                                ReaderFitMode.FIT_HEIGHT -> if (s.isEn) "Fit height" else "Sesuaikan tinggi"
                                ReaderFitMode.ORIGINAL -> if (s.isEn) "Original size" else "Ukuran asli"
                            },
                            onClick = {
                                activeChoiceSheet = ChoiceSheetRequest(
                                    title = if (s.isEn) "Scale type" else "Penyesuaian halaman",
                                    options = listOf(
                                        ReaderFitMode.FIT_WIDTH.name to if (s.isEn) "Fit width" else "Sesuaikan lebar",
                                        ReaderFitMode.FIT_HEIGHT.name to if (s.isEn) "Fit height" else "Sesuaikan tinggi",
                                        ReaderFitMode.ORIGINAL.name to if (s.isEn) "Original size" else "Ukuran asli"
                                    ),
                                    selectedKey = settings.readerFitMode.name,
                                    onSelect = { key ->
                                        onUpdateSettings({ it.copy(readerFitMode = ReaderFitMode.valueOf(key)) }, null)
                                    }
                                )
                            }
                        )
                        SettingsGroupDivider()
                        SettingsGroupHeader(if (s.isEn) "Display & Controls" else "Layar & Kontrol")
                        SettingsSwitchRow(
                            title = if (s.isEn) "Fullscreen" else "Layar penuh",
                            subtitle = if (s.isEn) "Hide status bar while reading" else "Sembunyikan bilah status saat membaca",
                            checked = settings.fullscreenReader,
                            onCheckedChange = { v -> onUpdateSettings({ it.copy(fullscreenReader = v) }, null) }
                        )
                        SettingsSwitchRow(
                            title = if (s.isEn) "Keep screen on" else "Jaga layar tetap menyala",
                            subtitle = if (s.isEn) "Prevent display sleep during reading" else "Cegah layar mati otomatis saat membaca komik",
                            checked = settings.keepScreenOn,
                            onCheckedChange = { v -> onUpdateSettings({ it.copy(keepScreenOn = v) }, null) }
                        )
                        SettingsSwitchRow(
                            title = if (s.isEn) "Volume keys navigation" else "Navigasi tombol volume",
                            subtitle = if (s.isEn) "Use hardware volume buttons to turn pages" else "Gunakan tombol volume untuk pindah halaman",
                            checked = settings.volumeKeysNavigation,
                            onCheckedChange = { v -> onUpdateSettings({ it.copy(volumeKeysNavigation = v) }, null) }
                        )
                        SettingsSwitchRow(
                            title = if (s.isEn) "Auto dark reader background" else "Latar pembaca gelap otomatis",
                            subtitle = if (s.isEn) "Always use deep dark canvas inside reader" else "Selalu gunakan kanvas gelap di dalam pembaca",
                            checked = settings.autoDarkReader,
                            onCheckedChange = { v -> onUpdateSettings({ it.copy(autoDarkReader = v) }, null) }
                        )
                        SettingsGroupDivider()
                        SettingsGroupHeader(if (s.isEn) "Image processing" else "Pemrosesan gambar")
                        SettingsSwitchRow(
                            title = if (s.isEn) "Crop borders" else "Potong tepi putih (Auto-Crop)",
                            subtitle = if (s.isEn) "Trim blank margins around comic pages" else "Pangkas margin kosong di tepi halaman komik",
                            checked = settings.enableAutoCropBorders,
                            onCheckedChange = { v -> onUpdateSettings({ it.copy(enableAutoCropBorders = v) }, null) }
                        )
                        SettingsSwitchRow(
                            title = if (s.isEn) "Image sharpening" else "Penajaman gambar",
                            subtitle = if (s.isEn) "Enhance lineart & speech bubble clarity" else "Tingkatkan ketajaman garis dan teks balon komik",
                            checked = settings.enableImageSharpening,
                            onCheckedChange = { v -> onUpdateSettings({ it.copy(enableImageSharpening = v) }, null) }
                        )
                        SettingsSwitchRow(
                            title = if (s.isEn) "Smart memory optimization" else "Optimasi memori cerdas",
                            subtitle = if (s.isEn) "Lower RAM & GPU usage on long webtoons" else "Hemat RAM dan beban GPU pada webtoon panjang",
                            checked = settings.enableImageOptimization,
                            onCheckedChange = { v -> onUpdateSettings({ it.copy(enableImageOptimization = v) }, null) }
                        )
                        SettingsChoiceRow(
                            title = if (s.isEn) "Max image resolution" else "Batas resolusi gambar",
                            valueLabel = when (settings.maxImageDimension) {
                                1440 -> "1440 px"
                                2160 -> "2160 px (4K)"
                                3840 -> "3840 px"
                                else -> if (s.isEn) "Original" else "Asli"
                            },
                            onClick = {
                                activeChoiceSheet = ChoiceSheetRequest(
                                    title = if (s.isEn) "Max image resolution" else "Batas resolusi gambar",
                                    options = listOf(
                                        "1440" to "1440 px (Hemat RAM)",
                                        "2160" to "2160 px (Seimbang)",
                                        "3840" to "3840 px (Ultra HD)",
                                        "0" to if (s.isEn) "Original (No limit)" else "Asli (Tanpa batas)"
                                    ),
                                    selectedKey = settings.maxImageDimension.toString(),
                                    onSelect = { key ->
                                        onUpdateSettings({ it.copy(maxImageDimension = key.toIntOrNull() ?: 2160) }, null)
                                    }
                                )
                            }
                        )
                    }

                    SettingsCategory.DOWNLOADS -> item {
                        SettingsGroupHeader(if (s.isEn) "Download behavior" else "Perilaku unduhan")
                        SettingsSwitchRow(
                            title = if (s.isEn) "Only on Wi-Fi" else "Unduh hanya via Wi-Fi",
                            subtitle = if (s.isEn) "Pause downloads when on cellular data" else "Jeda unduhan otomatis saat memakai data seluler",
                            checked = settings.downloadOnlyOnWifi,
                            onCheckedChange = { v -> onUpdateSettings({ it.copy(downloadOnlyOnWifi = v) }, null) }
                        )
                        SettingsSwitchRow(
                            title = if (s.isEn) "Save chapters as CBZ archive" else "Simpan bab sebagai arsip CBZ",
                            subtitle = if (s.isEn) "Bundle downloaded pages into a single .cbz file" else "Gabungkan halaman unduhan menjadi satu file .cbz",
                            checked = settings.saveDownloadsAsCbz,
                            onCheckedChange = { v -> onUpdateSettings({ it.copy(saveDownloadsAsCbz = v) }, null) }
                        )
                        SettingsGroupDivider()
                        SettingsGroupHeader(if (s.isEn) "Automation" else "Otomatisasi")
                        SettingsSwitchRow(
                            title = if (s.isEn) "Delete after reading" else "Hapus otomatis setelah dibaca",
                            subtitle = if (s.isEn) "Remove downloaded chapter once finished" else "Hapus file bab unduhan otomatis setelah selesai dibaca",
                            checked = settings.autoDeleteAfterRead,
                            onCheckedChange = { v -> onUpdateSettings({ it.copy(autoDeleteAfterRead = v) }, null) }
                        )
                        SettingsSwitchRow(
                            title = if (s.isEn) "Auto-download next chapter" else "Unduh otomatis bab berikutnya",
                            subtitle = if (s.isEn) "Queue the next chapter while reading" else "Otomatis antrekan bab berikutnya saat membaca",
                            checked = settings.autoDownloadNextChapter,
                            onCheckedChange = { v -> onUpdateSettings({ it.copy(autoDownloadNextChapter = v) }, null) }
                        )
                        SettingsSwitchRow(
                            title = if (s.isEn) "Preload next chapter" else "Pra-muat bab berikutnya",
                            subtitle = if (s.isEn) "Cache upcoming pages for seamless scrolling" else "Muat halaman berikutnya lebih awal agar gulir mulus",
                            checked = settings.preloadNextChapter,
                            onCheckedChange = { v -> onUpdateSettings({ it.copy(preloadNextChapter = v) }, null) }
                        )
                        SettingsSwitchRow(
                            title = if (s.isEn) "Skip filtered chapters" else "Lewati bab yang difilter",
                            subtitle = if (s.isEn) "Jump over filtered chapters during navigation" else "Lewati bab terfilter saat berpindah bab",
                            checked = settings.skipFilteredChapters,
                            onCheckedChange = { v -> onUpdateSettings({ it.copy(skipFilteredChapters = v) }, null) }
                        )
                    }

                    SettingsCategory.TRACKER -> item {
                        SettingsGroupHeader(if (s.isEn) "Trackers" else "Layanan pelacakan")
                        SettingsActionRow(
                            title = "MyAnimeList",
                            subtitle = if (settings.isMalConnected) {
                                if (s.isEn) "Signed in as @${settings.malConnectedUser}" else "Terhubung sebagai @${settings.malConnectedUser}"
                            } else {
                                if (s.isEn) "Not connected" else "Belum terhubung"
                            },
                            buttonText = if (settings.isMalConnected) s.disconnectMal else s.connectMal,
                            isPrimary = !settings.isMalConnected,
                            onClick = {
                                val next = !settings.isMalConnected
                                onUpdateSettings(
                                    { it.copy(isMalConnected = next) },
                                    if (next) (if (s.isEn) "Connected to MyAnimeList (@${settings.malConnectedUser})." else "Terhubung ke MyAnimeList (@${settings.malConnectedUser}).")
                                    else (if (s.isEn) "Disconnected from MyAnimeList." else "Koneksi MyAnimeList diputus.")
                                )
                            }
                        )
                        SettingsGroupDivider()
                        SettingsGroupHeader(if (s.isEn) "Sync" else "Sinkronisasi")
                        SettingsSwitchRow(
                            title = if (s.isEn) "Update progress after reading" else "Sinkronisasi progres otomatis",
                            subtitle = if (s.isEn) "Push chapter progress to MyAnimeList automatically" else "Kirim progres bab terbaru ke MyAnimeList otomatis",
                            checked = settings.autoSyncTracker,
                            onCheckedChange = { v -> onUpdateSettings({ it.copy(autoSyncTracker = v) }, null) }
                        )
                    }

                    SettingsCategory.BROWSE -> item {
                        SettingsGroupHeader(if (s.isEn) "Extensions" else "Ekstensi")
                        SettingsSwitchRow(
                            title = if (s.isEn) "Check for extension updates" else "Periksa pembaruan ekstensi",
                            subtitle = if (s.isEn) "Notify when installed source plugins have updates" else "Beri tahu saat plugin sumber terpasang memiliki versi baru",
                            checked = settings.checkExtensionUpdates,
                            onCheckedChange = { v -> onUpdateSettings({ it.copy(checkExtensionUpdates = v) }, null) }
                        )
                        SettingsChoiceRow(
                            title = if (s.isEn) "MangaDex language" else "Bahasa katalog MangaDex",
                            valueLabel = if (settings.mangaDexLanguage == SourceLang.ID) "Indonesia (ID)" else "English (EN)",
                            onClick = {
                                activeChoiceSheet = ChoiceSheetRequest(
                                    title = if (s.isEn) "MangaDex language" else "Bahasa katalog MangaDex",
                                    options = listOf(
                                        SourceLang.ID.name to "Indonesia (ID)",
                                        SourceLang.EN.name to "English (EN)"
                                    ),
                                    selectedKey = settings.mangaDexLanguage.name,
                                    onSelect = { key ->
                                        onUpdateSettings({ it.copy(mangaDexLanguage = SourceLang.valueOf(key)) }, null)
                                    }
                                )
                            }
                        )
                        SettingsGroupDivider()
                        SettingsGroupHeader(if (s.isEn) "Content filter" else "Filter konten")
                        SettingsSwitchRow(
                            title = if (s.isEn) "Show NSFW (18+) sources" else "Tampilkan sumber NSFW (18+)",
                            subtitle = if (s.isEn) "Display adult extensions in Browse & Extensions" else "Tampilkan ekstensi dewasa di menu Jelajahi & Ekstensi",
                            checked = settings.showNsfw,
                            onCheckedChange = { v -> onUpdateSettings({ it.copy(showNsfw = v) }, null) }
                        )
                        SettingsSwitchRow(
                            title = if (s.isEn) "Blur explicit covers" else "Samarkan sampul eksplisit",
                            subtitle = if (s.isEn) "Apply blur overlay on sensitive comic covers" else "Terapkan efek buram pada sampul komik sensitif",
                            checked = settings.blurExplicitCovers,
                            onCheckedChange = { v -> onUpdateSettings({ it.copy(blurExplicitCovers = v) }, null) }
                        )
                    }

                    SettingsCategory.STORAGE -> item {
                        SettingsGroupHeader(if (s.isEn) "Backup and restore" else "Cadangan dan pemulihan")
                        SettingsClickableRow(
                            title = s.createBackup,
                            subtitle = settings.lastBackupText,
                            onClick = {
                                onUpdateSettings(
                                    { it.copy(lastBackupText = if (s.isEn) "Backed up just now (.yomicbackup)" else "Terakhir dicadangkan baru saja (.yomicbackup)") },
                                    if (s.isEn) "Backup exported successfully." else "Cadangan berhasil diekspor (.yomicbackup)."
                                )
                            }
                        )
                        SettingsClickableRow(
                            title = s.restoreBackup,
                            subtitle = if (s.isEn) "Import library, categories & reading progress" else "Impor pustaka, kategori, dan progres baca dari file",
                            onClick = {
                                onToast(if (s.isEn) "Backup restored cleanly." else "Cadangan berhasil dipulihkan.")
                            }
                        )
                        SettingsGroupDivider()
                        SettingsGroupHeader(if (s.isEn) "Storage & Cache" else "Penyimpanan & Cache")
                        SettingsChoiceRow(
                            title = if (s.isEn) "Reader cache limit" else "Kapasitas cache pembaca",
                            valueLabel = settings.maxReaderCacheSize,
                            onClick = {
                                activeChoiceSheet = ChoiceSheetRequest(
                                    title = if (s.isEn) "Reader cache limit" else "Kapasitas cache pembaca",
                                    options = listOf("250 MB" to "250 MB", "500 MB" to "500 MB", "1 GB" to "1 GB", "2 GB" to "2 GB"),
                                    selectedKey = settings.maxReaderCacheSize,
                                    onSelect = { size -> onUpdateSettings({ it.copy(maxReaderCacheSize = size) }, null) }
                                )
                            }
                        )
                        SettingsClickableRow(
                            title = s.clearCache,
                            subtitle = if (s.isEn) "Used: ${settings.cacheSizeText}" else "Terpakai: ${settings.cacheSizeText}",
                            onClick = {
                                onUpdateSettings(
                                    { it.copy(cacheSizeText = "0.0 MB") },
                                    if (s.isEn) "Image cache cleared." else "Cache gambar berhasil dibersihkan."
                                )
                            }
                        )
                        SettingsClickableRow(
                            title = if (s.isEn) "Clear reading history" else "Kosongkan riwayat baca",
                            subtitle = if (s.isEn) "Remove reading history without deleting library entries" else "Hapus daftar riwayat tanpa menghapus komik dari pustaka",
                            isDestructive = true,
                            onClick = onClearHistory
                        )
                    }

                    SettingsCategory.SECURITY -> item {
                        SettingsGroupHeader(if (s.isEn) "Security" else "Keamanan")
                        SettingsSwitchRow(
                            title = if (s.isEn) "Require unlock (Biometric / PIN)" else "Kunci aplikasi (Biometrik / PIN)",
                            subtitle = if (s.isEn) "Protect Yomic with fingerprint or device PIN" else "Lindungi aplikasi Yomic dengan sidik jari atau PIN",
                            checked = settings.appLockEnabled,
                            onCheckedChange = { v ->
                                onUpdateSettings(
                                    { it.copy(appLockEnabled = v) },
                                    if (v) (if (s.isEn) "App lock enabled." else "Kunci aplikasi diaktifkan.")
                                    else (if (s.isEn) "App lock disabled." else "Kunci aplikasi dinonaktifkan.")
                                )
                            }
                        )
                        SettingsSwitchRow(
                            title = if (s.isEn) "Secure screen" else "Layar aman (Secure screen)",
                            subtitle = if (s.isEn) "Hide app content in Recent Apps switcher" else "Sembunyikan tampilan aplikasi di daftar Recent Apps",
                            checked = settings.secureScreenEnabled,
                            onCheckedChange = { v -> onUpdateSettings({ it.copy(secureScreenEnabled = v) }, null) }
                        )
                        SettingsGroupDivider()
                        SettingsGroupHeader(if (s.isEn) "Privacy" else "Privasi")
                        SettingsSwitchRow(
                            title = if (s.isEn) "Incognito mode" else "Mode penyamaran",
                            subtitle = if (s.isEn) "Pause reading history while browsing or reading" else "Hentikan pencatatan riwayat baca sementara",
                            checked = settings.isIncognitoMode,
                            onCheckedChange = { v -> onUpdateSettings({ it.copy(isIncognitoMode = v) }, null) }
                        )
                    }

                    SettingsCategory.ADVANCED -> item {
                        SettingsGroupHeader(if (s.isEn) "Networking" else "Jaringan")
                        SettingsChoiceRow(
                            title = "DNS over HTTPS (DoH)",
                            valueLabel = settings.dohProvider,
                            onClick = {
                                activeChoiceSheet = ChoiceSheetRequest(
                                    title = "DNS over HTTPS (DoH)",
                                    options = listOf(
                                        "Cloudflare (1.1.1.1)" to "Cloudflare (1.1.1.1)",
                                        "Google (8.8.8.8)" to "Google (8.8.8.8)",
                                        "Quad9 (9.9.9.9)" to "Quad9 (9.9.9.9)",
                                        "AdGuard DNS" to "AdGuard DNS",
                                        "System Default" to if (s.isEn) "Disabled (System DNS)" else "Nonaktif (DNS Sistem)"
                                    ),
                                    selectedKey = settings.dohProvider,
                                    onSelect = { provider ->
                                        onUpdateSettings(
                                            { it.copy(dohProvider = provider) },
                                            if (s.isEn) "DoH set to $provider." else "DoH diatur ke $provider."
                                        )
                                    }
                                )
                            }
                        )
                        SettingsChoiceRow(
                            title = if (s.isEn) "Source health check interval" else "Interval pemeriksaan sumber",
                            valueLabel = settings.sourceStatusInterval,
                            onClick = {
                                activeChoiceSheet = ChoiceSheetRequest(
                                    title = if (s.isEn) "Source health check interval" else "Interval pemeriksaan sumber",
                                    options = listOf("15m" to "15 menit", "30m" to "30 menit", "1h" to "1 jam", "Off" to "Nonaktif"),
                                    selectedKey = settings.sourceStatusInterval,
                                    onSelect = { interval -> onUpdateSettings({ it.copy(sourceStatusInterval = interval) }, null) }
                                )
                            }
                        )
                        SettingsChoiceRow(
                            title = if (s.isEn) "Default user agent" else "User-Agent bawaan",
                            valueLabel = if (settings.customUserAgent.contains("Chrome")) "Chrome Mobile" else "Yomic Mobile",
                            onClick = {
                                activeChoiceSheet = ChoiceSheetRequest(
                                    title = if (s.isEn) "Default user agent" else "User-Agent bawaan",
                                    options = listOf(
                                        "Mozilla/5.0 (Android 15; Mobile) Yomic/2.1" to "Yomic Mobile (Default)",
                                        "Mozilla/5.0 (Linux; Android 15) Chrome/131.0 Mobile" to "Chrome Mobile (Bypass Cloudflare)"
                                    ),
                                    selectedKey = settings.customUserAgent,
                                    onSelect = { ua -> onUpdateSettings({ it.copy(customUserAgent = ua) }, null) }
                                )
                            }
                        )
                        SettingsGroupDivider()
                        SettingsGroupHeader(if (s.isEn) "WebView & Maintenance" else "WebView & Pemeliharaan")
                        SettingsClickableRow(
                            title = if (s.isEn) "Clear WebView cookies" else "Bersihkan cookie WebView",
                            subtitle = if (s.isEn) "Reset Cloudflare & login sessions for sources" else "Atur ulang sesi Cloudflare dan login sumber komik",
                            onClick = {
                                onToast(if (s.isEn) "WebView cookies cleared." else "Cookie WebView berhasil dibersihkan.")
                            }
                        )
                    }

                    SettingsCategory.ABOUT -> item {
                        val scope = rememberCoroutineScope()
                        var isCheckingUpdate by remember { mutableStateOf(false) }
                        var updateStatusText by remember { mutableStateOf<String?>(null) }
                        var showChangelog by remember { mutableStateOf(false) }

                        Column(modifier = Modifier.fillMaxWidth()) {
                            Column(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(top = 28.dp, bottom = 24.dp),
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
                                Spacer(Modifier.height(3.dp))
                                Text(
                                    text = if (s.isEn) "Lightweight, ad-free comic reader" else "Pembaca komik ringan & bebas iklan",
                                    style = MaterialTheme.typography.bodySmall,
                                    color = tokens.inkMuted
                                )
                            }

                            HorizontalDivider(color = tokens.borderSubtle, thickness = 0.8.dp)

                            SettingsClickableRow(
                                title = if (s.isEn) "Version" else "Versi",
                                subtitle = "Stable 2.1.0 (Android Native)",
                                onClick = {
                                    onToast(if (s.isEn) "Version copied: Yomic v2.1.0" else "Versi disalin: Yomic v2.1.0")
                                }
                            )

                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .clickable(enabled = !isCheckingUpdate) {
                                        isCheckingUpdate = true
                                        scope.launch {
                                            delay(900L)
                                            isCheckingUpdate = false
                                            updateStatusText = if (s.isEn) "Up to date · Checked just now" else "Sudah versi terbaru · Baru saja diperiksa"
                                            onToast(if (s.isEn) "You are on the latest version (v2.1.0)." else "Yomic sudah versi terbaru (v2.1.0).")
                                        }
                                    }
                                    .padding(horizontal = 20.dp, vertical = 14.dp),
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(14.dp)
                            ) {
                                Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                                    Text(
                                        text = s.checkAppUpdate,
                                        style = MaterialTheme.typography.bodyLarge,
                                        fontWeight = FontWeight.Medium,
                                        color = tokens.inkPrimary
                                    )
                                    Text(
                                        text = when {
                                            isCheckingUpdate -> if (s.isEn) "Checking for updates..." else "Memeriksa pembaruan..."
                                            updateStatusText != null -> updateStatusText!!
                                            else -> if (s.isEn) "Check GitHub releases for newer builds" else "Periksa versi rilis terbaru dari server"
                                        },
                                        style = MaterialTheme.typography.bodySmall,
                                        color = if (updateStatusText != null && !isCheckingUpdate) tokens.accent else tokens.inkMuted
                                    )
                                }
                                if (isCheckingUpdate) {
                                    CircularProgressIndicator(
                                        modifier = Modifier.size(18.dp),
                                        strokeWidth = 2.dp,
                                        color = tokens.accent
                                    )
                                }
                            }

                            Column(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .animateContentSize()
                                    .clickable { showChangelog = !showChangelog }
                                    .padding(horizontal = 20.dp, vertical = 14.dp)
                            ) {
                                Row(
                                    modifier = Modifier.fillMaxWidth(),
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.SpaceBetween
                                ) {
                                    Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                                        Text(
                                            text = if (s.isEn) "What's new" else "Catatan rilis",
                                            style = MaterialTheme.typography.bodyLarge,
                                            fontWeight = FontWeight.Medium,
                                            color = tokens.inkPrimary
                                        )
                                        Text(
                                            text = "v2.1.0",
                                            style = MaterialTheme.typography.bodySmall,
                                            color = tokens.inkMuted
                                        )
                                    }
                                    Icon(
                                        imageVector = if (showChangelog) YomicIcons.ChevronUp else YomicIcons.ChevronDown,
                                        contentDescription = null,
                                        tint = tokens.inkMuted,
                                        modifier = Modifier.size(18.dp)
                                    )
                                }
                                if (showChangelog) {
                                    Column(
                                        modifier = Modifier.padding(top = 12.dp),
                                        verticalArrangement = Arrangement.spacedBy(6.dp)
                                    ) {
                                        val notes = if (s.isEn) listOf(
                                            "• 10-category Mihon-style flat Settings & Pure Black OLED mode.",
                                            "• MyAnimeList Search & Bind directly inside Manga Detail.",
                                            "• Incognito mode & seamless auto-load next chapter in Reader."
                                        ) else listOf(
                                            "• Pengaturan 10 kategori flat Material 3 & mode Hitam Pekat OLED.",
                                            "• Pencarian & tautkan MyAnimeList langsung dari detail komik.",
                                            "• Mode penyamaran & lanjut bab otomatis saat scroll di Reader."
                                        )
                                        notes.forEach { note ->
                                            Text(
                                                text = note,
                                                style = MaterialTheme.typography.bodySmall,
                                                color = tokens.inkSecondary,
                                                lineHeight = 19.sp
                                            )
                                        }
                                    }
                                }
                            }

                            SettingsGroupDivider()

                            SettingsClickableRow(
                                title = s.resetApp,
                                subtitle = if (s.isEn) "Restore all settings and demo library to default" else "Kembalikan seluruh pengaturan dan data ke bawaan",
                                isDestructive = true,
                                onClick = { showResetDialog = true }
                            )
                        }
                    }

                    null -> Unit
                }
            }
        }
    }

    activeChoiceSheet?.let { req ->
        ModalBottomSheet(
            onDismissRequest = { activeChoiceSheet = null },
            containerColor = tokens.surface
        ) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp)
                    .padding(bottom = 26.dp),
                verticalArrangement = Arrangement.spacedBy(4.dp)
            ) {
                Text(req.title, style = MaterialTheme.typography.titleMedium, color = tokens.inkPrimary, modifier = Modifier.padding(8.dp))
                req.options.forEach { (key, label) ->
                    SheetCheckOptionRow(
                        label = label,
                        selected = key == req.selectedKey,
                        onClick = {
                            req.onSelect(key)
                            activeChoiceSheet = null
                        }
                    )
                }
            }
        }
    }

    if (showResetDialog) {
        YomicConfirmDialog(
            title = s.resetApp,
            message = if (s.isEn) "Reset all mobile UI demo data and settings back to factory defaults?" else "Atur ulang seluruh data demo dan pengaturan mobile ke bawaan pabrik?",
            confirmText = s.reset,
            cancelText = s.cancel,
            isDanger = true,
            onConfirm = {
                showResetDialog = false
                onResetApp()
            },
            onDismiss = { showResetDialog = false }
        )
    }
}

@Composable
private fun SettingsGroupHeader(title: String) {
    Text(
        text = title,
        style = MaterialTheme.typography.labelLarge,
        fontWeight = FontWeight.SemiBold,
        color = YomicThemeTokens.colors.accent,
        modifier = Modifier.padding(start = 20.dp, end = 20.dp, top = 16.dp, bottom = 6.dp)
    )
}

@Composable
private fun SettingsGroupDivider() {
    HorizontalDivider(
        color = YomicThemeTokens.colors.borderSubtle,
        thickness = 0.8.dp,
        modifier = Modifier.padding(top = 6.dp)
    )
}

@Composable
private fun SettingsSwitchRow(
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
        verticalAlignment = Alignment.CenterVertically
    ) {
        Column(modifier = Modifier.weight(1f).padding(end = 14.dp), verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Text(
                text = title,
                style = MaterialTheme.typography.bodyLarge,
                fontWeight = FontWeight.Medium,
                color = tokens.inkPrimary
            )
            Text(
                text = subtitle,
                style = MaterialTheme.typography.bodySmall,
                color = tokens.inkMuted
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
private fun SettingsChoiceRow(
    title: String,
    valueLabel: String,
    onClick: () -> Unit
) {
    val tokens = YomicThemeTokens.colors
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick)
            .padding(horizontal = 20.dp, vertical = 14.dp),
        verticalArrangement = Arrangement.spacedBy(2.dp)
    ) {
        Text(
            text = title,
            style = MaterialTheme.typography.bodyLarge,
            fontWeight = FontWeight.Medium,
            color = tokens.inkPrimary
        )
        Text(
            text = valueLabel,
            style = MaterialTheme.typography.bodySmall,
            color = tokens.inkMuted
        )
    }
}

@Composable
private fun SettingsClickableRow(
    title: String,
    subtitle: String,
    isDestructive: Boolean = false,
    onClick: () -> Unit
) {
    val tokens = YomicThemeTokens.colors
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick)
            .padding(horizontal = 20.dp, vertical = 14.dp),
        verticalArrangement = Arrangement.spacedBy(2.dp)
    ) {
        Text(
            text = title,
            style = MaterialTheme.typography.bodyLarge,
            fontWeight = FontWeight.Medium,
            color = if (isDestructive) tokens.rose else tokens.inkPrimary
        )
        Text(
            text = subtitle,
            style = MaterialTheme.typography.bodySmall,
            color = tokens.inkMuted
        )
    }
}

@Composable
private fun SettingsActionRow(
    title: String,
    subtitle: String,
    buttonText: String,
    isPrimary: Boolean = false,
    onClick: () -> Unit
) {
    val tokens = YomicThemeTokens.colors
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 20.dp, vertical = 14.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Column(modifier = Modifier.weight(1f).padding(end = 12.dp), verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Text(
                text = title,
                style = MaterialTheme.typography.bodyLarge,
                fontWeight = FontWeight.Medium,
                color = tokens.inkPrimary
            )
            Text(
                text = subtitle,
                style = MaterialTheme.typography.bodySmall,
                color = tokens.inkMuted
            )
        }
        if (isPrimary) {
            Button(
                onClick = onClick,
                colors = ButtonDefaults.buttonColors(
                    containerColor = tokens.accent,
                    contentColor = tokens.onAccent
                ),
                shape = RoundedCornerShape(10.dp),
                contentPadding = PaddingValues(horizontal = 14.dp, vertical = 8.dp)
            ) {
                Text(buttonText, color = tokens.onAccent, fontSize = 12.5.sp, fontWeight = FontWeight.SemiBold)
            }
        } else {
            OutlinedButton(
                onClick = onClick,
                shape = RoundedCornerShape(10.dp),
                contentPadding = PaddingValues(horizontal = 14.dp, vertical = 8.dp)
            ) {
                Text(buttonText, color = tokens.inkPrimary, fontSize = 12.5.sp, fontWeight = FontWeight.SemiBold)
            }
        }
    }
}

@Preview(name = "Settings Hub Dark", showBackground = true, widthDp = 390, heightDp = 820)
@Composable
fun SettingsHubPreview() {
    YomicTheme(darkTheme = true) {
        SettingsScreen(
            settings = AppSettingsState(),
            onBack = {},
            onUpdateSettings = { _, _ -> },
            onClearHistory = {},
            onResetApp = {},
            onToast = {}
        )
    }
}

@Preview(name = "Settings Reader SubPage Dark", showBackground = true, widthDp = 390, heightDp = 820)
@Composable
fun SettingsReaderSubPagePreview() {
    YomicTheme(darkTheme = true) {
        SettingsScreen(
            settings = AppSettingsState(),
            onBack = {},
            onUpdateSettings = { _, _ -> },
            onClearHistory = {},
            onResetApp = {},
            onToast = {},
            initialCategory = SettingsCategory.READER
        )
    }
}

@Preview(name = "Settings About SubPage Dark", showBackground = true, widthDp = 390, heightDp = 820)
@Composable
fun SettingsAboutSubPagePreview() {
    YomicTheme(darkTheme = true) {
        SettingsScreen(
            settings = AppSettingsState(),
            onBack = {},
            onUpdateSettings = { _, _ -> },
            onClearHistory = {},
            onResetApp = {},
            onToast = {},
            initialCategory = SettingsCategory.ABOUT
        )
    }
}
