import type { YomicApp } from '../app.js';
import { getIconSvg, SOLAR_PATHS, icons } from '../icons.js';
import {
  buildComicPageSvg,
  buildMangaCoverSvg,
  DEFAULT_APP_SETTINGS,
  escapeXml
} from '../mock-data.js';
import {
  ActivityUpdateItem,
  AppSettingsState,
  CategoryItem,
  ChapterItem,
  DownloadQueueItem,
  ExtensionItem,
  LibraryCategory,
  LibraryFilterMode,
  LibrarySortBy,
  MangaItem,
  NavTabId,
  ReaderMode,
  ReaderPagesResult,
  SettingsSubTab,
  SourceFeedResult
} from '../types.js';

/* =========================================================================
 * 1. LIBRARY VIEW (MINIMALIST YOMIC V1 MIRROR — LibraryView.axaml)
 * ========================================================================= */

export function renderLibraryView(this: YomicApp, container: HTMLElement): void {
  if (this.isLibraryStatsOpen) {
    this.setTopbarHeader(this.l('Statistik Membaca', 'Reading Insights'));
    this.renderReadingStatisticsView(container);
    if (!this.readingStatsData) {
      void this.fetchReadingStatistics(container, false);
    }
    return;
  }

  const libraryManga = this.mangaList.filter((m) => m.inLibrary);
  const getFilteredAndSortedManga = () => {
    return libraryManga
      .filter((m) => {
        if (this.searchQuery) {
          const q = this.searchQuery.toLowerCase();
          const match =
            m.title.toLowerCase().includes(q) ||
            m.author.toLowerCase().includes(q) ||
            m.sourceName.toLowerCase().includes(q) ||
            m.genres.some((g) => g.toLowerCase().includes(q));
          if (!match) return false;
        }

        // Category Filter
        if (this.libraryCategoryFilter !== 'all') {
          const catId = Number(this.libraryCategoryFilter);
          if (!m.categoryIds || !m.categoryIds.includes(catId)) return false;
        }

        // Library Filter Mode
        if (this.libraryFilterMode === 'unread') {
          const isUnread = (m.unreadCount === m.totalChapters || !m.lastViewedEpoch || m.lastViewedEpoch === 0) && m.unreadCount > 0;
          if (!isUnread) return false;
        }
        if (this.libraryFilterMode === 'reading') {
          const isReading = (m.unreadCount < m.totalChapters || (m.lastViewedEpoch ?? 0) > 0) && m.unreadCount > 0;
          if (!isReading) return false;
        }
        if (this.libraryFilterMode === 'completed') {
          const isCompleted = (m.unreadCount === 0 && m.totalChapters > 0) || (m.status === 'Completed' && m.unreadCount === 0);
          if (!isCompleted) return false;
        }
        if (this.libraryFilterMode === 'downloaded' && m.downloadedCount <= 0) return false;

        // Flyout Source Filter
        if (
          this.librarySourceFilter !== 'all' &&
          String(m.sourceId) !== String(this.librarySourceFilter) &&
          m.sourceName !== this.librarySourceFilter
        ) {
          const extMatch = this.extensions.find((e) => e.id === this.librarySourceFilter);
          if (!extMatch || (String(extMatch.sourceId) !== String(m.sourceId) && extMatch.name !== m.sourceName)) {
            return false;
          }
        }
        return true;
      })
      .sort((a, b) => {
        if (this.librarySort === 'lastRead') {
          return (b.lastViewedEpoch ?? 0) - (a.lastViewedEpoch ?? 0);
        }
        if (this.librarySort === 'unread') return b.unreadCount - a.unreadCount;
        if (this.librarySort === 'updated') {
          return (b.lastUpdateEpoch ?? 0) - (a.lastUpdateEpoch ?? 0);
        }
        if (this.librarySort === 'titleAsc') return a.title.localeCompare(b.title);
        if (this.librarySort === 'titleDesc') return b.title.localeCompare(a.title);
        return 0;
      });
  };

  const filtered = getFilteredAndSortedManga();
  this.setTopbarHeader(this.t('library.title'));
  const checkSvg = getIconSvg('check', { size: 13, strokeWidth: 2.5 });
  const filterModes: Array<{ id: LibraryFilterMode; label: string }> = [
    { id: 'all', label: 'Semua' },
    { id: 'unread', label: 'Belum Dibaca' },
    { id: 'reading', label: this.l('Sedang Dibaca', 'Reading') },
    { id: 'completed', label: this.t('library.filterCompleted') },
    { id: 'downloaded', label: this.l('Tersimpan Offline', 'Downloaded') }
  ];
  const sortModes: Array<{ id: LibrarySortBy; label: string }> = [
    { id: 'lastRead', label: this.l('Terakhir Dibaca', 'Last Read') },
    { id: 'unread', label: this.t('library.sortUnread') },
    { id: 'updated', label: this.l('Tanggal Diperbarui', 'Date Updated') },
    { id: 'titleAsc', label: this.l('Judul (A → Z)', 'Title (A → Z)') },
    { id: 'titleDesc', label: this.l('Judul (Z → A)', 'Title (Z → A)') }
  ];
  const installedSources = this.extensions.filter((e) => e.installed);
  const hasActiveFilter =
    this.libraryCategoryFilter !== 'all' ||
    this.libraryFilterMode !== 'all' ||
    this.librarySourceFilter !== 'all' ||
    this.librarySort !== 'lastRead';

  // Toggle View Mode icon (List icon when in Grid view, Grid icon when in List view — LibraryView.axaml L449-458)
  const toggleViewIconPath = this.libraryViewMode === 'grid' ? SOLAR_PATHS['list'] : SOLAR_PATHS['layout-grid'];
  let contentHtml = '';
  if (this.syncProgress.active && libraryManga.length === 0) {
    const syncPercent = Math.round((this.syncProgress.current / Math.max(1, this.syncProgress.total)) * 100);
    contentHtml = `
      <div class="empty-state-box">
        <div class="empty-state-icon-wrap">
          <svg class="empty-state-spinner-svg" width="44" height="44" viewBox="0 0 44 44" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="22" cy="22" r="18" stroke="var(--border-subtle)" stroke-width="3.5" />
            <circle cx="22" cy="22" r="18" stroke="var(--ocean-primary)" stroke-width="3.5" stroke-linecap="round" stroke-dasharray="28 85" />
          </svg>
        </div>
        <div class="empty-state-title">
          ${this.l('Memeriksa Pembaruan...', 'Checking for Updates...')} <span class="empty-state-counter tabular-nums" style="color:var(--ocean-primary); font-weight:700;">(${this.syncProgress.current}/${this.syncProgress.total})</span>
        </div>
        <div class="empty-state-desc">${this.l('Sedang memeriksa bab baru dari komik di pustaka Anda...', 'Checking for new chapters from comics in your library...')}</div>
        <div class="empty-state-progress-track" style="width: 220px; height: 4px; background: var(--bg-surface-alt); border-radius: 2px; overflow: hidden; margin-top: 6px;">
          <div class="empty-state-progress-fill" style="width: ${syncPercent}%; height: 100%; background: var(--ocean-primary); border-radius: 2px; transition: width 0.25s ease;"></div>
        </div>
      </div>
    `;
  } else if (libraryManga.length === 0) {
    contentHtml = `
      <div class="empty-state-box">
        <div class="empty-state-icon-wrap">
          ${getIconSvg('book-open-line', { size: 48 })}
        </div>
        <div class="empty-state-title">${this.t('library.emptyTitle')}</div>
        <div class="empty-state-desc">${this.t('library.emptyDesc')}</div>
        <div style="display:flex; gap:10px; align-items:center; flex-wrap:wrap; justify-content:center;">
          <button id="btnGoBrowseFromEmpty" class="empty-state-btn primary">${this.t('library.browseAction')}</button>
          <button id="btnOpenTutorialFromLibrary" class="empty-state-btn">
            ${getIconSvg('compass-3-line', { size: 14 })}
            <span>${this.l('Lihat Panduan', 'View Guide')}</span>
          </button>
        </div>
      </div>
    `;
  } else if (filtered.length === 0) {
    contentHtml = `
      <div class="empty-state-box">
        <div class="empty-state-icon-wrap">
          ${getIconSvg('search-line', { size: 48 })}
        </div>
        <div class="empty-state-title">${this.t('library.emptyFilteredTitle')}</div>
        <div class="empty-state-desc">${this.t('library.emptyFilteredDesc')}</div>
        <button id="btnResetLibFilter" class="empty-state-btn">${this.l('Atur Ulang Filter', 'Reset Filters')}</button>
      </div>
    `;
  } else if (this.libraryViewMode === 'grid') {
    contentHtml = `<div class="manga-grid">${filtered.map((m) => this.buildMangaGridCardHtml(m)).join('')}</div>`;
  } else {
    contentHtml = `<div class="v1-lib-list">${filtered.map((m) => this.buildMangaListRowHtml(m)).join('')}</div>`;
  }
  const syncPercent = Math.round((this.syncProgress.current / Math.max(1, this.syncProgress.total)) * 100);
  const ctxManga = this.contextMenuMangaId
    ? this.mangaList.find((m) => m.id === this.contextMenuMangaId) ?? null
    : null;
  container.innerHTML = `
    <div class="v1-lib-top">
      <!-- Single Master Bar: Title + Count + Category Tabs on Left, Actions on Right -->
      <div class="v1-lib-master-bar">
        <div class="v1-lib-left-group">
          <div class="v1-lib-title-row">
            ${getIconSvg('book-open-line', { size: 24 })}
            <span class="v1-lib-title-text">${this.t('library.title')}</span>
            <span class="v1-lib-count-inline tabular-nums">(${libraryManga.length})</span>
          </div>
        </div>
        <div class="v1-lib-actions">
          <!-- 1. Morphing Animated Expandable Search -->
          <div id="libraryExpandSearch" class="v1-expand-search ${this.isLibrarySearchOpen || this.searchQuery ? 'open' : ''}">
            <button id="btnToggleLibSearch" class="v1-expand-search-icon-btn" title="${escapeXml(this.t('library.searchPlaceholder'))}" aria-label="${escapeXml(this.t('library.searchPlaceholder'))}">
              ${getIconSvg('search-line', { size: 18 })}
            </button>
            <input id="librarySearchInput" class="v1-expand-search-input" type="text" placeholder="${escapeXml(this.t('library.searchPlaceholder'))}" value="${escapeXml(this.searchQuery)}" autocomplete="off" />
            <button id="btnClearLibSearch" class="v1-expand-search-clear-btn" title="${escapeXml(this.t('modal.close'))}" aria-label="${escapeXml(this.t('modal.close'))}">
              ${getIconSvg('close-line', { size: 13 })}
            </button>
          </div>
          <!-- 2. Reading Statistics / Insights Button (Top of Library) -->
          <button id="btnOpenReadingStats" class="v1-lib-action-btn ${this.isLibraryStatsOpen ? 'active' : ''}" title="${escapeXml(this.l('Statistik Membaca', 'Reading Statistics'))}" aria-label="${escapeXml(this.l('Statistik Membaca', 'Reading Statistics'))}">
            ${getIconSvg('chart-2-linear', { size: 18 })}
          </button>
          <!-- 3. Filter & Sort Modal Trigger Button -->
          <button id="btnToggleLibFlyout" class="v1-lib-action-btn ${this.isLibraryFlyoutOpen ? 'active' : ''} ${hasActiveFilter ? 'has-filter' : ''}" title="Filter &amp; Sort" aria-label="Filter &amp; Sort">
            ${getIconSvg('filter', { size: 18 })}
          </button>
          <!-- 3. Sync Library Button -->
          <button id="btnRefreshLibrary" class="v1-lib-action-btn ${this.syncProgress.active ? 'loading' : ''}" title="${escapeXml(this.syncProgress.active ? this.t('library.syncingBtn') : this.t('library.syncBtn'))}" aria-label="${escapeXml(this.t('library.syncBtn'))}" ${this.syncProgress.active ? 'disabled' : ''}>
            ${this.syncProgress.active ? '<div class="v1-lib-action-btn-spinner"></div>' : getIconSvg('refresh-line', { size: 18 })}
          </button>
          <!-- 4. Single Toggle View Mode Button (Grid <-> List) -->
          <button id="btnToggleLibViewMode" class="v1-lib-action-btn" title="${escapeXml(this.libraryViewMode === 'grid' ? this.t('library.viewList') : this.t('library.viewGrid'))}" aria-label="${escapeXml(this.t('library.viewGrid'))}">
            ${getIconSvg(this.libraryViewMode === 'grid' ? 'list' : 'layout-grid', { size: 18 })}
          </button>
        </div>
      </div>
    </div>
    <div id="libContentArea" style="width:100%; min-width:0;">
      ${contentHtml}
    </div>
    <!-- Filter & Sort Modal Dialog (Yomic v2 Centered Popup Ala Status Pelacakan Dialog) -->
    <div id="libFilterModalBackdrop" class="v1-mal-backdrop ${this.isLibraryFlyoutOpen ? 'open' : ''}">
      <div class="v1-mal-dialog v1-filter-modal-dialog" role="dialog" aria-modal="true" aria-labelledby="libFilterModalTitle">
        <!-- Header -->
        <div class="v1-mal-header">
          <div class="v1-mal-title-wrap">
            <span id="libFilterModalTitle" class="v1-mal-title">${this.l('Filter &amp; Urutkan', 'Filter &amp; Sort')}</span>
          </div>
          <button id="btnCloseLibFilterModal" class="v1-mal-close-btn" aria-label="${escapeXml(this.t('modal.close'))}">
            ${getIconSvg('close', { size: 18 })}
          </button>
        </div>
        <!-- Segmented Tabs (Kategori | Saring | Sumber | Urutkan) -->
        <div class="v1-filter-modal-tabs">
          <button class="v1-filter-modal-tab-btn ${this.libraryFlyoutTab === 'category' ? 'active' : ''}" data-flyout-tab="category">
            <span>${this.l('Kategori', 'Categories')}</span>
          </button>
          <button class="v1-filter-modal-tab-btn ${this.libraryFlyoutTab === 'filter' ? 'active' : ''}" data-flyout-tab="filter">
            <span>${this.l('Saring', 'Filter')}</span>
          </button>
          <button class="v1-filter-modal-tab-btn ${this.libraryFlyoutTab === 'source' ? 'active' : ''}" data-flyout-tab="source">
            <span>${this.l('Sumber', 'Sources')}</span>
          </button>
          <button class="v1-filter-modal-tab-btn ${this.libraryFlyoutTab === 'sort' ? 'active' : ''}" data-flyout-tab="sort">
            <span>${this.l('Urutkan', 'Sort')}</span>
          </button>
        </div>
        <!-- Tab Content -->
        <div class="v1-filter-modal-content">
          ${
            this.libraryFlyoutTab === 'category'
              ? `
                <div class="v1-cat-tab-content">
                  <div class="v1-cat-list">
                    <button class="v1-filter-modal-item ${this.libraryCategoryFilter === 'all' ? 'selected' : ''}" data-lib-cat="all">
                      <span class="v1-filter-modal-check">${this.libraryCategoryFilter === 'all' ? checkSvg : ''}</span>
                      <span class="v1-filter-item-name">${this.l('Semua Kategori', 'All Categories')}</span>
                      <span class="v1-cat-count-badge tabular-nums">${libraryManga.length}</span>
                    </button>
                    ${this.categories
                      .map((cat) => {
                        const count = libraryManga.filter((m) => m.categoryIds && m.categoryIds.includes(cat.id)).length;
                        const isSelected = this.libraryCategoryFilter === cat.id;
                        return `
                          <div class="v1-filter-modal-item v1-cat-filter-item ${isSelected ? 'selected' : ''}" data-lib-cat="${cat.id}">
                            <span class="v1-filter-modal-check">${isSelected ? checkSvg : ''}</span>
                            <span class="v1-filter-item-name">${escapeXml(cat.name)}</span>
                            <span class="v1-cat-count-badge tabular-nums">${count}</span>
                            <button class="v1-cat-item-delete-btn" data-delete-cat="${cat.id}" data-cat-name="${escapeXml(cat.name)}" title="${escapeXml(this.l('Hapus Kategori', 'Delete Category'))}" aria-label="${escapeXml(this.l('Hapus Kategori', 'Delete Category'))} ${escapeXml(cat.name)}">
                              ${getIconSvg('trash-bin-trash-linear', { size: 14 })}
                            </button>
                          </div>
                        `;
                      })
                      .join('')}
                  </div>
                  <div class="v1-cat-add-bar">
                    <input id="newCategoryInput" class="v1-cat-add-input" type="text" placeholder="${escapeXml(this.t('library.categoryInputPlaceholder'))}" maxlength="30" autocomplete="off" />
                    <button id="btnAddNewCategory" class="v1-cat-add-btn" type="button" title="${escapeXml(this.t('library.categoryAddBtn'))}">
                      ${getIconSvg('plus', { size: 16 })}
                      <span>${this.t('library.categoryAddBtn')}</span>
                    </button>
                  </div>
                </div>
              `
              : ''
          }
          ${
            this.libraryFlyoutTab === 'filter'
              ? filterModes
                  .map(
                    (fm) => `
                  <button class="v1-filter-modal-item ${this.libraryFilterMode === fm.id ? 'selected' : ''}" data-lib-filter="${fm.id}">
                    <span class="v1-filter-modal-check">${this.libraryFilterMode === fm.id ? checkSvg : ''}</span>
                    <span>${fm.label}</span>
                  </button>`
                  )
                  .join('')
              : ''
          }
          ${
            this.libraryFlyoutTab === 'source'
              ? `
                <button class="v1-filter-modal-item ${this.librarySourceFilter === 'all' ? 'selected' : ''}" data-lib-src="all">
                  <span class="v1-filter-modal-check">${this.librarySourceFilter === 'all' ? checkSvg : ''}</span>
                  <span>${this.t('browse.allSources')}</span>
                </button>
                ${installedSources
                  .map(
                    (src) => `
                  <button class="v1-filter-modal-item ${this.librarySourceFilter === src.id ? 'selected' : ''}" data-lib-src="${src.id}">
                    <span class="v1-filter-modal-check">${this.librarySourceFilter === src.id ? checkSvg : ''}</span>
                    <span class="v1-source-favicon" style="background:${src.accentColor};">${src.name.slice(0, 2).toUpperCase()}</span>
                    <span>${src.name}</span>
                  </button>`
                  )
                  .join('')}
              `
              : ''
          }
          ${
            this.libraryFlyoutTab === 'sort'
              ? sortModes
                  .map(
                    (sm) => `
                  <button class="v1-filter-modal-item ${this.librarySort === sm.id ? 'selected' : ''}" data-lib-sort="${sm.id}">
                    <span class="v1-filter-modal-check">${this.librarySort === sm.id ? checkSvg : ''}</span>
                    <span>${sm.label}</span>
                  </button>`
                  )
                  .join('')
              : ''
          }
        </div>
        <!-- Footer: Atur Ulang & Terapkan -->
        <div class="v1-mal-footer">
          ${
            hasActiveFilter
              ? `
                <button id="btnResetLibFilterModal" class="v1-mal-btn-danger" type="button" title="${escapeXml(this.l('Kembalikan semua filter ke pengaturan awal', 'Reset all filters to default'))}">
                  ${this.l('Atur Ulang', 'Reset')}
                </button>
              `
              : '<div style="flex:1;"></div>'
          }
          <div class="v1-mal-footer-actions">
            <button id="btnApplyLibFilterModal" class="v1-mal-btn-primary" type="button">
              ${this.l('Selesai', 'Done')}
            </button>
          </div>
        </div>
      </div>
    </div>
    <!-- Right-Click Context Menu (LibraryView.axaml L617-643) -->
    <div id="libCardContextMenu" class="v1-context-menu ${ctxManga ? 'open' : ''}" style="left:${this.contextMenuPos.x}px;top:${this.contextMenuPos.y}px;">
      <button id="ctxMarkRead" class="v1-ctx-item">${this.t('detail.markRead')}</button>
      <button id="ctxMarkUnread" class="v1-ctx-item">${this.t('detail.markUnread')}</button>
      <button id="ctxManageCategories" class="v1-ctx-item">${this.l('Atur Kategori...', 'Manage Categories...')}</button>
      <div class="v1-lib-flyout-divider"></div>
      ${
        ctxManga && ctxManga.downloadedCount > 0
          ? `<button id="ctxDeleteDownloads" class="v1-ctx-item danger">${this.l('Hapus Semua Unduhan', 'Delete All Downloads')}</button>`
          : ''
      }
      <button id="ctxRemoveLibrary" class="v1-ctx-item danger">${this.t('detail.removeFromLibrary')}</button>
    </div>
    <!-- Category Assignment Modal Dialog for Manga -->
    ${(() => {
      if (!this.categoryManageMangaId) return '';
      const targetManga = this.mangaList.find((m) => m.id === this.categoryManageMangaId);
      if (!targetManga) return '';
      const assignedIds = new Set(targetManga.categoryIds || []);
      return `
        <div id="libCategoryModalBackdrop" class="v1-mal-backdrop open">
          <div class="v1-mal-dialog v1-cat-manage-dialog" role="dialog" aria-modal="true" aria-labelledby="libCatManageTitle">
            <div class="v1-mal-header">
              <div class="v1-mal-title-wrap">
                <span id="libCatManageTitle" class="v1-mal-title">${this.l('Atur Kategori Komik', 'Set Comic Categories')}</span>
                <span class="v1-cat-dialog-subtitle">${escapeXml(targetManga.title)}</span>
              </div>
              <button id="btnCloseCatManageModal" class="v1-mal-close-btn" aria-label="${escapeXml(this.t('modal.close'))}">
                ${getIconSvg('close', { size: 18 })}
              </button>
            </div>
            <div class="v1-cat-manage-body">
              ${
                this.categories.length === 0
                  ? `<div class="v1-cat-empty-notice">${this.l(
                      'Belum ada kategori yang dibuat.<br/>Buka tab <strong>Kategori</strong> di tombol <strong>Filter &amp; Urutkan</strong> untuk membuat kategori baru.',
                      'No categories created yet.<br/>Open the <strong>Categories</strong> tab in <strong>Filter &amp; Sort</strong> to create a new category.'
                    )}</div>`
                  : `
                    <div class="v1-cat-checklist">
                      ${this.categories
                        .map(
                          (cat) => `
                        <label class="v1-cat-check-item">
                          <input type="checkbox" class="v1-cat-checkbox" data-cat-id="${cat.id}" ${assignedIds.has(cat.id) ? 'checked' : ''} />
                          <span class="v1-cat-check-label">${escapeXml(cat.name)}</span>
                        </label>
                      `
                        )
                        .join('')}
                    </div>
                  `
              }
            </div>
            <div class="v1-mal-footer">
              <button id="btnCancelCatManageModal" class="v1-mal-btn-secondary" type="button">${this.t('modal.cancel')}</button>
              <div class="v1-mal-footer-actions">
                <button id="btnSaveCatManageModal" class="v1-mal-btn-primary" type="button">${this.t('modal.save')}</button>
              </div>
            </div>
          </div>
        </div>
      `;
    })()}
    <!-- Bottom Real-Time Sync Progress Floating Pill (LibraryView.axaml L1007-1036) -->
    <div class="v1-sync-pill ${this.syncProgress.active && libraryManga.length > 0 ? 'open' : ''}">
      <div class="v1-sync-pill-top">
        <span>${this.l('Memperbarui pustaka...', 'Updating library...')}</span>
        <span class="tabular-nums" style="color:var(--ocean-primary);">${this.syncProgress.current}/${this.syncProgress.total}</span>
      </div>
      <div class="v1-sync-track">
        <div class="v1-sync-fill" style="width:${syncPercent}%;"></div>
      </div>
    </div>
  `;

  const bindCardContextMenus = (rootEl: HTMLElement) => {
    rootEl.querySelectorAll<HTMLElement>('[data-open-detail]').forEach((cardEl) => {
      cardEl.addEventListener('contextmenu', (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        const mangaId = cardEl.dataset.openDetail;
        if (!mangaId) return;
        this.isLibraryFlyoutOpen = false;
        this.contextMenuMangaId = mangaId;
        this.contextMenuPos = {
          x: Math.min(window.innerWidth - 210, ev.clientX),
          y: Math.min(window.innerHeight - 180, ev.clientY)
        };
        this.renderLibraryView(container);
      });
    });
  };

  const resetFilterHandler = (ev: Event) => {
    ev.stopPropagation();
    this.libraryCategory = 'all';
    this.libraryCategoryFilter = 'all';
    this.libraryFilterMode = 'all';
    this.librarySourceFilter = 'all';
    this.librarySort = 'lastRead';
    this.searchQuery = '';
    this.isLibrarySearchOpen = false;
    const input = document.getElementById('librarySearchInput') as HTMLInputElement | null;
    if (input) input.value = '';
    const box = document.getElementById('libraryExpandSearch');
    box?.classList.remove('animating', 'open');
    this.renderLibraryView(container);
  };
  document.getElementById('btnToggleLibSearch')?.addEventListener('click', (ev) => {
    ev.stopPropagation();
    const box = document.getElementById('libraryExpandSearch');
    const input = document.getElementById('librarySearchInput') as HTMLInputElement | null;
    this.isLibrarySearchOpen = !this.isLibrarySearchOpen;
    if (this.isLibrarySearchOpen) {
      if (box) {
        box.classList.remove('animating');
        void box.offsetWidth;
        box.classList.add('open', 'animating');
        window.setTimeout(() => box.classList.remove('animating'), 400);
      }
      window.setTimeout(() => input?.focus({ preventScroll: true }), 120);
    } else {
      box?.classList.remove('animating', 'open');
      input?.blur();
      if (this.searchQuery) {
        this.searchQuery = '';
        if (input) input.value = '';
        window.setTimeout(() => {
          this.renderLibraryView(container);
        }, 220);
      }
    }
  });
  const libSearchInput = document.getElementById('librarySearchInput') as HTMLInputElement | null;
  let libSearchTimeout: number | undefined;
  libSearchInput?.addEventListener('input', () => {
    window.clearTimeout(libSearchTimeout);
    this.searchQuery = libSearchInput.value;
    libSearchTimeout = window.setTimeout(() => {
      const contentArea = document.getElementById('libContentArea');
      if (contentArea) {
        const currentFiltered = getFilteredAndSortedManga();
        let newContentHtml = '';
        if (currentFiltered.length === 0) {
          newContentHtml = `
            <div class="empty-state-box">
              <div class="empty-state-icon-wrap">
                ${getIconSvg('search-line', { size: 48 })}
              </div>
              <div class="empty-state-title">${this.l('Tidak Ada Hasil Ditemukan', 'No Results Found')}</div>
              <div class="empty-state-desc">${this.l('Tidak ditemukan komik yang cocok dengan filter atau kata kunci pencarian saat ini.', 'No comics match the current filters or search keywords.')}</div>
              <button id="btnResetLibFilter" class="empty-state-btn">${this.l('Atur Ulang Filter', 'Reset Filters')}</button>
            </div>
          `;
        } else if (this.libraryViewMode === 'grid') {
          newContentHtml = `<div class="manga-grid">${currentFiltered.map((m) => this.buildMangaGridCardHtml(m)).join('')}</div>`;
        } else {
          newContentHtml = `<div class="v1-lib-list">${currentFiltered.map((m) => this.buildMangaListRowHtml(m)).join('')}</div>`;
        }
        contentArea.innerHTML = newContentHtml;
        this.bindCommonCardTriggers(contentArea);
        bindCardContextMenus(contentArea);
        document.getElementById('btnResetLibFilter')?.addEventListener('click', resetFilterHandler);
      } else {
        this.renderLibraryView(container);
      }
    }, 120);
  });
  libSearchInput?.addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape') {
      ev.preventDefault();
      const box = document.getElementById('libraryExpandSearch');
      const hadQuery = Boolean(this.searchQuery);
      this.isLibrarySearchOpen = false;
      this.searchQuery = '';
      if (libSearchInput) libSearchInput.value = '';
      box?.classList.remove('animating', 'open');
      libSearchInput?.blur();
      if (hadQuery) {
        window.setTimeout(() => {
          this.renderLibraryView(container);
        }, 220);
      }
    }
  });
  document.getElementById('btnClearLibSearch')?.addEventListener('click', (ev) => {
    ev.stopPropagation();
    const box = document.getElementById('libraryExpandSearch');
    const input = document.getElementById('librarySearchInput') as HTMLInputElement | null;
    const hadQuery = Boolean(this.searchQuery);
    this.searchQuery = '';
    this.isLibrarySearchOpen = false;
    if (input) input.value = '';
    box?.classList.remove('animating', 'open');
    input?.blur();
    if (hadQuery) {
      window.setTimeout(() => {
        this.renderLibraryView(container);
      }, 220);
    }
  });
  document.getElementById('btnOpenReadingStats')?.addEventListener('click', (ev) => {
    ev.stopPropagation();
    this.isLibraryStatsOpen = true;
    this.isLibraryFlyoutOpen = false;
    this.contextMenuMangaId = null;
    this.renderReadingStatisticsView(container);
    void this.fetchReadingStatistics(container, true);
  });
  document.getElementById('btnToggleLibFlyout')?.addEventListener('click', (ev) => {
    ev.stopPropagation();
    this.isLibraryFlyoutOpen = true;
    this.contextMenuMangaId = null;
    this.renderLibraryView(container);
  });
  document.getElementById('btnCloseLibFilterModal')?.addEventListener('click', (ev) => {
    ev.stopPropagation();
    this.isLibraryFlyoutOpen = false;
    this.renderLibraryView(container);
  });
  document.getElementById('btnApplyLibFilterModal')?.addEventListener('click', (ev) => {
    ev.stopPropagation();
    this.isLibraryFlyoutOpen = false;
    this.renderLibraryView(container);
  });
  document.getElementById('libFilterModalBackdrop')?.addEventListener('click', (ev) => {
    if (ev.target === document.getElementById('libFilterModalBackdrop')) {
      this.isLibraryFlyoutOpen = false;
      this.renderLibraryView(container);
    }
  });
  container.querySelector('.v1-filter-modal-dialog')?.addEventListener('click', (ev) => {
    ev.stopPropagation();
  });
  container.querySelectorAll<HTMLButtonElement>('[data-flyout-tab]').forEach((btn) => {
    btn.addEventListener('click', (ev) => {
      ev.stopPropagation();
      this.libraryFlyoutTab = (btn.dataset.flyoutTab as 'category' | 'filter' | 'source' | 'sort') || 'category';
      this.renderLibraryView(container);
    });
  });
  container.querySelectorAll<HTMLElement>('[data-lib-cat]').forEach((el) => {
    el.addEventListener('click', (ev) => {
      if ((ev.target as HTMLElement).closest('.v1-cat-item-delete-btn')) return;
      ev.stopPropagation();
      const val = el.dataset.libCat;
      if (val === 'all') {
        this.libraryCategoryFilter = 'all';
      } else {
        this.libraryCategoryFilter = Number(val);
      }
      this.renderLibraryView(container);
    });
  });
  container.querySelectorAll<HTMLButtonElement>('[data-delete-cat]').forEach((btn) => {
    btn.addEventListener('click', async (ev) => {
      ev.stopPropagation();
      const catId = Number(btn.dataset.deleteCat);
      const catName = btn.dataset.catName || this.l('kategori ini', 'this category');
      const confirmed = await this.showConfirmModal({
        title: this.l('Hapus Kategori', 'Delete Category'),
        message: this.l(
          `Apakah Anda yakin ingin menghapus kategori "${catName}"? Komik di dalam kategori ini tidak akan terhapus dari pustaka.`,
          `Are you sure you want to delete the category "${catName}"? Comics in this category will not be removed from your library.`
        ),
        confirmText: this.l('Hapus', 'Delete'),
        cancelText: this.t('modal.cancel'),
        isDanger: true
      });
      if (confirmed) {
        await this.deleteCategory(catId);
        this.renderLibraryView(container);
      }
    });
  });
  const newCatInput = document.getElementById('newCategoryInput') as HTMLInputElement | null;
  const btnAddCat = document.getElementById('btnAddNewCategory');
  const doAddCategory = async () => {
    if (!newCatInput) return;
    const val = newCatInput.value.trim();
    if (!val) {
      newCatInput.focus();
      return;
    }
    const success = await this.addCategory(val);
    if (success) {
      this.renderLibraryView(container);
    }
  };
  btnAddCat?.addEventListener('click', (ev) => {
    ev.stopPropagation();
    void doAddCategory();
  });
  newCatInput?.addEventListener('keydown', (ev) => {
    if (ev.key === 'Enter') {
      ev.preventDefault();
      void doAddCategory();
    }
  });
  container.querySelectorAll<HTMLButtonElement>('[data-lib-filter]').forEach((btn) => {
    btn.addEventListener('click', (ev) => {
      ev.stopPropagation();
      this.libraryFilterMode = (btn.dataset.libFilter as LibraryFilterMode) || 'all';
      this.renderLibraryView(container);
    });
  });
  container.querySelectorAll<HTMLButtonElement>('[data-lib-src]').forEach((btn) => {
    btn.addEventListener('click', (ev) => {
      ev.stopPropagation();
      this.librarySourceFilter = btn.dataset.libSrc || 'all';
      this.renderLibraryView(container);
    });
  });
  container.querySelectorAll<HTMLButtonElement>('[data-lib-sort]').forEach((btn) => {
    btn.addEventListener('click', (ev) => {
      ev.stopPropagation();
      this.librarySort = (btn.dataset.libSort as LibrarySortBy) || 'lastRead';
      this.renderLibraryView(container);
    });
  });
  document.getElementById('btnResetLibFilterModal')?.addEventListener('click', resetFilterHandler);
  document.getElementById('btnResetLibFilter')?.addEventListener('click', resetFilterHandler);
  document.getElementById('btnRefreshLibrary')?.addEventListener('click', () => {
    const btn = document.getElementById('btnRefreshLibrary') as HTMLButtonElement | null;
    if (btn) {
      btn.classList.add('loading');
      btn.disabled = true;
      btn.innerHTML = '<div class="v1-lib-action-btn-spinner"></div>';
      btn.title = this.l('Sedang Menyinkronkan...', 'Syncing...');
    }
    const emptyIconWrap = container.querySelector('.empty-state-icon-wrap');
    if (emptyIconWrap) {
      emptyIconWrap.innerHTML = '<div class="empty-state-spinner"></div>';
      const titleEl = container.querySelector('.empty-state-title');
      if (titleEl) titleEl.textContent = this.l('Memperbarui Pustaka...', 'Updating Library...');
      const descEl = container.querySelector('.empty-state-desc');
      if (descEl) descEl.textContent = this.l('Sedang menyinkronkan data bab dari sumber komik...', 'Syncing chapter data from comic sources...');
      const browseBtn = document.getElementById('btnGoBrowseFromEmpty');
      if (browseBtn) (browseBtn as HTMLElement).style.display = 'none';
    }
    void this.triggerLibrarySyncProgress();
  });
  document.getElementById('btnToggleLibViewMode')?.addEventListener('click', () => {
    this.libraryViewMode = this.libraryViewMode === 'grid' ? 'list' : 'grid';
    this.renderLibraryView(container);
  });
  document.getElementById('btnGoBrowseFromEmpty')?.addEventListener('click', () => {
    this.navigateToTab('browse');
  });
  document.getElementById('btnOpenTutorialFromLibrary')?.addEventListener('click', () => {
    this.openTutorial(0);
  });

  // Right-click context menu on cards/rows
  bindCardContextMenus(container);
  document.getElementById('ctxMarkRead')?.addEventListener('click', () => {
    if (ctxManga) {
      const nowEpoch = Date.now();
      ctxManga.unreadCount = 0;
      ctxManga.lastViewedEpoch = nowEpoch;
      ctxManga.chapters.forEach((c) => {
        c.isRead = true;
      });
      this.readingStatsData = null;
      if (this.bridge.isWebViewHost) {
        void this.bridge.invoke<MangaItem>('manga:mark-chapters', { mangaId: ctxManga.id, mode: 'all-read' }).then((res) => {
          if (res) {
            res.unreadCount = 0;
            res.lastViewedEpoch = res.lastViewedEpoch && res.lastViewedEpoch > 0 ? res.lastViewedEpoch : nowEpoch;
            this.upsertMangaItem(res);
          }
          this.readingStatsData = null;
          if (this.currentTab === 'library' && !this.activeDetailMangaId) this.renderLibraryView(container);
        });
      }
      this.showToast(this.l(`Seluruh bab ${ctxManga.title} ditandai sudah dibaca.`, `All chapters of ${ctxManga.title} marked as read.`));
    }
    this.contextMenuMangaId = null;
    this.renderLibraryView(container);
  });
  document.getElementById('ctxMarkUnread')?.addEventListener('click', () => {
    if (ctxManga) {
      ctxManga.unreadCount = ctxManga.totalChapters;
      ctxManga.lastViewedEpoch = 0;
      ctxManga.chapters.forEach((c) => {
        c.isRead = false;
      });
      this.readingStatsData = null;
      if (this.bridge.isWebViewHost) {
        void this.bridge.invoke<MangaItem>('manga:mark-chapters', { mangaId: ctxManga.id, mode: 'all-unread' }).then((res) => {
          if (res) {
            res.unreadCount = res.totalChapters;
            res.lastViewedEpoch = 0;
            this.upsertMangaItem(res);
          }
          this.readingStatsData = null;
          if (this.currentTab === 'library' && !this.activeDetailMangaId) this.renderLibraryView(container);
        });
      }
      this.showToast(this.l(`${ctxManga.title} ditandai belum dibaca.`, `${ctxManga.title} marked as unread.`));
    }
    this.contextMenuMangaId = null;
    this.renderLibraryView(container);
  });
  document.getElementById('ctxDeleteDownloads')?.addEventListener('click', () => {
    if (ctxManga) {
      ctxManga.downloadedCount = 0;
      ctxManga.chapters.forEach((c) => {
        c.isDownloaded = false;
      });
      if (this.bridge.isWebViewHost) {
        void this.bridge.invoke('downloads:delete-manga', { mangaId: ctxManga.id });
      }
      this.showToast(this.l(`Unduhan untuk ${ctxManga.title} telah dihapus.`, `Downloads for ${ctxManga.title} deleted.`));
    }
    this.contextMenuMangaId = null;
    this.renderLibraryView(container);
  });
  document.getElementById('ctxRemoveLibrary')?.addEventListener('click', () => {
    if (ctxManga) {
      ctxManga.inLibrary = false;
      if (this.bridge.isWebViewHost) {
        void this.bridge.invoke<MangaItem>('manga:toggle-library', { mangaId: ctxManga.id });
      }
      this.showToast(this.l(`${ctxManga.title} dihapus dari Pustaka.`, `${ctxManga.title} removed from Library.`));
      this.persistLocalCache();
    }
    this.contextMenuMangaId = null;
    this.renderLibraryView(container);
  });
  document.getElementById('ctxManageCategories')?.addEventListener('click', () => {
    if (ctxManga) {
      this.categoryManageMangaId = ctxManga.id;
    }
    this.contextMenuMangaId = null;
    this.renderLibraryView(container);
  });

  // Category Assignment Modal events
  document.getElementById('btnCloseCatManageModal')?.addEventListener('click', (ev) => {
    ev.stopPropagation();
    this.categoryManageMangaId = null;
    this.renderLibraryView(container);
  });
  document.getElementById('btnCancelCatManageModal')?.addEventListener('click', (ev) => {
    ev.stopPropagation();
    this.categoryManageMangaId = null;
    this.renderLibraryView(container);
  });
  document.getElementById('libCategoryModalBackdrop')?.addEventListener('click', (ev) => {
    if (ev.target === document.getElementById('libCategoryModalBackdrop')) {
      this.categoryManageMangaId = null;
      this.renderLibraryView(container);
    }
  });
  container.querySelector('.v1-cat-manage-dialog')?.addEventListener('click', (ev) => {
    ev.stopPropagation();
  });
  document.getElementById('btnSaveCatManageModal')?.addEventListener('click', async (ev) => {
    ev.stopPropagation();
    const mangaId = this.categoryManageMangaId;
    if (!mangaId) return;
    const checkboxes = container.querySelectorAll<HTMLInputElement>('.v1-cat-checkbox:checked');
    const selectedIds: number[] = [];
    checkboxes.forEach((cb) => {
      const id = Number(cb.dataset.catId);
      if (!isNaN(id)) selectedIds.push(id);
    });
    await this.setMangaCategories(mangaId, selectedIds);
    this.categoryManageMangaId = null;
    this.renderLibraryView(container);
  });
  this.bindCommonCardTriggers(container);
}

export async function triggerLibrarySyncProgress(this: YomicApp, forceRefresh = true): Promise<void> {
  if (this.syncProgress.active) return;
  const total = Math.max(1, this.mangaList.filter((m) => m.inLibrary).length);
  this.syncProgress = { active: true, current: 0, total };
  if (this.currentTab === 'library' && !this.activeDetailMangaId) {
    const container = document.getElementById('viewContainer');
    if (container) this.renderLibraryView(container);
  } else if (this.currentTab === 'updates') {
    const container = document.getElementById('viewContainer');
    if (container) this.renderUpdatesView(container);
  }
  if (this.bridge.isWebViewHost) {
    try {
      const res = await this.bridge.invoke<{
        alreadyRunning?: boolean;
        newChaptersCount?: number;
        mangaList?: MangaItem[];
        activityUpdates?: ActivityUpdateItem[];
      }>('library:sync-all', { forceRefresh }, 180000);
      this.syncProgress.active = false;
      if (res && Array.isArray(res.mangaList)) {
        for (const m of res.mangaList) {
          this.upsertMangaItem(m);
        }
      }
      if (res && Array.isArray(res.activityUpdates)) {
        this.activityUpdates.length = 0;
        this.activityUpdates.push(...res.activityUpdates);
      }
      this.renderCurrentWorkspace(true);
      const count = res?.newChaptersCount ?? 0;
      this.showToast(
        count > 0
          ? this.l(`Pustaka diperbarui: ${count} bab baru ditemukan!`, `Library updated: ${count} new chapters found!`)
          : this.l('Pustaka selesai diperbarui.', 'Library update complete.')
      );
    } catch {
      this.syncProgress.active = false;
      this.renderCurrentWorkspace(true);
      this.showToast(this.l('Pustaka selesai diperbarui.', 'Library update complete.'));
    }
    return;
  }
  const timer = window.setInterval(() => {
    this.syncProgress.current++;
    if (this.syncProgress.current > this.syncProgress.total) {
      window.clearInterval(timer);
      this.syncProgress.active = false;
      if (this.currentTab === 'library' && !this.activeDetailMangaId) {
        const container = document.getElementById('viewContainer');
        if (container) this.renderLibraryView(container);
      }
      this.showToast(this.l('Pustaka selesai diperbarui.', 'Library update complete.'));
      return;
    }
    if (this.currentTab === 'library' && !this.activeDetailMangaId) {
      const container = document.getElementById('viewContainer');
      if (container) this.renderLibraryView(container);
    }
  }, 260);
}

export function isExplicitManga(this: YomicApp, manga: MangaItem): boolean {
  const explicitTags = ['mature', 'adult', 'smut', 'hentai', 'ecchi', 'gore', 'guro', 'r-18', '18+', 'doujinshi'];
  if (Array.isArray(manga.genres) && manga.genres.some((g) => explicitTags.includes(String(g).trim().toLowerCase()))) {
    return true;
  }
  const ext = this.extensions.find((e) => e.id === manga.sourceId || e.name.toLowerCase() === (manga.sourceName || '').toLowerCase());
  if (ext?.isNsfw) return true;
  return (manga.sourceName || '').toLowerCase().includes('nhentai');
}

export function buildMangaGridCardHtml(this: YomicApp, manga: MangaItem): string {
  const fallbackSvg = buildMangaCoverSvg(manga);
  const coverSrc = this.getMangaCoverHtmlSrc(manga);
  const shouldBlur = this.settings.blurExplicitCovers && this.isExplicitManga(manga);
  const blurStyle = shouldBlur ? ' style="filter: blur(14px); transform: scale(1.08);"' : '';
  const unreadBadge =
    this.settings.showUnreadBadges && manga.unreadCount > 0
      ? `<span class="badge-unread tabular-nums" title="${this.l(`${manga.unreadCount} bab belum dibaca`, `${manga.unreadCount} unread chapters`)}">${manga.unreadCount}</span>`
      : '';
  const malFavicon = manga.malTracked
    ? `<span class="v1-mal-card-favicon" title="${escapeXml(this.l('Tertaut ke MyAnimeList', 'Linked to MyAnimeList'))}" style="display:inline-flex;align-items:center;flex-shrink:0;"><svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true"><rect width="16" height="16" rx="3.5" fill="#2E51A2"/><text x="8" y="10.3" text-anchor="middle" fill="#FFFFFF" font-family="Arial,sans-serif" font-size="6" font-weight="800" letter-spacing="-0.3">MAL</text></svg></span>`
    : '';
  return `
    <article class="manga-card" data-open-detail="${manga.id}">
      <div class="manga-cover-wrap">
        <img class="manga-cover-img"${blurStyle} src="${coverSrc}" alt="${escapeXml(manga.title)}" loading="lazy" onerror="this.onerror=null;this.src='${fallbackSvg}';" />
        ${unreadBadge ? `<div class="card-badges-top">${unreadBadge}</div>` : ''}
      </div>
      <div class="manga-card-body">
        <div class="manga-card-title" title="${escapeXml(manga.title)}">${manga.title}</div>
        <div class="manga-card-meta">
          ${this.buildSourceFaviconHtml(manga.sourceName, manga.sourceId, 14)}
          ${malFavicon}
          <span class="manga-card-time">${manga.lastReadTimeAgo}</span>
        </div>
      </div>
    </article>
  `;
}

export function buildMangaListRowHtml(this: YomicApp, manga: MangaItem): string {
  const fallbackSvg = buildMangaCoverSvg(manga);
  const coverSrc = this.getMangaCoverHtmlSrc(manga);
  const shouldBlur = this.settings.blurExplicitCovers && this.isExplicitManga(manga);
  const blurStyle = shouldBlur ? ' style="filter: blur(8px);"' : '';
  const malFavicon = manga.malTracked
    ? `<span class="v1-mal-card-favicon" title="${escapeXml(this.l('Tertaut ke MyAnimeList', 'Linked to MyAnimeList'))}" style="display:inline-flex;align-items:center;flex-shrink:0;"><svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true"><rect width="16" height="16" rx="3.5" fill="#2E51A2"/><text x="8" y="10.3" text-anchor="middle" fill="#FFFFFF" font-family="Arial,sans-serif" font-size="6" font-weight="800" letter-spacing="-0.3">MAL</text></svg></span>`
    : '';
  return `
    <div class="v1-lib-list-row" data-open-detail="${manga.id}">
      <div class="v1-lib-list-left">
        <img class="v1-lib-list-thumb"${blurStyle} src="${coverSrc}" alt="${escapeXml(manga.title)}" loading="lazy" onerror="this.onerror=null;this.src='${fallbackSvg}';" />
        <div class="v1-lib-list-info">
          <div class="v1-lib-list-title">${manga.title}</div>
          <div class="manga-card-meta">
            ${this.buildSourceFaviconHtml(manga.sourceName, manga.sourceId, 14)}
            ${malFavicon}
            <span class="manga-card-time">${manga.lastReadTimeAgo}</span>
          </div>
        </div>
      </div>
      <div class="v1-lib-list-badges">
        ${
          this.settings.showUnreadBadges && manga.unreadCount > 0
            ? `<span class="badge-unread tabular-nums">${manga.unreadCount}</span>`
            : ''
        }
      </div>
    </div>
  `;
}
