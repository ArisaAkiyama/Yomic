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
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FilterChipDefaults
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Tab
import androidx.compose.material3.TabRow
import androidx.compose.material3.TabRowDefaults
import androidx.compose.material3.TabRowDefaults.tabIndicatorOffset
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.material3.Scaffold
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.sp
import id.yomic.mobile.data.DemoDataRepository
import id.yomic.mobile.model.ExtensionItem
import id.yomic.mobile.model.SourceLang
import id.yomic.mobile.model.YomicUiState
import id.yomic.mobile.ui.components.InlineSearchInput
import id.yomic.mobile.ui.components.MangaGridCard
import id.yomic.mobile.ui.components.ServerStatusIndicator
import id.yomic.mobile.ui.components.SourceAvatarBadge
import id.yomic.mobile.ui.components.YomicEmptyState
import id.yomic.mobile.ui.i18n.yomicStrings
import id.yomic.mobile.ui.navigation.YomicBottomNavigationBar
import id.yomic.mobile.ui.navigation.YomicRoutes
import id.yomic.mobile.ui.theme.YomicIcons
import id.yomic.mobile.ui.theme.YomicTheme
import id.yomic.mobile.ui.theme.YomicThemeTokens

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun BrowseScreen(
    state: YomicUiState,
    onBrowseSearchChange: (String) -> Unit,
    onBrowseLangChange: (SourceLang) -> Unit,
    onExtSearchChange: (String) -> Unit,
    onExtLangChange: (SourceLang) -> Unit,
    onRefreshRepo: () -> Unit,
    onInstallOrUpdateExt: (String) -> Unit,
    onUninstallExt: (String) -> Unit,
    onOpenSourceCatalog: (String) -> Unit,
    onOpenInBrowserToast: (String) -> Unit,
    onTogglePinSource: (String) -> Unit = {},
    onOpenMangaDetail: (String) -> Unit = {},
    initialTab: Int = 0
) {
    val tokens = YomicThemeTokens.colors
    val s = yomicStrings
    var activeTab by rememberSaveable { mutableIntStateOf(initialTab) } // 0 = Sources, 1 = Extensions
    var isSearchOpen by remember { mutableStateOf(false) }

    val visibleSources = remember(state.extensions, state.settings.showNsfw, state.browseLangFilter, state.browseSearchQuery) {
        val q = state.browseSearchQuery.trim().lowercase()
        state.extensions
            .filter { it.installed }
            .filter { state.settings.showNsfw || !it.isNsfw }
            .filter { state.browseLangFilter == SourceLang.ALL || it.lang == state.browseLangFilter || it.lang == SourceLang.ALL }
            .filter { q.isEmpty() || it.name.lowercase().contains(q) || it.cleanDomain.lowercase().contains(q) }
            .sortedBy { it.name.lowercase() }
    }

    val visibleExtensions = remember(state.extensions, state.settings.showNsfw, state.extLangFilter, state.extSearchQuery) {
        val q = state.extSearchQuery.trim().lowercase()
        state.extensions
            .filter { state.settings.showNsfw || !it.isNsfw }
            .filter { state.extLangFilter == SourceLang.ALL || it.lang == state.extLangFilter || it.lang == SourceLang.ALL }
            .filter { q.isEmpty() || it.name.lowercase().contains(q) || it.cleanDomain.lowercase().contains(q) }
            .sortedBy { it.name.lowercase() }
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
                        query = if (activeTab == 0) state.browseSearchQuery else state.extSearchQuery,
                        placeholder = if (activeTab == 0) {
                            if (s.isEn) "Global search comics or sources..." else "Cari komik lintas sumber atau nama sumber..."
                        } else s.searchExtensionsHint,
                        onQueryChange = {
                            if (activeTab == 0) onBrowseSearchChange(it) else onExtSearchChange(it)
                        },
                        onClose = {
                            isSearchOpen = false
                            if (activeTab == 0) onBrowseSearchChange("") else onExtSearchChange("")
                        }
                    )
                } else {
                    Text(s.navBrowse, style = MaterialTheme.typography.titleLarge, color = tokens.inkPrimary)
                }
            },
            actions = {
                if (!isSearchOpen) {
                    IconButton(onClick = { isSearchOpen = true }) {
                        Icon(YomicIcons.Search, contentDescription = s.search, tint = tokens.inkPrimary, modifier = Modifier.size(20.dp))
                    }
                    IconButton(onClick = onRefreshRepo, enabled = !state.isRefreshingRepo) {
                        Icon(
                            YomicIcons.Updates,
                            contentDescription = s.refresh,
                            tint = if (state.isRefreshingRepo) tokens.accent else tokens.inkPrimary,
                            modifier = Modifier.size(20.dp)
                        )
                    }
                }
            }
        )

        // Mihon-style 2-Tab Hub: Sumber | Ekstensi
        val updatesCount = state.extensions.count { it.installed && it.hasUpdate }
        TabRow(
            selectedTabIndex = activeTab,
            containerColor = tokens.canvas,
            contentColor = tokens.accent,
            divider = { HorizontalDivider(color = tokens.borderSubtle) },
            indicator = { positions ->
                TabRowDefaults.SecondaryIndicator(
                    modifier = Modifier.tabIndicatorOffset(positions[activeTab]),
                    height = 2.5.dp,
                    color = tokens.accent
                )
            }
        ) {
            Tab(
                selected = activeTab == 0,
                onClick = { activeTab = 0 },
                selectedContentColor = tokens.accent,
                unselectedContentColor = tokens.inkSecondary,
                text = { Text("${s.navSources} (${visibleSources.size})", fontWeight = FontWeight.SemiBold) }
            )
            Tab(
                selected = activeTab == 1,
                onClick = { activeTab = 1 },
                selectedContentColor = tokens.accent,
                unselectedContentColor = tokens.inkSecondary,
                text = {
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        Text("${s.navExtensions} (${visibleExtensions.size})", fontWeight = FontWeight.SemiBold)
                        if (updatesCount > 0) {
                            Box(
                                modifier = Modifier
                                    .clip(RoundedCornerShape(99.dp))
                                    .background(tokens.accent)
                                    .padding(horizontal = 6.dp, vertical = 1.dp)
                            ) {
                                Text(updatesCount.toString(), color = tokens.onAccent, fontSize = 10.sp, fontWeight = FontWeight.Bold)
                            }
                        }
                    }
                }
            )
        }

        // Language Filter Chips Row
        val activeLang = if (activeTab == 0) state.browseLangFilter else state.extLangFilter
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 14.dp, vertical = 8.dp),
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            listOf(
                SourceLang.ALL to s.all,
                SourceLang.ID to "Indonesia (ID)",
                SourceLang.EN to "English (EN)"
            ).forEach { (lang, label) ->
                val selected = activeLang == lang
                FilterChip(
                    selected = selected,
                    onClick = {
                        if (activeTab == 0) onBrowseLangChange(lang) else onExtLangChange(lang)
                    },
                    label = { Text(label, fontSize = 12.sp) },
                    colors = FilterChipDefaults.filterChipColors(
                        selectedContainerColor = tokens.accentTint,
                        selectedLabelColor = tokens.accent
                    )
                )
            }
        }

        if (state.isRefreshingRepo) {
            LinearProgressIndicator(
                color = tokens.accent,
                trackColor = tokens.borderSubtle,
                modifier = Modifier.fillMaxWidth().height(2.5.dp)
            )
        }

        if (activeTab == 0) {
            val globalQuery = state.browseSearchQuery.trim().lowercase()
            val installedSources = remember(state.extensions, state.settings.showNsfw, state.browseLangFilter) {
                state.extensions
                    .filter { it.installed }
                    .filter { state.settings.showNsfw || !it.isNsfw }
                    .filter { state.browseLangFilter == SourceLang.ALL || it.lang == state.browseLangFilter || it.lang == SourceLang.ALL }
                    .sortedBy { it.name.lowercase() }
            }
            val globalSearchBySource = remember(globalQuery, installedSources, state.mangaList, state.settings.showNsfw) {
                if (globalQuery.isEmpty()) emptyList()
                else installedSources.mapNotNull { src ->
                    val matches = state.mangaList.filter { m ->
                        (state.settings.showNsfw || !m.isExplicit) &&
                            m.sourceId == src.id &&
                            (m.title.lowercase().contains(globalQuery) ||
                                m.author.lowercase().contains(globalQuery) ||
                                m.genres.any { it.lowercase().contains(globalQuery) })
                    }
                    if (matches.isNotEmpty()) src to matches else null
                }
            }

            if (globalQuery.isNotEmpty() && globalSearchBySource.isNotEmpty()) {
                LazyColumn(
                    contentPadding = PaddingValues(bottom = 20.dp),
                    modifier = Modifier.fillMaxSize()
                ) {
                    item(key = "gs_hdr") {
                        Text(
                            text = if (s.isEn) "Global Search Results" else "Hasil Pencarian Global",
                            style = MaterialTheme.typography.labelLarge,
                            color = tokens.inkSecondary,
                            modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp)
                        )
                    }
                    items(globalSearchBySource, key = { "gs_${it.first.id}" }) { (src, matches) ->
                        Column(modifier = Modifier.fillMaxWidth().padding(bottom = 12.dp)) {
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .clickable { onOpenSourceCatalog(src.id) }
                                    .padding(horizontal = 16.dp, vertical = 8.dp),
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(10.dp)
                            ) {
                                SourceAvatarBadge(name = src.name, accentColorHex = src.accentColorHex, size = 24.dp)
                                Text(
                                    text = "${src.name} (${matches.size})",
                                    style = MaterialTheme.typography.titleSmall,
                                    color = tokens.inkPrimary,
                                    modifier = Modifier.weight(1f)
                                )
                                Icon(YomicIcons.ArrowForward, contentDescription = null, tint = tokens.inkMuted, modifier = Modifier.size(16.dp))
                            }
                            LazyRow(
                                contentPadding = PaddingValues(horizontal = 16.dp),
                                horizontalArrangement = Arrangement.spacedBy(10.dp)
                            ) {
                                items(matches, key = { "gsm_${it.id}" }) { manga ->
                                    MangaGridCard(
                                        manga = manga,
                                        showUnreadBadge = false,
                                        blurExplicit = state.settings.blurExplicitCovers,
                                        showInLibraryTag = true,
                                        inLibraryLabel = s.inLibrary,
                                        modifier = Modifier
                                            .width(104.dp)
                                            .clickable { onOpenMangaDetail(manga.id) }
                                    )
                                }
                            }
                        }
                    }
                }
            } else if (visibleSources.isEmpty()) {
                YomicEmptyState(
                    icon = YomicIcons.Browse,
                    title = if (globalQuery.isNotEmpty()) {
                        if (s.isEn) "No Matching Titles or Sources" else "Tidak Ada Hasil Ditemukan"
                    } else if (s.isEn) "No Installed Sources" else "Belum Ada Sumber Terpasang",
                    description = if (globalQuery.isNotEmpty()) {
                        if (s.isEn) "Try a different keyword to search across installed sources." else "Coba kata kunci lain untuk mencari judul di seluruh sumber terpasang."
                    } else if (s.isEn) "Install extensions from the Extensions tab to start exploring comics." else "Pasang ekstensi sumber di tab Ekstensi untuk mulai menjelajahi komik.",
                    primaryActionLabel = if (globalQuery.isNotEmpty()) s.reset else s.navExtensions,
                    onPrimaryAction = {
                        if (globalQuery.isNotEmpty()) onBrowseSearchChange("") else activeTab = 1
                    }
                )
            } else {
                val pinnedSources = visibleSources.filter { it.id in state.pinnedSourceIds }
                val unpinnedSources = visibleSources.filter { it.id !in state.pinnedSourceIds }

                LazyColumn(
                    contentPadding = PaddingValues(bottom = 16.dp),
                    modifier = Modifier.fillMaxSize()
                ) {
                    if (pinnedSources.isNotEmpty()) {
                        item(key = "src_hdr_pinned") {
                            Text(
                                text = if (s.isEn) "Pinned" else "Disematkan",
                                style = MaterialTheme.typography.labelLarge,
                                color = tokens.inkSecondary,
                                modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp)
                            )
                        }
                        items(pinnedSources, key = { "pin_${it.id}" }) { src ->
                            BrowseSourceRow(
                                src = src,
                                isPinned = true,
                                onOpenCatalog = { onOpenSourceCatalog(src.id) },
                                onTogglePin = { onTogglePinSource(src.id) },
                                onOpenBrowser = { onOpenInBrowserToast(src.name) }
                            )
                        }
                        if (unpinnedSources.isNotEmpty()) {
                            item(key = "src_hdr_all") {
                                HorizontalDivider(
                                    color = tokens.borderSubtle,
                                    thickness = 0.8.dp,
                                    modifier = Modifier.padding(vertical = 6.dp)
                                )
                                Text(
                                    text = if (s.isEn) "All Sources" else "Semua Sumber",
                                    style = MaterialTheme.typography.labelLarge,
                                    color = tokens.inkSecondary,
                                    modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp)
                                )
                            }
                        }
                    }
                    items(unpinnedSources, key = { it.id }) { src ->
                        BrowseSourceRow(
                            src = src,
                            isPinned = false,
                            onOpenCatalog = { onOpenSourceCatalog(src.id) },
                            onTogglePin = { onTogglePinSource(src.id) },
                            onOpenBrowser = { onOpenInBrowserToast(src.name) }
                        )
                    }
                }
            }
        } else {
            val installed = visibleExtensions.filter { it.installed }
            val available = visibleExtensions.filter { !it.installed }

            LazyColumn(
                contentPadding = PaddingValues(bottom = 16.dp),
                modifier = Modifier.fillMaxSize()
            ) {
                if (installed.isNotEmpty()) {
                    item(key = "ext_hdr_inst") {
                        Text(
                            text = s.installedSection,
                            style = MaterialTheme.typography.labelLarge,
                            color = tokens.inkSecondary,
                            modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp)
                        )
                    }
                    items(installed, key = { "inst_${it.id}" }) { ext ->
                        ExtensionRowCard(
                            ext = ext,
                            installProgress = state.installingExtensions[ext.id],
                            onInstallOrUpdate = { onInstallOrUpdateExt(ext.id) },
                            onUninstall = { onUninstallExt(ext.id) }
                        )
                    }
                }

                if (available.isNotEmpty()) {
                    item(key = "ext_hdr_avail") {
                        if (installed.isNotEmpty()) {
                            HorizontalDivider(
                                color = tokens.borderSubtle,
                                thickness = 0.8.dp,
                                modifier = Modifier.padding(vertical = 6.dp)
                            )
                        }
                        Text(
                            text = s.availableSection,
                            style = MaterialTheme.typography.labelLarge,
                            color = tokens.inkSecondary,
                            modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp)
                        )
                    }
                    items(available, key = { "avail_${it.id}" }) { ext ->
                        ExtensionRowCard(
                            ext = ext,
                            installProgress = state.installingExtensions[ext.id],
                            onInstallOrUpdate = { onInstallOrUpdateExt(ext.id) },
                            onUninstall = { onUninstallExt(ext.id) }
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun BrowseSourceRow(
    src: ExtensionItem,
    isPinned: Boolean,
    onOpenCatalog: () -> Unit,
    onTogglePin: () -> Unit,
    onOpenBrowser: () -> Unit
) {
    val tokens = YomicThemeTokens.colors
    val s = yomicStrings
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onOpenCatalog)
            .padding(horizontal = 16.dp, vertical = 11.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        SourceAvatarBadge(name = src.name, accentColorHex = src.accentColorHex, size = 40.dp)
        Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Text(
                text = src.name,
                style = MaterialTheme.typography.bodyLarge,
                fontWeight = FontWeight.Medium,
                color = tokens.inkPrimary,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis
            )
            Text(
                text = src.cleanDomain,
                style = MaterialTheme.typography.bodySmall,
                color = tokens.inkMuted
            )
        }
        ServerStatusIndicator(status = src.status)
        IconButton(
            onClick = onTogglePin,
            modifier = Modifier.size(34.dp)
        ) {
            Icon(
                imageVector = if (isPinned) YomicIcons.BookmarkFilled else YomicIcons.Bookmark,
                contentDescription = if (isPinned) "Unpin" else "Pin",
                tint = if (isPinned) tokens.inkPrimary else tokens.inkMuted,
                modifier = Modifier.size(17.dp)
            )
        }
        IconButton(
            onClick = onOpenBrowser,
            modifier = Modifier.size(34.dp)
        ) {
            Icon(YomicIcons.Globe, contentDescription = s.browser, tint = tokens.inkSecondary, modifier = Modifier.size(18.dp))
        }
    }
}

@Composable
private fun ExtensionRowCard(
    ext: ExtensionItem,
    installProgress: Int?,
    onInstallOrUpdate: () -> Unit,
    onUninstall: () -> Unit
) {
    val tokens = YomicThemeTokens.colors
    val s = yomicStrings

    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 11.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(14.dp)
    ) {
        SourceAvatarBadge(name = ext.name, accentColorHex = ext.accentColorHex, size = 40.dp)
        Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                Text(
                    text = ext.name,
                    style = MaterialTheme.typography.bodyLarge,
                    fontWeight = FontWeight.Medium,
                    color = tokens.inkPrimary
                )
                if (ext.isNsfw) {
                    Box(
                        modifier = Modifier
                            .clip(RoundedCornerShape(4.dp))
                            .background(tokens.roseBg)
                            .padding(horizontal = 5.dp, vertical = 1.dp)
                    ) {
                        Text("18+", color = tokens.rose, fontSize = 9.5.sp, fontWeight = FontWeight.Bold)
                    }
                }
            }
            Text(ext.version, style = MaterialTheme.typography.bodySmall, color = tokens.inkMuted)
        }

        if (installProgress != null) {
            Column(horizontalAlignment = Alignment.End, modifier = Modifier.width(84.dp)) {
                Text(
                    text = "$installProgress%",
                    color = tokens.accent,
                    style = MaterialTheme.typography.labelSmall,
                    fontWeight = FontWeight.Bold
                )
                Spacer(Modifier.height(4.dp))
                LinearProgressIndicator(
                    progress = { installProgress / 100f },
                    color = tokens.accent,
                    trackColor = tokens.borderSubtle,
                    gapSize = 0.dp,
                    drawStopIndicator = {},
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(4.dp)
                        .clip(RoundedCornerShape(99.dp))
                )
            }
        } else if (ext.installed) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                if (ext.hasUpdate) {
                    Box(
                        modifier = Modifier
                            .clip(RoundedCornerShape(8.dp))
                            .background(tokens.accentTint)
                            .clickable(onClick = onInstallOrUpdate)
                            .padding(horizontal = 10.dp, vertical = 6.dp)
                    ) {
                        Text(s.update, color = tokens.accent, fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
                    }
                }
                IconButton(onClick = onUninstall, modifier = Modifier.size(36.dp)) {
                    Icon(YomicIcons.Trash, contentDescription = s.uninstall, tint = tokens.inkMuted, modifier = Modifier.size(18.dp))
                }
            }
        } else {
            Row(
                modifier = Modifier
                    .clip(RoundedCornerShape(8.dp))
                    .background(tokens.accentTint)
                    .clickable(onClick = onInstallOrUpdate)
                    .padding(horizontal = 11.dp, vertical = 6.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(5.dp)
            ) {
                Icon(YomicIcons.Download, contentDescription = null, tint = tokens.accent, modifier = Modifier.size(15.dp))
                Text(s.install, color = tokens.accent, fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
            }
        }
    }
}

@Preview(name = "Browse Sources Dark", showBackground = true, widthDp = 390, heightDp = 820)
@Composable
fun BrowseSourcesPreview() {
    val state = YomicUiState(extensions = DemoDataRepository.createExtensions())
    YomicTheme(darkTheme = true) {
        Scaffold(
            containerColor = YomicThemeTokens.colors.canvas,
            bottomBar = {
                YomicBottomNavigationBar(
                    currentRoute = YomicRoutes.BROWSE,
                    newUpdatesCount = 4,
                    onSelectTab = {}
                )
            }
        ) { innerPadding ->
            Box(modifier = Modifier.fillMaxSize().padding(bottom = innerPadding.calculateBottomPadding())) {
                BrowseScreen(
                    state = state,
                    onBrowseSearchChange = {}, onBrowseLangChange = {},
                    onExtSearchChange = {}, onExtLangChange = {},
                    onRefreshRepo = {}, onInstallOrUpdateExt = {},
                    onUninstallExt = {}, onOpenSourceCatalog = {},
                    onOpenInBrowserToast = {},
                    initialTab = 0
                )
            }
        }
    }
}

@Preview(name = "Browse Extensions Dark", showBackground = true, widthDp = 390, heightDp = 820)
@Composable
fun BrowseExtensionsPreview() {
    val state = YomicUiState(
        extensions = DemoDataRepository.createExtensions(),
        installingExtensions = mapOf("bacakomik" to 62)
    )
    YomicTheme(darkTheme = true) {
        Scaffold(
            containerColor = YomicThemeTokens.colors.canvas,
            bottomBar = {
                YomicBottomNavigationBar(
                    currentRoute = YomicRoutes.BROWSE,
                    newUpdatesCount = 4,
                    onSelectTab = {}
                )
            }
        ) { innerPadding ->
            Box(modifier = Modifier.fillMaxSize().padding(bottom = innerPadding.calculateBottomPadding())) {
                BrowseScreen(
                    state = state,
                    onBrowseSearchChange = {}, onBrowseLangChange = {},
                    onExtSearchChange = {}, onExtLangChange = {},
                    onRefreshRepo = {}, onInstallOrUpdateExt = {},
                    onUninstallExt = {}, onOpenSourceCatalog = {},
                    onOpenInBrowserToast = {},
                    initialTab = 1
                )
            }
        }
    }
}
