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
 * 3. BROWSE SOURCES & EXTENSIONS VIEWS (MINIMALIST YOMIC V1 MIRROR)
 * ========================================================================= */

let activeSourceFeedSeq = 0;

export function isAdultExtension(ext: { isNsfw?: boolean; name?: string; id?: string; pkg?: string; baseUrl?: string }): boolean {
  if (ext.isNsfw) return true;
  const candidates = [ext.name, ext.id, ext.pkg, ext.baseUrl].filter(Boolean).map((s) => String(s).toLowerCase());
  const adultKeywords = [
    '18+', 'dewasa', 'hentai', 'doujin', 'smut', 'crot', 'porn', 'xxx', 'ecchi',
    'eromanga', 'nhentai', 'nekopoi', 'mangapoi', 'kumapoi', 'kumopoi', 'mangasusu',
    'r-18', 'r18', 'mature', 'adult', 'guro', 'yaoi', 'yuri'
  ];
  return candidates.some((text) => adultKeywords.some((kw) => text.includes(kw)));
}

export function buildLangBadgeHtml(this: YomicApp, lang: 'ID' | 'EN' | 'ALL'): string {
  if (lang === 'ID') {
    return `
      <span class="v1-flag-border" title="Bahasa Indonesia (ID)">
        <svg width="24" height="16" viewBox="0 0 24 16" fill="none">
          <rect width="24" height="8" fill="#CE1126"/>
          <rect y="8" width="24" height="8" fill="#FFFFFF"/>
        </svg>
      </span>`;
  }
  if (lang === 'EN') {
    return `
      <span class="v1-flag-border" title="English (EN)">
        <svg width="24" height="16" viewBox="0 0 60 40" fill="none">
          <rect width="60" height="40" fill="#012169"/>
          <path d="M0 0 L60 40 M60 0 L0 40" stroke="#FFFFFF" stroke-width="8"/>
          <path d="M0 0 L60 40 M60 0 L0 40" stroke="#C8102E" stroke-width="4"/>
          <path d="M30 0 v40 M0 20 h60" stroke="#FFFFFF" stroke-width="12"/>
          <path d="M30 0 v40 M0 20 h60" stroke="#C8102E" stroke-width="6"/>
        </svg>
      </span>`;
  }
  return `
    <span class="v1-flag-border" title="Multi-Bahasa (MULTI)">
      <svg width="24" height="16" viewBox="0 0 24 16" fill="none">
        <rect width="24" height="16" fill="#0D9488"/>
        <circle cx="12" cy="8" r="5.5" stroke="#FFFFFF" stroke-width="1.2" fill="none"/>
        <line x1="6.5" y1="8" x2="17.5" y2="8" stroke="#FFFFFF" stroke-width="1"/>
        <ellipse cx="12" cy="8" rx="2.8" ry="5.5" stroke="#FFFFFF" stroke-width="1" fill="none"/>
        <line x1="12" y1="2.5" x2="12" y2="13.5" stroke="#FFFFFF" stroke-width="1"/>
      </svg>
    </span>`;
}

export function buildLangFlagsHtml(this: YomicApp, lang: 'ID' | 'EN' | 'ALL'): string {
  return this.buildLangBadgeHtml(lang);
}

export function updateSourceStatusInPlace(
  container: HTMLElement,
  sourceId: number | string,
  status: 'online' | 'warning' | 'offline' | 'checking',
  tooltip?: string
): void {
  const row = container.querySelector<HTMLElement>(
    `.v1-source-row[data-source-id="${sourceId}"], .v1-source-row[data-open-source="${sourceId}"]`
  );
  if (!row) return;

  const isEn = document.documentElement.lang === 'en';
  const statusTitle =
    tooltip ||
    (status === 'online'
      ? isEn
        ? 'Server Status: Online (Stable)'
        : 'Status Server: Online (Stabil)'
      : status === 'warning'
      ? isEn
        ? 'Server Status: Cloudflare Protected / Slow'
        : 'Status Server: Dilindungi Cloudflare / Lambat'
      : status === 'offline'
      ? isEn
        ? 'Server Status: Offline / Unreachable'
        : 'Status Server: Offline / Tidak Dapat Dijangkau'
      : isEn
      ? 'Checking status...'
      : 'Memeriksa status...');

  const actionsEl = row.querySelector('.v1-source-actions');
  if (!actionsEl) return;

  const existingBadge = actionsEl.querySelector('.v1-status-dot-wrap, .v1-status-badge');
  const badgeHtml =
    status === 'online'
      ? `<span class="v1-status-dot-wrap" title="${escapeXml(statusTitle)}"><span class="v1-status-dot online"></span></span>`
      : `<span class="v1-status-badge ${status}" title="${escapeXml(statusTitle)}"><span class="v1-status-dot ${status}"></span><span>${status === 'warning' ? 'Cloudflare' : status === 'checking' ? (isEn ? 'Checking...' : 'Memeriksa...') : 'Offline'}</span></span>`;

  if (existingBadge) {
    existingBadge.outerHTML = badgeHtml;
  } else {
    actionsEl.insertAdjacentHTML('afterbegin', badgeHtml);
  }
}

export function renderBrowseView(this: YomicApp, container: HTMLElement, preserveScroll = false): void {
  container.onscroll = null;
  this.setTopbarHeader(this.t('browse.title'));

  // If a specific source was clicked, render its catalog feed (SourceFeedView)
  if (this.activeBrowseSourceId) {
    const source = this.extensions.find((e) => e.id === this.activeBrowseSourceId);
    if (source && (this.settings.showNsfw || (!source.isNsfw && !isAdultExtension(source)))) {
      this.renderSourceCatalogFeed(container, source, preserveScroll);
      return;
    }
    this.activeBrowseSourceId = null;
  }
  const installedSources = this.extensions
    .filter((e) => {
      if (!e.installed) return false;
      if (!this.settings.showNsfw && (e.isNsfw || isAdultExtension(e))) return false;
      const isMangaDex = e.id.toLowerCase().includes('mangadex') || e.name.toLowerCase().includes('mangadex');
      const srcLang = (e.lang || 'ALL').toUpperCase();
      if (this.browseLangFilter !== 'ALL' && srcLang !== this.browseLangFilter && srcLang !== 'ALL' && !isMangaDex) {
        return false;
      }
      return true;
    })
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));

  const checkSvg = getIconSvg('check', { size: 13, strokeWidth: 2.5 });
  const isFiltered = this.browseLangFilter !== 'ALL';
  const totalInstalledCount = this.extensions.filter((e) => e.installed && (this.settings.showNsfw || (!e.isNsfw && !isAdultExtension(e)))).length;
  let listHtml = '';

  if (this.browseVerificationProgress.active) {
    const totalCount = this.browseVerificationProgress.total || totalInstalledCount || 18;
    const curCount = this.browseVerificationProgress.current;
    const browsePercent = Math.round((curCount / Math.max(1, totalCount)) * 100);
    listHtml = `
      <div class="empty-state-box">
        <div class="empty-state-icon-wrap">
          <svg class="empty-state-spinner-svg" width="44" height="44" viewBox="0 0 44 44" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="22" cy="22" r="18" stroke="var(--border-subtle)" stroke-width="3.5" />
            <circle cx="22" cy="22" r="18" stroke="var(--ocean-primary)" stroke-width="3.5" stroke-linecap="round" stroke-dasharray="28 85" />
          </svg>
        </div>
        <div class="empty-state-title">
          ${this.l('Memverifikasi Jaringan Sumber...', 'Verifying Source Network...')} <span class="browse-state-counter tabular-nums" style="color:var(--ocean-primary); font-weight:700;">(${curCount}/${totalCount})</span>
        </div>
        <div class="empty-state-desc">${this.l('Sedang memeriksa ketersediaan dan status server sumber...', 'Checking source server availability and status...')}</div>
        <div class="empty-state-progress-track" style="width: 220px; height: 4px; background: var(--bg-surface-alt); border-radius: 2px; overflow: hidden; margin-top: 6px;">
          <div class="browse-state-progress-fill" style="width: ${browsePercent}%; height: 100%; background: var(--ocean-primary); border-radius: 2px; transition: width 0.25s ease;"></div>
        </div>
      </div>`;
  } else if (installedSources.length === 0) {
    listHtml = `
      <div class="empty-state-box">
        <div class="empty-state-icon-wrap">
          ${getIconSvg('compass-3-line', { size: 48 })}
        </div>
        <div class="empty-state-title">${isFiltered ? this.l('Sumber Tidak Ditemukan', 'No Sources Found') : this.l('Belum Ada Sumber Terpasang', 'No Sources Installed Yet')}</div>
        <div class="empty-state-desc">${
          isFiltered
            ? this.l('Tidak ada sumber terpasang yang cocok dengan pencarian atau filter bahasa saat ini.', 'No installed sources match the current search or language filter.')
            : this.l('Pasang ekstensi sumber komik dari repositori untuk mulai membaca komik.', 'Install comic source extensions from the repository to start reading.')
        }</div>
        ${
          isFiltered
            ? `<button id="btnResetBrowseFilter" class="empty-state-btn">
                 ${getIconSvg('refresh-line', { size: 14 })}
                 <span>${this.l('Atur Ulang Pencarian', 'Reset Search')}</span>
               </button>`
            : `<button id="btnGoExtensionsFromBrowse" class="empty-state-btn primary">
                 <span>${this.l('Buka Ekstensi', 'Open Extensions')}</span>
               </button>`
        }
      </div>`;
  } else {
    listHtml = `
      <div class="v1-source-list">
        ${installedSources
          .map((src) => {
            const st = src.status ?? 'online';
            const statusTitle =
              st === 'online'
                ? this.l('Status Server: Online (Stabil)', 'Server Status: Online (Stable)')
                : st === 'warning'
                ? this.l('Status Server: Dilindungi Cloudflare / Lambat', 'Server Status: Cloudflare Protected / Slow')
                : st === 'offline'
                ? this.l('Status Server: Offline / Tidak Dapat Dijangkau', 'Server Status: Offline / Unreachable')
                : this.l('Memeriksa status...', 'Checking status...');
            const cleanDomain = src.baseUrl.replace(/^https?:\/\//i, '').replace(/\/$/, '');
            return `
              <div class="v1-source-row" data-open-source="${escapeXml(src.id)}" data-source-id="${src.sourceId ?? ''}">
                ${this.buildSourceLogoHtml(src)}
                <div class="v1-source-info">
                  <div class="v1-source-name-row">
                    <span class="v1-source-name">${escapeXml(src.name)}</span>
                  </div>
                  <div class="v1-source-domain">${escapeXml(cleanDomain)}</div>
                </div>
                <div class="v1-source-actions">
                  ${st === 'online'
                    ? `<span class="v1-status-dot-wrap" title="${escapeXml(statusTitle)}"><span class="v1-status-dot online"></span></span>`
                    : `<span class="v1-status-badge ${st}" title="${escapeXml(statusTitle)}"><span class="v1-status-dot ${st}"></span><span>${st === 'warning' ? 'Cloudflare' : st === 'checking' ? this.l('Memeriksa...', 'Checking...') : 'Offline'}</span></span>`
                  }
                  <button class="v1-webview-btn" data-open-source-web="${escapeXml(src.id)}" title="${this.l(`Buka ${escapeXml(src.name)} di Browser`, `Open ${escapeXml(src.name)} in Browser`)}" aria-label="${this.l('Buka di Browser', 'Open in Browser')}">
                    ${getIconSvg('global-linear', { size: 15 })}
                  </button>
                </div>
              </div>`;
          })
          .join('')}
      </div>`;
  }

  container.innerHTML = `
    <!-- Header: Globe Icon + "Jelajahi Sumber" (BrowseView.axaml L67-76) -->
    <div class="v1-lib-top">
      <div class="v1-lib-master-bar">
        <div class="v1-lib-title-group">
          <div class="v1-lib-title-row">
            ${getIconSvg('compass-3-line', { size: 24 })}
            <span class="v1-lib-title-text">${this.t('browse.title')}</span>
            <span class="v1-lib-count-inline tabular-nums">(${installedSources.length})</span>
          </div>
        </div>
        <!-- Action Toolbar with Morphing Expandable Search Box -->
        ${
          totalInstalledCount > 0
            ? `<div class="v1-lib-actions">
          <!-- 1. Morphing Animated Expandable Search -->
          <div id="browseExpandSearch" class="v1-expand-search ${this.isBrowseSearchOpen || this.browseSearchQuery ? 'open' : ''}">
            <button id="btnToggleBrowseSearch" class="v1-expand-search-icon-btn" title="${this.l('Cari Sumber Komik', 'Search Comic Sources')}" aria-label="${this.l('Cari Sumber', 'Search Sources')}">
              ${getIconSvg('search-line', { size: 18 })}
            </button>
            <input id="browseSearchInput" class="v1-expand-search-input" type="text" placeholder="${this.l('Cari sumber komik...', 'Search comic sources...')}" value="${escapeXml(this.browseSearchQuery)}" autocomplete="off" />
            <button id="btnClearBrowseSearch" class="v1-expand-search-clear-btn" title="${this.l('Tutup / Bersihkan', 'Close / Clear')}" aria-label="${this.l('Tutup Pencarian', 'Close Search')}">
              ${getIconSvg('close-line', { size: 13 })}
            </button>
          </div>
          <!-- 2. Refresh Source Status -->
          <button id="btnRefreshBrowseStatus" class="v1-lib-action-btn ${this.isManualBrowseRefreshing ? 'is-disabled' : ''}" ${this.isManualBrowseRefreshing ? 'disabled' : ''} title="${this.isManualBrowseRefreshing ? this.l('Sedang Memperbarui Status...', 'Refreshing Status...') : this.l('Segarkan Status Sumber', 'Refresh Source Status')}" aria-label="${this.l('Segarkan Status Sumber', 'Refresh Source Status')}">
            ${getIconSvg('refresh-line', { size: 18 })}
          </button>
          <!-- 3. Filter by Language Flyout -->
          <button id="btnBrowseLangFlyout" class="v1-lib-action-btn ${this.isBrowseLangFlyoutOpen ? 'active' : ''} ${this.browseLangFilter !== 'ALL' ? 'has-filter' : ''}" title="${this.l('Filter Bahasa', 'Language Filter')}" aria-label="${this.l('Filter Bahasa', 'Language Filter')}">
            ${getIconSvg('filter', { size: 18 })}
          </button>
          <div id="browseLangFlyoutMenu" class="v1-lib-flyout ${this.isBrowseLangFlyoutOpen ? 'open' : ''}">
            <div class="v1-flyout-section-label">${this.l('Filter Bahasa', 'Language Filter')}</div>
            <button class="v1-lib-flyout-item ${this.browseLangFilter === 'ALL' ? 'selected' : ''}" data-browse-lang="ALL">
              <span class="v1-lib-flyout-check">${this.browseLangFilter === 'ALL' ? checkSvg : ''}</span>
              ${this.buildLangBadgeHtml('ALL')}
              <span>${this.l('Tampilkan Semua', 'Show All')}</span>
            </button>
            <button class="v1-lib-flyout-item ${this.browseLangFilter === 'ID' ? 'selected' : ''}" data-browse-lang="ID">
              <span class="v1-lib-flyout-check">${this.browseLangFilter === 'ID' ? checkSvg : ''}</span>
              ${this.buildLangBadgeHtml('ID')}
              <span>${this.l('Bahasa Indonesia', 'Indonesian')}</span>
            </button>
            <button class="v1-lib-flyout-item ${this.browseLangFilter === 'EN' ? 'selected' : ''}" data-browse-lang="EN">
              <span class="v1-lib-flyout-check">${this.browseLangFilter === 'EN' ? checkSvg : ''}</span>
              ${this.buildLangBadgeHtml('EN')}
              <span>English</span>
            </button>
          </div>
        </div>`
            : ''
        }
      </div>
    </div>
    ${listHtml}
  `;
  // In-Place Search Filtering (60 FPS without destroying DOM or losing cursor)
  const searchInput = document.getElementById('browseSearchInput') as HTMLInputElement | null;
  const filterRowsInPlace = () => {
    const q = (searchInput?.value ?? '').trim().toLowerCase();
    this.browseSearchQuery = searchInput?.value ?? '';
    const rows = container.querySelectorAll<HTMLElement>('.v1-source-row');
    let visibleCount = 0;
    rows.forEach((row) => {
      const name = (row.querySelector('.v1-source-name')?.textContent ?? '').toLowerCase();
      const domain = (row.querySelector('.v1-source-domain')?.textContent ?? '').toLowerCase();
      const matches = !q || name.includes(q) || domain.includes(q);
      row.style.display = matches ? '' : 'none';
      if (matches) visibleCount++;
    });
    const countEl = container.querySelector('.v1-lib-count-inline');
    if (countEl) {
      countEl.textContent = `(${visibleCount})`;
    }
    let emptyBox = container.querySelector<HTMLElement>('.v1-browse-search-empty');
    if (visibleCount === 0 && rows.length > 0) {
      if (!emptyBox) {
        const listEl = container.querySelector('.v1-source-list');
        if (listEl) {
          const newEmpty = document.createElement('div');
          newEmpty.className = 'empty-state-box v1-browse-search-empty';
          newEmpty.style.padding = '36px 0';
          newEmpty.innerHTML = `
            <div class="empty-state-icon-wrap">${getIconSvg('search', { size: 36 })}</div>
            <div class="empty-state-title">${this.l('Sumber Tidak Ditemukan', 'No Sources Found')}</div>
            <div class="empty-state-desc">${this.l(`Tidak ada sumber yang cocok dengan kata kunci "${escapeXml(q)}".`, `No sources match "${escapeXml(q)}".`)}</div>
          `;
          listEl.insertAdjacentElement('afterend', newEmpty);
        }
      } else {
        emptyBox.style.display = '';
        const desc = emptyBox.querySelector('.empty-state-desc');
        if (desc) desc.textContent = this.l(`Tidak ada sumber yang cocok dengan kata kunci "${q}".`, `No sources match "${q}".`);
      }
    } else if (emptyBox) {
      emptyBox.style.display = 'none';
    }
  };

  if (this.browseSearchQuery.trim()) {
    filterRowsInPlace();
  }

  document.getElementById('btnToggleBrowseSearch')?.addEventListener('click', (ev) => {
    ev.stopPropagation();
    const box = document.getElementById('browseExpandSearch');
    const input = document.getElementById('browseSearchInput') as HTMLInputElement | null;
    this.isBrowseSearchOpen = !this.isBrowseSearchOpen;
    if (this.isBrowseSearchOpen) {
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
      if (this.browseSearchQuery) {
        this.browseSearchQuery = '';
        if (input) input.value = '';
        filterRowsInPlace();
      }
    }
  });

  searchInput?.addEventListener('input', () => {
    filterRowsInPlace();
  });

  searchInput?.addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape') {
      ev.preventDefault();
      const box = document.getElementById('browseExpandSearch');
      this.isBrowseSearchOpen = false;
      this.browseSearchQuery = '';
      if (searchInput) searchInput.value = '';
      box?.classList.remove('animating', 'open');
      searchInput?.blur();
      filterRowsInPlace();
    }
  });

  document.getElementById('btnClearBrowseSearch')?.addEventListener('click', (ev) => {
    ev.stopPropagation();
    const box = document.getElementById('browseExpandSearch');
    const input = document.getElementById('browseSearchInput') as HTMLInputElement | null;
    this.browseSearchQuery = '';
    this.isBrowseSearchOpen = false;
    if (input) input.value = '';
    box?.classList.remove('animating', 'open');
    input?.blur();
    filterRowsInPlace();
  });

  document.getElementById('btnResetBrowseFilter')?.addEventListener('click', (ev) => {
    ev.stopPropagation();
    this.browseSearchQuery = '';
    this.browseLangFilter = 'ALL';
    this.isBrowseSearchOpen = false;
    this.renderBrowseView(container);
  });

  document.getElementById('btnGoExtensionsFromBrowse')?.addEventListener('click', (ev) => {
    ev.stopPropagation();
    this.navigateToTab('extensions');
  });

  // Refresh Source Status: Uses real backend progress so counter never outruns actual checks
  document.getElementById('btnRefreshBrowseStatus')?.addEventListener('click', () => {
    if (this.browseVerificationProgress.active) return;
    const totalCount = this.extensions.filter((e) => e.installed).length || 18;
    this.isManualBrowseRefreshing = true;
    this.browseVerificationProgress = {
      active: true,
      current: this.bridge.isWebViewHost ? 0 : 1,
      total: totalCount,
    };

    this.renderBrowseView(container);

    const finishRefresh = (list?: ExtensionItem[], toastMsg?: string) => {
      if (Array.isArray(list) && list.length > 0) {
        this.extensions.length = 0;
        this.extensions.push(...list);
      }
      this.isManualBrowseRefreshing = false;
      this.browseVerificationProgress.active = false;
      if (this.currentTab === 'browse' && !this.activeBrowseSourceId && !this.activeDetailMangaId) {
        const targetContainer = document.getElementById('viewContainer') || container;
        if (targetContainer) {
          this.renderBrowseView(targetContainer);
        }
      }
      if (toastMsg) {
        this.showToast(toastMsg);
      }
    };

    if (this.bridge.isWebViewHost) {
      void this.bridge
        .invoke<ExtensionItem[]>('browse:refresh-status', undefined, 60000)
        .then((list) => {
          const tot = this.browseVerificationProgress.total || totalCount;
          this.browseVerificationProgress.current = tot;
          const counterEl = document.querySelector('.browse-state-counter');
          const progressFill = document.querySelector('.browse-state-progress-fill') as HTMLElement | null;
          if (counterEl) counterEl.textContent = `(${tot}/${tot})`;
          if (progressFill) progressFill.style.width = '100%';
          setTimeout(() => {
            finishRefresh(list, this.l('Status koneksi seluruh sumber berhasil diverifikasi.', 'Connection status for all sources verified.'));
          }, 200);
        })
        .catch(() => {
          finishRefresh(undefined, this.l('Verifikasi sumber selesai (sebagian sumber mungkin timeout).', 'Source verification completed (some sources may have timed out).'));
        });
    } else {
      let curStep = 1;
      const stepTimer = window.setInterval(() => {
        if (curStep < totalCount) {
          curStep++;
          this.browseVerificationProgress.current = curStep;
          const counterEl = document.querySelector('.browse-state-counter');
          const progressFill = document.querySelector('.browse-state-progress-fill') as HTMLElement | null;
          if (counterEl) counterEl.textContent = `(${curStep}/${totalCount})`;
          if (progressFill) progressFill.style.width = `${Math.round((curStep / totalCount) * 100)}%`;
        } else {
          window.clearInterval(stepTimer);
          setTimeout(() => {
            finishRefresh(undefined, this.l('Status koneksi seluruh sumber berhasil diverifikasi.', 'Connection status for all sources verified.'));
          }, 200);
        }
      }, 50);
    }
  });

  // Language Filter Flyout Menu & Click-Outside Listener
  const flyout = document.getElementById('browseLangFlyoutMenu');
  const btnFlyout = document.getElementById('btnBrowseLangFlyout');
  btnFlyout?.addEventListener('click', (ev) => {
    ev.stopPropagation();
    this.isBrowseLangFlyoutOpen = !this.isBrowseLangFlyoutOpen;
    flyout?.classList.toggle('open', this.isBrowseLangFlyoutOpen);
    btnFlyout.classList.toggle('active', this.isBrowseLangFlyoutOpen);
  });
  flyout?.addEventListener('click', (ev) => {
    ev.stopPropagation();
  });
  const onDocClick = (ev: MouseEvent) => {
    if (this.isBrowseLangFlyoutOpen) {
      const target = ev.target as Node | null;
      if (flyout && !flyout.contains(target) && btnFlyout && !btnFlyout.contains(target)) {
        this.isBrowseLangFlyoutOpen = false;
        flyout.classList.remove('open');
        btnFlyout?.classList.remove('active');
      }
    }
  };
  document.addEventListener('click', onDocClick);

  container.querySelectorAll<HTMLButtonElement>('[data-browse-lang]').forEach((btn) => {
    btn.addEventListener('click', () => {
      this.browseLangFilter = (btn.dataset.browseLang as 'ALL' | 'ID' | 'EN') || 'ALL';
      this.isBrowseLangFlyoutOpen = false;
      this.renderBrowseView(container);
    });
  });

  container.querySelectorAll<HTMLElement>('[data-open-source]').forEach((row) => {
    row.addEventListener('click', () => {
      const srcId = row.dataset.openSource;
      if (srcId) {
        this.saveWorkspaceScroll('browse_sources_list');
        this.savedBrowseScrollTop = container.scrollTop;
        this.activeBrowseSourceId = srcId;
        this.sourceFeedSearchQuery = '';
        this.sourceFeedError = null;
        const src = this.extensions.find((e) => e.id === srcId);
        if (src && this.bridge.isWebViewHost) {
          this.sourceFeedItems = [];
          void this.fetchSourceCatalogFeed(src, true);
        } else {
          this.renderBrowseView(container);
        }
      }
    });
  });

  container.querySelectorAll<HTMLButtonElement>('[data-open-source-web]').forEach((btn) => {
    btn.addEventListener('click', (ev) => {
      ev.stopPropagation();
      const srcId = btn.dataset.openSourceWeb;
      const src = this.extensions.find((e) => e.id === srcId);
      if (src) {
        this.bridge.openExternalUrl(src.baseUrl);
        this.showToast(this.l(`Membuka ${src.name} (${src.baseUrl}) di browser...`, `Opening ${src.name} (${src.baseUrl}) in browser...`));
      }
    });
  });

  document.getElementById('btnGoExtensionsFromBrowse')?.addEventListener('click', () => {
    this.navigateToTab('extensions');
  });

  const sourcesListY = this.viewScrollPositions.get('browse_sources_list') ?? this.savedBrowseScrollTop;
  if (sourcesListY > 0) {
    container.scrollTop = sourcesListY;
    requestAnimationFrame(() => {
      container.scrollTop = sourcesListY;
    });
  }
}

export async function fetchSourceCatalogFeed(this: YomicApp, source: ExtensionItem, resetPage = true): Promise<void> {
  if (!this.bridge.isWebViewHost || source.sourceId === undefined) return;
  const reqSeq = ++activeSourceFeedSeq;
  if (resetPage) {
    this.sourceFeedPage = 1;
    this.sourceFeedItems = [];
    this.sourceFeedError = null;
  }
  this.isSourceFeedLoading = true;
  const container = document.getElementById('viewContainer');
  if (container && this.currentTab === 'browse' && this.activeBrowseSourceId === source.id && !this.activeDetailMangaId) {
    if (this.sourceFeedItems.length === 0) {
      this.renderSourceCatalogFeed(container, source, !resetPage);
    }
  }
  try {
    const res = await this.bridge.invoke<SourceFeedResult>(
      'source:fetch-feed',
      {
        extId: source.id,
        pkg: source.pkg,
        sourceName: source.name,
        sourceId: source.sourceId,
        mode: this.sourceFeedSearchQuery.trim() ? 'search' : this.sourceFeedSort,
        page: this.sourceFeedPage,
        query: this.sourceFeedSearchQuery.trim(),
        sort: this.sourceFeedSort,
        status: this.sourceFeedStatusFilter,
        type: this.sourceFeedTypeFilter,
        genre: this.sourceFeedGenreFilter,
        mangaDexLanguage: (this.settings.mangaDexLanguage || 'en').toLowerCase() === 'id' ? 'id' : 'en'
      },
      60000
    );
    if (reqSeq !== activeSourceFeedSeq) return;
    if (res && Array.isArray(res.items)) {
      let filteredItems = res.items;
      if (!this.settings.showNsfw) {
        filteredItems = filteredItems.filter((item) => !this.isExplicitManga(item));
      }
      const merged = filteredItems.map((item) => this.upsertMangaItem(item));
      if (resetPage) {
        this.sourceFeedItems = merged;
      } else {
        this.sourceFeedItems.push(...merged);
      }
      this.sourceFeedHasMore = Boolean(res.hasMore ?? res.hasNextPage);
      const hasActiveFilter =
        this.sourceFeedSort !== 'popular' ||
        this.sourceFeedStatusFilter !== 'all' ||
        this.sourceFeedTypeFilter !== 'all' ||
        this.sourceFeedGenreFilter !== 'Semua';
      const isSearchOrFilter = Boolean(this.sourceFeedSearchQuery.trim()) || hasActiveFilter;

      if (merged.length > 0) {
        this.sourceFeedError = null;
        if (source.status === 'offline') {
          source.status = 'online';
        }
      } else if (!isSearchOrFilter) {
        // Page 1 empty catalog feed on default settings -> parsing issue or temporary empty feed
        this.sourceFeedError = 'error';
      } else {
        this.sourceFeedError = null;
      }
    } else {
      if (resetPage) {
        this.sourceFeedItems = [];
      }
      this.sourceFeedHasMore = false;
      this.sourceFeedError = 'error';
    }
  } catch {
    if (reqSeq !== activeSourceFeedSeq) return;
    this.sourceFeedHasMore = false;
    this.sourceFeedError = 'error';
    this.showToast(this.l(`Gagal memuat katalog dari ${source.name}. Silakan periksa koneksi atau coba lagi.`, `Failed to load catalog from ${source.name}. Please check your connection or try again.`));
  } finally {
    if (reqSeq !== activeSourceFeedSeq) return;
    this.isSourceFeedLoading = false;
    const nextContainer = document.getElementById('viewContainer');
    if (nextContainer && this.currentTab === 'browse' && this.activeBrowseSourceId === source.id && !this.activeDetailMangaId) {
      const wasFocused = document.activeElement?.id === 'sourceCatalogSearchInput';
      const activeInput = document.activeElement as HTMLInputElement | null;
      const selStart = activeInput?.selectionStart ?? null;
      const selEnd = activeInput?.selectionEnd ?? null;
      this.renderSourceCatalogFeed(nextContainer, source, !resetPage);
      if (wasFocused) {
        const nextInput = document.getElementById('sourceCatalogSearchInput') as HTMLInputElement | null;
        if (nextInput) {
          nextInput.focus();
          if (selStart !== null && selEnd !== null) {
            nextInput.setSelectionRange(selStart, selEnd);
          }
        }
      }
    }
  }
}

export function renderSourceCatalogFeed(this: YomicApp, container: HTMLElement, source: ExtensionItem, preserveScroll = false): void {
  const savedScrollTop = container.scrollTop;
  const genres =
    source.availableGenres && source.availableGenres.length > 0
      ? ['Semua', ...source.availableGenres.filter((g) => g !== 'Semua')]
      : ['Semua', 'Action', 'Fantasy', 'Adventure', 'Drama', 'Shounen', 'Romance', 'Comedy', 'Sci-Fi'];
  const hasActiveSourceFilter =
    this.sourceFeedSort !== 'popular' ||
    this.sourceFeedStatusFilter !== 'all' ||
    this.sourceFeedTypeFilter !== 'all' ||
    this.sourceFeedGenreFilter !== 'Semua';
  const isSearchOrFilter = Boolean(this.sourceFeedSearchQuery.trim()) || hasActiveSourceFilter;

  let feedManga: MangaItem[];
  if (this.bridge.isWebViewHost) {
    feedManga = this.sourceFeedItems;
  } else {
    feedManga = this.mangaList.filter((m) => {
      if (this.sourceFeedGenreFilter !== 'Semua' && !m.genres.includes(this.sourceFeedGenreFilter)) {
        return false;
      }
      if (this.sourceFeedStatusFilter !== 'all' && m.status !== this.sourceFeedStatusFilter) {
        return false;
      }
      if (this.sourceFeedTypeFilter !== 'all' && m.type !== this.sourceFeedTypeFilter) {
        return false;
      }
      if (this.sourceFeedSearchQuery) {
        const q = this.sourceFeedSearchQuery.toLowerCase();
        return (
          m.title.toLowerCase().includes(q) ||
          m.author.toLowerCase().includes(q) ||
          m.genres.some((g) => g.toLowerCase().includes(q))
        );
      }
      return true;
    });
    if (this.sourceFeedSort === 'latest') {
      feedManga = [...feedManga].reverse();
    }
  }

  const isOffline =
    !this.isSourceFeedLoading &&
    (this.settings.isOfflineMode ||
      source.status === 'offline' ||
      (this.sourceFeedError === 'offline' && typeof navigator !== 'undefined' && !navigator.onLine));

  if (isOffline) {
    feedManga = [];
  }

  const checkSvg = getIconSvg('check', { size: 13, strokeWidth: 2.5 });

  let emptyStateHtml: string;
  if (this.isSourceFeedLoading) {
    const skeletonCards = Array.from({ length: 12 })
      .map(
        () => `
        <div class="v1-skeleton-card" aria-hidden="true">
          <div class="v1-skeleton-cover v1-skeleton-shimmer"></div>
          <div class="v1-skeleton-line v1-skeleton-shimmer" style="width: 86%;"></div>
          <div class="v1-skeleton-line v1-skeleton-shimmer" style="width: 58%;"></div>
        </div>`
      )
      .join('');
    emptyStateHtml = `<div class="manga-grid" aria-busy="true" aria-label="${escapeXml(this.l('Memuat Katalog...', 'Loading Catalog...'))}">${skeletonCards}</div>`;
  } else if (isSearchOrFilter && feedManga.length === 0 && !isOffline) {
    emptyStateHtml = `
      <div class="empty-state-box">
        <div class="empty-state-icon-wrap">
          ${getIconSvg('search', { size: 48, strokeWidth: 1.8 })}
        </div>
        <div class="empty-state-title">${this.l('Komik Tidak Ditemukan', 'No Comics Found')}</div>
        <div class="empty-state-desc">${this.l('Tidak ada komik yang cocok dengan kata kunci atau filter saat ini.', 'No comics match the current keywords or filters.')}</div>
        <button id="btnResetCatalogSearch" class="empty-state-btn">
          ${getIconSvg('refresh-line', { size: 14 })}
          <span>${this.l('Atur Ulang Pencarian', 'Reset Search')}</span>
        </button>
      </div>
    `;
  } else if (isOffline) {
    emptyStateHtml = `
      <div class="empty-state-box">
        <div class="empty-state-icon-wrap">
          ${getIconSvg('wifi-off', { size: 52 })}
        </div>
        <div class="empty-state-title">${this.l('Ekstensi Sedang Offline', 'Extension Is Offline')}</div>
        <div class="empty-state-desc">${this.l('Sumber komik ini sedang offline atau tidak dapat dijangkau saat ini. Periksa koneksi internet Anda atau coba lagi nanti.', 'This comic source is currently offline or unreachable. Check your internet connection or try again later.')}</div>
        <div style="display: flex; gap: 10px; margin-top: 8px;">
          <button id="btnRetrySourceFeed" class="empty-state-btn primary">
            ${getIconSvg('refresh-line', { size: 14 })}
            <span>${this.l('Coba Lagi', 'Retry')}</span>
          </button>
          <button id="btnOpenSourceWebOffline" class="empty-state-btn" style="background: var(--bg-surface); border: 1px solid var(--border-soft);">
            ${getIconSvg('global-linear', { size: 14 })}
            <span>${this.l('Buka di Browser', 'Open in Browser')}</span>
          </button>
        </div>
      </div>
    `;
  } else {
    emptyStateHtml = `
      <div class="empty-state-box">
        <div class="empty-state-icon-wrap">
          ${getIconSvg('refresh-line', { size: 52 })}
        </div>
        <div class="empty-state-title">${this.l('Gagal Memuat Katalog', 'Failed to Load Catalog')}</div>
        <div class="empty-state-desc">${this.l('Tidak dapat mengambil daftar komik dari sumber ini. Server website mungkin sedang sibuk atau mengalami kendala parsing.', 'Unable to fetch the comic list from this source. The website server may be busy or experiencing parsing issues.')}</div>
        <div style="display: flex; gap: 10px; margin-top: 8px;">
          <button id="btnRetrySourceFeed" class="empty-state-btn primary">
            ${getIconSvg('refresh-line', { size: 14 })}
            <span>${this.l('Coba Lagi', 'Retry')}</span>
          </button>
          <button id="btnOpenSourceWebOffline" class="empty-state-btn" style="background: var(--bg-surface); border: 1px solid var(--border-soft);">
            ${getIconSvg('global-linear', { size: 14 })}
            <span>${this.l('Buka di Browser', 'Open in Browser')}</span>
          </button>
        </div>
      </div>
    `;
  }
  const isMangaDex =
    source.id.toLowerCase().includes('mangadex') ||
    (source.pkg || '').toLowerCase().includes('mangadex') ||
    source.name.toLowerCase().includes('mangadex');
  const curMdLang: 'ID' | 'EN' =
    (this.settings.mangaDexLanguage || 'en').toLowerCase() === 'id' ? 'ID' : 'EN';
  const getMdLangBtnStyle = (isActive: boolean): string =>
    `display:inline-flex;align-items:center;justify-content:center;height:26px;padding:0 7px;border-radius:6px;cursor:pointer;${
      isActive
        ? 'border:1px solid var(--border-strong);background:var(--bg-surface-elevated);opacity:1;'
        : 'border:1px solid transparent;background:transparent;opacity:0.45;'
    }`;
  const mangaDexLangToggleHtml = isMangaDex
    ? `
      <div class="v1-md-lang-switch" role="group" aria-label="MangaDex Language" style="display:inline-flex;align-items:center;gap:3px;padding:2px;height:32px;border-radius:8px;background:var(--bg-surface-alt);border:1px solid var(--border-subtle);">
        <button type="button" class="v1-md-lang-opt ${curMdLang === 'ID' ? 'active' : ''}" data-md-lang="id" style="${getMdLangBtnStyle(curMdLang === 'ID')}" title="${this.l('Tampilkan Komik Bahasa Indonesia (ID)', 'Show Indonesian Comics (ID)')}" aria-label="Indonesia (ID)">
          ${this.buildLangBadgeHtml('ID')}
        </button>
        <button type="button" class="v1-md-lang-opt ${curMdLang === 'EN' ? 'active' : ''}" data-md-lang="en" style="${getMdLangBtnStyle(curMdLang === 'EN')}" title="${this.l('Tampilkan Komik Bahasa Inggris (EN)', 'Show English Comics (EN)')}" aria-label="English (EN)">
          ${this.buildLangBadgeHtml('EN')}
        </button>
      </div>`
    : '';

  container.innerHTML = `
    <div class="v1-source-feed-header">
      <div class="v1-source-feed-left">
        <button id="btnBackToSourcesList" class="v1-back-circle-btn" title="${this.l('Kembali ke Daftar Sumber', 'Back to Source List')}" aria-label="${this.l('Kembali', 'Back')}">
          ${getIconSvg('arrow-left-line', { size: 16 })}
        </button>
        ${this.buildSourceLogoHtml(source, 30)}
        <span class="v1-lib-title-text" style="font-size:18px;">${source.name}</span>
        ${
          !this.isSourceFeedLoading && isOffline
            ? `<span class="v1-status-badge offline" style="margin-left: 6px;" title="${this.l('Status Server: Offline / Tidak Dapat Dijangkau', 'Server Status: Offline / Unreachable')}"><span class="v1-status-dot offline"></span><span>Offline</span></span>`
            : !this.isSourceFeedLoading && source.status === 'warning'
            ? `<span class="v1-status-badge warning" style="margin-left: 6px;" title="${this.l('Status Server: Dilindungi Cloudflare / Butuh Selesaikan Verifikasi', 'Server Status: Cloudflare Protected / Verification Required')}"><span class="v1-status-dot warning"></span><span>Cloudflare</span></span>`
            : ''
        }
      </div>
      <div class="v1-source-feed-right">
        <div class="v1-lib-search-box">
          ${getIconSvg('search-line', { size: 14 })}
          <input id="sourceCatalogSearchInput" type="text" placeholder="${this.l(`Cari di ${escapeXml(source.name)}... (Ctrl+K)`, `Search ${escapeXml(source.name)}... (Ctrl+K)`)}" value="${escapeXml(this.sourceFeedSearchQuery)}" autocomplete="off" />
          ${this.sourceFeedSearchQuery ? `<button id="btnClearSourceSearch" class="v1-search-clear-btn" title="${this.l('Hapus pencarian', 'Clear search')}">${getIconSvg('close-line', { size: 13 })}</button>` : ''}
        </div>
        ${mangaDexLangToggleHtml}
        <div class="v1-source-filter-anchor" style="position: relative;">
          <button id="btnToggleSourceFilter" class="v1-lib-action-btn ${this.isSourceFeedFilterFlyoutOpen ? 'active' : ''} ${hasActiveSourceFilter ? 'has-filter' : ''}" title="${this.l('Filter &amp; Urutkan', 'Filter &amp; Sort')}" aria-label="${this.l('Filter dan Urutkan', 'Filter and Sort')}">
            ${getIconSvg('filter', { size: 18 })}
          </button>
          <div id="sourceFilterFlyout" class="v1-lib-flyout ${this.isSourceFeedFilterFlyoutOpen ? 'open' : ''}" style="width: 280px;">
            <!-- Segmented Tabs (Saring | Genre | Urutkan) -->
            <div class="v1-flyout-tabs">
              <button class="v1-flyout-tab-btn ${this.sourceFeedFlyoutTab === 'filter' ? 'active' : ''}" data-source-flyout-tab="filter" type="button">
                ${(this.sourceFeedStatusFilter !== 'all' || this.sourceFeedTypeFilter !== 'all') ? '<span class="v1-tab-dot"></span>' : ''}
                <span>${this.l('Saring', 'Filter')}</span>
              </button>
              <button class="v1-flyout-tab-btn ${this.sourceFeedFlyoutTab === 'genre' ? 'active' : ''}" data-source-flyout-tab="genre" type="button">
                ${this.sourceFeedGenreFilter !== 'Semua' ? '<span class="v1-tab-dot"></span>' : ''}
                <span>${this.l('Genre', 'Genre')}</span>
              </button>
              <button class="v1-flyout-tab-btn ${this.sourceFeedFlyoutTab === 'sort' ? 'active' : ''}" data-source-flyout-tab="sort" type="button">
                ${this.sourceFeedSort !== 'popular' ? '<span class="v1-tab-dot"></span>' : ''}
                <span>${this.l('Urutkan', 'Sort')}</span>
              </button>
            </div>
            <!-- Tab Content -->
            <div class="v1-flyout-tab-content">
              ${
                this.sourceFeedFlyoutTab === 'filter'
                  ? `
                    <div class="v1-flyout-section-label">${this.l('Status Komik', 'Comic Status')}</div>
                    <button class="v1-lib-flyout-item ${this.sourceFeedStatusFilter === 'all' ? 'selected' : ''}" data-source-status="all" type="button">
                      <span class="v1-lib-flyout-check">${this.sourceFeedStatusFilter === 'all' ? checkSvg : ''}</span>
                      <span>${this.l('Semua Status', 'All Statuses')}</span>
                    </button>
                    <button class="v1-lib-flyout-item ${this.sourceFeedStatusFilter === 'Ongoing' ? 'selected' : ''}" data-source-status="Ongoing" type="button">
                      <span class="v1-lib-flyout-check">${this.sourceFeedStatusFilter === 'Ongoing' ? checkSvg : ''}</span>
                      <span>${this.l('Sedang Berjalan (Ongoing)', 'Ongoing')}</span>
                    </button>
                    <button class="v1-lib-flyout-item ${this.sourceFeedStatusFilter === 'Completed' ? 'selected' : ''}" data-source-status="Completed" type="button">
                      <span class="v1-lib-flyout-check">${this.sourceFeedStatusFilter === 'Completed' ? checkSvg : ''}</span>
                      <span>${this.l('Tamat (Completed)', 'Completed')}</span>
                    </button>
                    <div class="v1-lib-flyout-divider"></div>
                    <div class="v1-flyout-section-label">${this.l('Tipe Komik', 'Comic Type')}</div>
                    <button class="v1-lib-flyout-item ${this.sourceFeedTypeFilter === 'all' ? 'selected' : ''}" data-source-type="all" type="button">
                      <span class="v1-lib-flyout-check">${this.sourceFeedTypeFilter === 'all' ? checkSvg : ''}</span>
                      <span>${this.l('Semua Tipe', 'All Types')}</span>
                    </button>
                    <button class="v1-lib-flyout-item ${this.sourceFeedTypeFilter === 'Manhwa' ? 'selected' : ''}" data-source-type="Manhwa" type="button">
                      <span class="v1-lib-flyout-check">${this.sourceFeedTypeFilter === 'Manhwa' ? checkSvg : ''}</span>
                      <span>${this.l('Manhwa (Korea)', 'Manhwa (Korean)')}</span>
                    </button>
                    <button class="v1-lib-flyout-item ${this.sourceFeedTypeFilter === 'Manga' ? 'selected' : ''}" data-source-type="Manga" type="button">
                      <span class="v1-lib-flyout-check">${this.sourceFeedTypeFilter === 'Manga' ? checkSvg : ''}</span>
                      <span>${this.l('Manga (Jepang)', 'Manga (Japanese)')}</span>
                    </button>
                    <button class="v1-lib-flyout-item ${this.sourceFeedTypeFilter === 'Manhua' ? 'selected' : ''}" data-source-type="Manhua" type="button">
                      <span class="v1-lib-flyout-check">${this.sourceFeedTypeFilter === 'Manhua' ? checkSvg : ''}</span>
                      <span>${this.l('Manhua (China)', 'Manhua (Chinese)')}</span>
                    </button>
                  `
                  : ''
              }
              ${
                this.sourceFeedFlyoutTab === 'genre'
                  ? `
                    <div class="v1-flyout-genre-wrap">
                      <button class="v1-flyout-genre-chip ${this.sourceFeedGenreFilter === 'Semua' ? 'active' : ''}" data-source-genre="Semua" type="button">
                        ${this.l('Semua Genre', 'All Genres')}
                      </button>
                      ${genres
                        .filter((g) => g !== 'Semua')
                        .map(
                          (g) => `
                        <button class="v1-flyout-genre-chip ${this.sourceFeedGenreFilter === g ? 'active' : ''}" data-source-genre="${escapeXml(g)}" type="button">
                          ${escapeXml(g)}
                        </button>`
                        )
                        .join('')}
                    </div>
                  `
                  : ''
              }
              ${
                this.sourceFeedFlyoutTab === 'sort'
                  ? `
                    <div class="v1-flyout-section-label">${this.l('Urutkan Komik', 'Sort Comics')}</div>
                    <button class="v1-lib-flyout-item ${this.sourceFeedSort === 'popular' ? 'selected' : ''}" data-source-sort="popular" type="button">
                      <span class="v1-lib-flyout-check">${this.sourceFeedSort === 'popular' ? checkSvg : ''}</span>
                      <span>${this.l('Populer', 'Popular')}</span>
                    </button>
                    <button class="v1-lib-flyout-item ${this.sourceFeedSort === 'latest' ? 'selected' : ''}" data-source-sort="latest" type="button">
                      <span class="v1-lib-flyout-check">${this.sourceFeedSort === 'latest' ? checkSvg : ''}</span>
                      <span>${this.l('Terbaru', 'Latest')}</span>
                    </button>
                  `
                  : ''
              }
            </div>
            ${
              hasActiveSourceFilter
                ? `
                  <div class="v1-lib-flyout-divider"></div>
                  <button id="btnResetSourceFilter" class="v1-lib-flyout-reset-btn" type="button" title="${this.l('Kembalikan semua filter ke pengaturan awal', 'Reset all filters to default')}">
                    ${getIconSvg('refresh-line', { size: 13 })}
                    <span>${this.l('Atur Ulang Filter', 'Reset Filters')}</span>
                  </button>
                `
                : ''
            }
          </div>
        </div>
        <button id="btnRefreshSourceFeed" class="v1-lib-action-btn" title="${this.l(`Segarkan Feed & Daftar Komik (${escapeXml(source.name)})`, `Refresh Feed & Comics (${escapeXml(source.name)})`)}" aria-label="${this.l('Segarkan Feed', 'Refresh Feed')}">
          ${getIconSvg('refresh-line', { size: 18 })}
        </button>
        ${
          source.isCloudflareProtected || source.status === 'warning'
            ? `<button id="btnVerifySourceFeedCf" class="v1-lib-action-btn shield" title="${this.l(`Verifikasi Cloudflare FlareSolverr (${escapeXml(source.name)})`, `Verify Cloudflare FlareSolverr (${escapeXml(source.name)})`)}" aria-label="${this.l('Verifikasi Cloudflare FlareSolverr', 'Verify Cloudflare FlareSolverr')}">
                 ${getIconSvg('shield-check-line', { size: 17 })}
               </button>`
            : ''
        }
        <button id="btnOpenSourceExternal" class="v1-lib-action-btn" title="${this.l(`Buka ${escapeXml(source.baseUrl)} di Browser`, `Open ${escapeXml(source.baseUrl)} in Browser`)}" aria-label="${this.l('Buka di Browser', 'Open in Browser')}">
          ${getIconSvg('global-linear', { size: 17 })}
        </button>
      </div>
    </div>
    ${
      feedManga.length > 0
        ? `<div class="manga-grid">
            ${feedManga
              .map((m) => {
                const fallbackSvg = buildMangaCoverSvg(m);
                const coverSrc = this.getMangaCoverHtmlSrc(m);
                const bookmarkCornerHtml = m.inLibrary
                  ? `<div class="v1-manga-bookmark-corner" title="${this.l('Tersimpan di Pustaka', 'Saved in Library')}">${getIconSvg('bookmark-bold', { size: 12, color: '#ffffff' })}</div>`
                  : '';
                return `
                  <article class="manga-card" data-open-detail="${escapeXml(m.id)}">
                    <div class="manga-cover-wrap">
                      <img class="manga-cover-img" src="${coverSrc}" alt="${escapeXml(m.title)}" loading="lazy" onerror="this.onerror=null;this.src='${fallbackSvg}';" />
                      ${bookmarkCornerHtml}
                    </div>
                    <div class="manga-card-body">
                      <div class="manga-card-title" title="${escapeXml(m.title)}">${escapeXml(m.title)}</div>
                    </div>
                  </article>`;
              })
              .join('')}
          </div>
          ${
            this.bridge.isWebViewHost && this.sourceFeedHasMore
              ? `<div id="sourceFeedLoadingSentinel" style="display:flex;justify-content:center;align-items:center;gap:8px;padding:24px 0 16px 0;color:var(--ink-muted);font-size:12.5px;">
                   ${
                     this.isSourceFeedLoading
                       ? `<span style="display:inline-block;width:16px;height:16px;border:2px solid var(--border-strong);border-top-color:var(--ocean-primary);border-radius:50%;animation:spin 0.8s linear infinite;"></span>
                          <span>${this.l('Memuat lebih banyak komik...', 'Loading more comics...')}</span>`
                       : `<span style="opacity:0.4;">${this.l('Memuat otomatis saat scroll ke bawah', 'Auto-loads as you scroll down')}</span>`
                   }
                 </div>`
              : feedManga.length > 0
              ? `<div style="display:flex;justify-content:center;align-items:center;padding:24px 0 16px 0;color:var(--ink-muted);font-size:12.5px;opacity:0.6;">
                   <span>${this.l('Akhir dari katalog komik', 'End of comic catalog')}</span>
                 </div>`
              : ''
          }`
        : emptyStateHtml
    }
  `;
  document.getElementById('btnBackToSourcesList')?.addEventListener('click', () => {
    container.onscroll = null;
    this.activeBrowseSourceId = null;
    this.browseSearchQuery = '';
    this.sourceFeedSearchQuery = '';
    this.isSourceFeedFilterFlyoutOpen = false;
    this.renderBrowseView(container, true);
  });
  container.querySelectorAll<HTMLButtonElement>('[data-md-lang]').forEach((btn) => {
    btn.addEventListener('click', (ev) => {
      ev.stopPropagation();
      const clickedLang = (btn.dataset.mdLang === 'id' ? 'id' : 'en') as 'id' | 'en';
      const currentLang = (this.settings.mangaDexLanguage || 'en').toLowerCase() === 'id' ? 'id' : 'en';
      const nextLang: 'id' | 'en' = clickedLang === currentLang ? (currentLang === 'id' ? 'en' : 'id') : clickedLang;
      this.settings.mangaDexLanguage = nextLang;
      this.persistLocalCache();
      this.chapterPagesCache.clear();
      this.sourceFeedItems = [];
      this.isSourceFeedLoading = true;
      this.renderSourceCatalogFeed(container, source, false);

      if (this.bridge.isWebViewHost) {
        void this.bridge.invoke('settings:update', { key: 'mangaDexLanguage', value: nextLang }).catch(() => {});
      }
      this.showToast(
        nextLang === 'id'
          ? this.l('Bahasa MangaDex diubah ke Bahasa Indonesia (ID).', 'MangaDex language switched to Indonesian (ID).')
          : this.l('Bahasa MangaDex diubah ke Bahasa Inggris (EN).', 'MangaDex language switched to English (EN).')
      );
      if (this.bridge.isWebViewHost) {
        void this.fetchSourceCatalogFeed(source, true);
      } else {
        this.isSourceFeedLoading = false;
        this.renderSourceCatalogFeed(container, source, false);
      }
    });
  });
  document.getElementById('btnRefreshSourceFeed')?.addEventListener('click', () => {
    if (this.isSourceFeedLoading) return;
    this.showToast(this.l(`Menyegarkan katalog ${source.name}...`, `Refreshing ${source.name} catalog...`));
    void this.fetchSourceCatalogFeed(source, true);
  });
  document.getElementById('btnOpenSourceExternal')?.addEventListener('click', () => {
    this.bridge.openExternalUrl(source.baseUrl);
    this.showToast(this.l(`Membuka ${source.baseUrl} di browser...`, `Opening ${source.baseUrl} in browser...`));
  });
  document.getElementById('btnVerifySourceFeedCf')?.addEventListener('click', (ev) => {
    ev.stopPropagation();
    const btn = document.getElementById('btnVerifySourceFeedCf') as HTMLButtonElement | null;
    if (!btn) return;
    btn.disabled = true;
    btn.classList.add('loading');
    btn.innerHTML = '<div class="v1-lib-action-btn-spinner" style="width:15px;height:15px;border-width:1.5px;"></div>';
    if (this.bridge.isWebViewHost && source.sourceId !== undefined) {
      this.showToast(this.l(`Memverifikasi proteksi Cloudflare untuk ${source.name}...`, `Verifying Cloudflare protection for ${source.name}...`));
      void this.bridge
        .invoke<{ verified: boolean }>('ext:verify-cloudflare', { sourceId: source.sourceId, id: source.id, baseUrl: source.baseUrl }, 90000)
        .then((res) => {
          btn.disabled = false;
          btn.classList.remove('loading');
          btn.innerHTML = getIconSvg('shield-check-line', { size: 17 });
          if (res?.verified) {
            source.status = 'online';
            this.showToast(this.l(`Sesi Cloudflare untuk ${source.name} berhasil diverifikasi. Menyegarkan katalog...`, `Cloudflare session for ${source.name} verified. Refreshing catalog...`));
            void this.fetchSourceCatalogFeed(source, true);
          } else {
            this.showToast(this.l(`Verifikasi Cloudflare untuk ${source.name} belum selesai.`, `Cloudflare verification for ${source.name} is not finished.`));
          }
        })
        .catch(() => {
          btn.disabled = false;
          btn.classList.remove('loading');
          btn.innerHTML = getIconSvg('shield-check-line', { size: 17 });
          this.showToast(this.l(`Gagal memverifikasi Cloudflare untuk ${source.name}.`, `Failed to verify Cloudflare for ${source.name}.`));
        });
      return;
    }
    source.status = 'online';
    btn.disabled = false;
    btn.classList.remove('loading');
    btn.innerHTML = getIconSvg('shield-check-line', { size: 17 });
    this.showToast(this.l(`Sesi Cloudflare untuk ${source.name} berhasil diverifikasi.`, `Cloudflare session for ${source.name} verified.`));
  });
  document.getElementById('btnRetrySourceFeed')?.addEventListener('click', () => {
    if (this.isSourceFeedLoading) return;
    this.showToast(this.l(`Menyegarkan katalog ${source.name}...`, `Refreshing ${source.name} catalog...`));
    if (this.bridge.isWebViewHost) {
      void this.fetchSourceCatalogFeed(source, true);
    } else {
      this.renderSourceCatalogFeed(container, source);
    }
  });
  document.getElementById('btnOpenSourceWebOffline')?.addEventListener('click', () => {
    this.bridge.openExternalUrl(source.baseUrl);
    this.showToast(this.l(`Membuka ${source.name} (${source.baseUrl}) di browser...`, `Opening ${source.name} (${source.baseUrl}) in browser...`));
  });
  document.getElementById('btnResetCatalogSearch')?.addEventListener('click', (ev) => {
    ev.stopPropagation();
    this.sourceFeedSearchQuery = '';
    this.sourceFeedSort = 'popular';
    this.sourceFeedStatusFilter = 'all';
    this.sourceFeedTypeFilter = 'all';
    this.sourceFeedGenreFilter = 'Semua';
    if (this.bridge.isWebViewHost) {
      void this.fetchSourceCatalogFeed(source, true);
    } else {
      this.renderSourceCatalogFeed(container, source);
    }
  });

  // Inline Search Input (Source Catalog)
  const sourceSearchInput = document.getElementById('sourceCatalogSearchInput') as HTMLInputElement | null;
  let sourceSearchTimeout: number | undefined;

  const triggerSourceSearch = () => {
    window.clearTimeout(sourceSearchTimeout);
    const val = (sourceSearchInput?.value ?? '').trim();
    if (this.sourceFeedSearchQuery === val) return;
    this.sourceFeedSearchQuery = val;
    this.sourceFeedPage = 1;
    if (this.bridge.isWebViewHost) {
      void this.fetchSourceCatalogFeed(source, true);
    } else {
      this.renderSourceCatalogFeed(container, source);
    }
  };

  sourceSearchInput?.addEventListener('keydown', (ev) => {
    if (ev.key === 'Enter') {
      ev.preventDefault();
      triggerSourceSearch();
    }
  });

  sourceSearchInput?.addEventListener('input', () => {
    window.clearTimeout(sourceSearchTimeout);
    const val = (sourceSearchInput?.value ?? '').trim();
    if (val === '' && this.sourceFeedSearchQuery !== '') {
      triggerSourceSearch();
      return;
    }
    // Debounce for 600ms on typing without destroying grid
    sourceSearchTimeout = window.setTimeout(() => {
      triggerSourceSearch();
    }, 600);
  });

  document.getElementById('btnClearSourceSearch')?.addEventListener('click', (ev) => {
    ev.stopPropagation();
    this.sourceFeedSearchQuery = '';
    this.sourceFeedPage = 1;
    if (sourceSearchInput) sourceSearchInput.value = '';
    if (this.bridge.isWebViewHost) {
      void this.fetchSourceCatalogFeed(source, true);
    } else {
      this.renderSourceCatalogFeed(container, source);
    }
    const nextInput = document.getElementById('sourceCatalogSearchInput') as HTMLInputElement | null;
    nextInput?.focus();
  });

  // Filter Flyout Toggle
  document.getElementById('btnToggleSourceFilter')?.addEventListener('click', (ev) => {
    ev.stopPropagation();
    this.isSourceFeedFilterFlyoutOpen = !this.isSourceFeedFilterFlyoutOpen;
    this.renderSourceCatalogFeed(container, source, true);
  });

  // Stop clicks inside flyout from closing it
  document.getElementById('sourceFilterFlyout')?.addEventListener('click', (ev) => {
    ev.stopPropagation();
  });

  // Close flyout on click outside
  if (this.isSourceFeedFilterFlyoutOpen) {
    const onOutsideClick = (ev: MouseEvent) => {
      const flyout = document.getElementById('sourceFilterFlyout');
      const toggleBtn = document.getElementById('btnToggleSourceFilter');
      if (flyout && toggleBtn && !flyout.contains(ev.target as Node) && !toggleBtn.contains(ev.target as Node)) {
        this.isSourceFeedFilterFlyoutOpen = false;
        document.removeEventListener('click', onOutsideClick);
        this.renderSourceCatalogFeed(container, source, true);
      }
    };
    window.setTimeout(() => {
      document.addEventListener('click', onOutsideClick);
    }, 10);
  }

  // Segmented Tabs Switch inside Flyout
  container.querySelectorAll<HTMLButtonElement>('[data-source-flyout-tab]').forEach((btn) => {
    btn.addEventListener('click', (ev) => {
      ev.stopPropagation();
      this.sourceFeedFlyoutTab = (btn.dataset.sourceFlyoutTab as 'filter' | 'genre' | 'sort') || 'filter';
      this.renderSourceCatalogFeed(container, source, true);
    });
  });

  // Filter Flyout Item Clicks
  container.querySelectorAll<HTMLButtonElement>('[data-source-sort]').forEach((btn) => {
    btn.addEventListener('click', (ev) => {
      ev.stopPropagation();
      const val = (btn.dataset.sourceSort as 'popular' | 'latest') || 'popular';
      if (this.sourceFeedSort === val) return;
      this.sourceFeedSort = val;
      this.sourceFeedPage = 1;
      if (this.bridge.isWebViewHost) {
        void this.fetchSourceCatalogFeed(source, true);
      } else {
        this.renderSourceCatalogFeed(container, source, true);
      }
    });
  });

  container.querySelectorAll<HTMLButtonElement>('[data-source-status]').forEach((btn) => {
    btn.addEventListener('click', (ev) => {
      ev.stopPropagation();
      const val = (btn.dataset.sourceStatus as 'all' | 'Ongoing' | 'Completed') || 'all';
      if (this.sourceFeedStatusFilter === val) return;
      this.sourceFeedStatusFilter = val;
      this.sourceFeedPage = 1;
      if (this.bridge.isWebViewHost) {
        void this.fetchSourceCatalogFeed(source, true);
      } else {
        this.renderSourceCatalogFeed(container, source, true);
      }
    });
  });

  container.querySelectorAll<HTMLButtonElement>('[data-source-type]').forEach((btn) => {
    btn.addEventListener('click', (ev) => {
      ev.stopPropagation();
      const val = (btn.dataset.sourceType as 'all' | 'Manhwa' | 'Manga' | 'Manhua') || 'all';
      if (this.sourceFeedTypeFilter === val) return;
      this.sourceFeedTypeFilter = val;
      this.sourceFeedPage = 1;
      if (this.bridge.isWebViewHost) {
        void this.fetchSourceCatalogFeed(source, true);
      } else {
        this.renderSourceCatalogFeed(container, source, true);
      }
    });
  });

  container.querySelectorAll<HTMLButtonElement>('[data-source-genre]').forEach((btn) => {
    btn.addEventListener('click', (ev) => {
      ev.stopPropagation();
      const val = btn.dataset.sourceGenre || 'Semua';
      if (this.sourceFeedGenreFilter === val) return;
      this.sourceFeedGenreFilter = val;
      this.sourceFeedPage = 1;
      if (this.bridge.isWebViewHost) {
        void this.fetchSourceCatalogFeed(source, true);
      } else {
        this.renderSourceCatalogFeed(container, source, true);
      }
    });
  });

  const resetSourceFilterFn = (ev: Event) => {
    ev.stopPropagation();
    this.sourceFeedSort = 'popular';
    this.sourceFeedStatusFilter = 'all';
    this.sourceFeedTypeFilter = 'all';
    this.sourceFeedGenreFilter = 'Semua';
    this.sourceFeedPage = 1;
    if (this.bridge.isWebViewHost) {
      void this.fetchSourceCatalogFeed(source, true);
    } else {
      this.renderSourceCatalogFeed(container, source, true);
    }
  };
  document.getElementById('btnResetSourceFilter')?.addEventListener('click', resetSourceFilterFn);

  // Infinite Scroll: Auto-load next page on scroll down
  if (this.bridge.isWebViewHost && this.sourceFeedHasMore) {
    const triggerLoadMore = () => {
      if (this.isSourceFeedLoading || !this.sourceFeedHasMore || this.isRestoringWorkspaceScroll) return;
      const scrollBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
      if (scrollBottom <= 400) {
        this.sourceFeedPage += 1;
        void this.fetchSourceCatalogFeed(source, false);
      }
    };
    container.onscroll = () => {
      triggerLoadMore();
    };
    const sentinel = document.getElementById('sourceFeedLoadingSentinel');
    if (sentinel && 'IntersectionObserver' in window) {
      const observer = new IntersectionObserver(
        (entries) => {
          if (entries.some((entry) => entry.isIntersecting)) {
            triggerLoadMore();
          }
        },
        { root: container, rootMargin: '300px' }
      );
      observer.observe(sentinel);
    }
  } else {
    container.onscroll = null;
  }
  if (preserveScroll) {
    const targetY = this.viewScrollPositions.get(`browse_source_${source.id}`) ?? 0;
    if (targetY > 0) {
      this.isRestoringWorkspaceScroll = true;
      container.style.scrollBehavior = 'auto';
      container.scrollTop = targetY;
      container.scrollTo({ top: targetY, behavior: 'instant' });
      requestAnimationFrame(() => {
        container.scrollTop = targetY;
        requestAnimationFrame(() => {
          if (container.scrollTop !== targetY) {
            container.scrollTop = targetY;
          }
          this.isRestoringWorkspaceScroll = false;
        });
      });
    }
  }
  this.bindCommonCardTriggers(container);
}
