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
  ReadingStatisticsPayload,
  GenreStatItem,
  DailyActivityStatItem,
  SettingsSubTab,
  SourceFeedResult
} from '../types.js';

/* =========================================================================
 * 2. UPDATES & HISTORY VIEWS (MINIMALIST YOMIC V1 MIRROR)
 * ========================================================================= */

export function renderUpdatesView(this: YomicApp, container: HTMLElement): void {
  this.setTopbarHeader(this.t('updates.title'));

  // Group updates by relative date calendar buckets ("Hari Ini", "Kemarin", "Sebelumnya")
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfYesterday = startOfToday - 86400000;

  const todayUpdates: ActivityUpdateItem[] = [];
  const yesterdayUpdates: ActivityUpdateItem[] = [];
  const olderUpdates: ActivityUpdateItem[] = [];

  for (const u of this.activityUpdates) {
    const fetchMs = u.dateFetch && u.dateFetch > 0 ? u.dateFetch : 0;
    if (fetchMs >= startOfToday) {
      todayUpdates.push(u);
    } else if (fetchMs >= startOfYesterday) {
      yesterdayUpdates.push(u);
    } else {
      olderUpdates.push(u);
    }
  }

  const groups: Array<{ header: string; items: ActivityUpdateItem[] }> = [];
  if (todayUpdates.length > 0) groups.push({ header: 'Hari Ini', items: todayUpdates });
  if (yesterdayUpdates.length > 0) groups.push({ header: 'Kemarin', items: yesterdayUpdates });
  if (olderUpdates.length > 0) groups.push({ header: 'Sebelumnya', items: olderUpdates });

  let bodyHtml = '';

  if (this.syncProgress.active) {
    bodyHtml = `
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
          <div class="empty-state-progress-fill" style="width: ${Math.round((this.syncProgress.current / Math.max(1, this.syncProgress.total)) * 100)}%; height: 100%; background: var(--ocean-primary); border-radius: 2px; transition: width 0.25s ease;"></div>
        </div>
      </div>
    `;
  } else if (this.activityUpdates.length === 0) {
    bodyHtml = `
      <div class="empty-state-box">
        <div class="empty-state-icon-wrap">
          ${getIconSvg('refresh-line', { size: 48 })}
        </div>
        <div class="empty-state-title">${this.t('updates.emptyTitle')}</div>
        <div class="empty-state-desc">${this.t('updates.emptyDesc')}</div>
        <button id="btnCheckUpdatesNow" class="empty-state-btn primary">${this.t('updates.syncNow')}</button>
      </div>`;
  } else {
    const syncBarHtml = '';

    const listHtml = groups
      .map(
        (grp) => `
        <div class="v1-group-section">
          <div class="v1-group-header">
            <span>${grp.header}</span>
          </div>
          <div class="v1-updates-list">
            ${grp.items
              .map((u) => {
                const manga = this.mangaList.find((m) => m.id === u.mangaId);
                const fallbackSvg = manga
                  ? buildMangaCoverSvg(manga)
                  : buildMangaCoverSvg({ title: u.mangaTitle, sourceName: u.sourceName } as MangaItem);
                const thumb = u.coverUrl || (manga ? this.getMangaCoverHtmlSrc(manga) : '');
                const isRead = !u.isNew;
                const extraChCount = u.extraChaptersCount ?? 0;
                const playChNum = u.firstUnreadChapterNumber !== undefined && u.firstUnreadChapterNumber > 0 ? u.firstUnreadChapterNumber : u.chapterNumber;
                return `
                  <div class="v1-update-row ${isRead ? 'is-read' : ''}">
                    <div class="v1-update-left" data-open-detail="${u.mangaId}">
                      <img class="v1-update-cover" src="${thumb}" alt="${escapeXml(u.mangaTitle)}" loading="lazy" onerror="this.onerror=null;this.src='${fallbackSvg}';" />
                      <div class="v1-update-info">
                        <div class="v1-update-title" title="${escapeXml(u.mangaTitle)}">${u.mangaTitle}</div>
                        <div class="v1-update-ch-line">
                          <span class="v1-update-ch-num tabular-nums">Ch. ${playChNum}</span>
                          ${u.chapterTitle ? `<span class="v1-update-ch-sep">·</span><span class="v1-update-ch-title">${u.chapterTitle}</span>` : ''}
                          ${extraChCount > 0 ? `<span class="v1-update-extra-inline tabular-nums">(+${extraChCount} ${this.l('bab', 'ch.')})</span>` : ''}
                        </div>
                      </div>
                    </div>
                    <div class="v1-update-right">
                      <span class="v1-update-time tabular-nums">${u.timeAgo}</span>
                      <button class="v1-update-action-btn ${isRead ? 'ghost' : 'primary'}" data-quick-read="${u.mangaId}" data-ch="${playChNum}" title="${isRead ? this.l('Baca Ulang Chapter ' + playChNum, 'Re-read Chapter ' + playChNum) : this.l('Baca Chapter ' + playChNum, 'Read Chapter ' + playChNum)}">
                        ${getIconSvg('play-linear', { size: 13 })}
                        <span>${this.t('common.read')}</span>
                      </button>
                    </div>
                  </div>`;
              })
              .join('')}
          </div>
        </div>`
      )
      .join('');

    bodyHtml = `${syncBarHtml}${listHtml}`;
  }

  container.innerHTML = `
    <div class="v1-updates-container">
      <div class="v1-page-header">
        <div class="v1-page-header-bar">
          <div class="v1-page-header-left">
            ${getIconSvg('refresh-line', { size: 24 })}
            <span class="v1-lib-title-text">${this.t('updates.title')}</span>
            <span class="v1-lib-count-inline tabular-nums">(${this.activityUpdates.length})</span>
          </div>
          ${
            this.activityUpdates.length > 0
              ? `<div class="v1-lib-actions">
            <button id="btnClearAllUpdates" class="v1-lib-action-btn" title="${this.l('Bersihkan Daftar Pembaruan', 'Clear Updates List')}" aria-label="${this.l('Bersihkan Daftar Pembaruan', 'Clear Updates List')}">
              ${getIconSvg('delete-bin-line', { size: 18 })}
            </button>
            <button id="btnRefreshUpdates" class="v1-lib-action-btn ${this.syncProgress.active ? 'loading' : ''}" title="${this.syncProgress.active ? this.l('Sedang Memeriksa...', 'Checking...') : this.l('Periksa Pembaruan', 'Check for Updates')}" aria-label="${this.l('Periksa Pembaruan', 'Check for Updates')}" ${this.syncProgress.active ? 'disabled' : ''}>
              ${this.syncProgress.active ? '<div class="v1-lib-action-btn-spinner"></div>' : getIconSvg('refresh-line', { size: 18 })}
            </button>
          </div>`
              : ''
          }
        </div>
      </div>
      ${bodyHtml}
    </div>
  `;
  document.getElementById('btnClearAllUpdates')?.addEventListener('click', () => {
    this.activityUpdates.length = 0;
    if (this.bridge.isWebViewHost) {
      void this.bridge.invoke('updates:clear-all');
    }
    this.renderUpdatesView(container);
    this.showToast(this.l('Daftar pembaruan telah dibersihkan.', 'Updates list cleared.'));
  });
  const refreshFn = (): void => {
    void this.triggerLibrarySyncProgress(true);
  };
  document.getElementById('btnRefreshUpdates')?.addEventListener('click', refreshFn);
  document.getElementById('btnCheckUpdatesNow')?.addEventListener('click', refreshFn);
  this.bindCommonCardTriggers(container);
}

function formatHistoryReadingProgress(page?: number, totalPages?: number): string {
  if (!page || page <= 0) return '';
  let curPage = page;
  if (curPage > 1000) {
    if (totalPages && totalPages > 0) {
      curPage = Math.min(totalPages, Math.max(1, Math.ceil((curPage / 1_000_000.0) * totalPages)));
    } else {
      const pct = Math.min(100, Math.max(1, Math.round(curPage / 10_000.0)));
      return `${pct}%`;
    }
  }
  if (totalPages && totalPages > 0) {
    return `Hal. ${Math.min(curPage, totalPages)}/${totalPages}`;
  }
  return `Hal. ${curPage}`;
}

export function renderHistoryView(this: YomicApp, container: HTMLElement): void {
  this.setTopbarHeader(this.t('nav.history'));
  const historyItems = this.mangaList
    .filter(
      (m) =>
        !this.removedHistoryIds.has(m.id) &&
        ((m.lastViewedEpoch && m.lastViewedEpoch > 0) ||
          (m.lastReadTimeAgo && m.lastReadTimeAgo !== 'Belum dibaca'))
    )
    .sort((a, b) => (b.lastViewedEpoch ?? 0) - (a.lastViewedEpoch ?? 0));
  const toggleViewIconPath = this.historyViewMode === 'grid' ? SOLAR_PATHS['list'] : SOLAR_PATHS['layout-grid'];
  let contentHtml = '';
  if (historyItems.length === 0) {
    contentHtml = `
      <div class="empty-state-box">
        <div class="empty-state-icon-wrap">
          ${getIconSvg('history-line', { size: 48 })}
        </div>
        <div class="empty-state-title">${this.l('Belum Ada Riwayat Baca', 'No Reading History Yet')}</div>
        <div class="empty-state-desc">${this.l('Komik yang baru saja Anda baca akan otomatis tercatat di halaman ini.', 'Comics you recently read will automatically appear here.')}</div>
      </div>
    `;
  } else if (this.historyViewMode === 'grid') {
    contentHtml = `
      <div class="manga-grid">
        ${historyItems
          .map((m) => {
            const fallbackSvg = buildMangaCoverSvg(m);
            const coverSrc = this.getMangaCoverHtmlSrc(m);
            const pageStr = formatHistoryReadingProgress(m.lastReadPage, m.lastReadTotalPages);
            const chMeta = pageStr ? `Ch. ${m.lastReadChapter} (${pageStr})` : `Ch. ${m.lastReadChapter}`;
            return `
              <article class="manga-card" data-open-detail="${m.id}">
                <div class="manga-cover-wrap">
                  <img class="manga-cover-img" src="${coverSrc}" alt="${escapeXml(m.title)}" loading="lazy" onerror="this.onerror=null;this.src='${fallbackSvg}';" />
                </div>
                <div class="manga-card-body">
                  <div class="manga-card-title" title="${escapeXml(m.title)}">${escapeXml(m.title)}</div>
                  <div class="manga-card-meta">
                    <span class="tabular-nums">${chMeta}</span>
                    <span class="manga-card-sep">·</span>
                    <span class="manga-card-time">${escapeXml(m.lastReadTimeAgo || '')}</span>
                  </div>
                </div>
              </article>`;
          })
          .join('')}
      </div>
    `;
  } else {
    // Flat Timeline List Grouped Chronologically by calendar buckets
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const startOfYesterday = startOfToday - 86400000;

    const todayItems: MangaItem[] = [];
    const yesterdayItems: MangaItem[] = [];
    const earlierItems: MangaItem[] = [];

    for (const m of historyItems) {
      const epoch = m.lastViewedEpoch ?? 0;
      if (epoch >= startOfToday) {
        todayItems.push(m);
      } else if (epoch >= startOfYesterday) {
        yesterdayItems.push(m);
      } else {
        earlierItems.push(m);
      }
    }

    const groups: Array<{ header: string; items: MangaItem[] }> = [];
    if (todayItems.length > 0) groups.push({ header: this.l('Hari Ini', 'Today'), items: todayItems });
    if (yesterdayItems.length > 0) groups.push({ header: this.l('Kemarin', 'Yesterday'), items: yesterdayItems });
    if (earlierItems.length > 0) groups.push({ header: this.l('Sebelumnya', 'Earlier'), items: earlierItems });
    contentHtml = `
      <div class="v1-updates-container">
        ${groups
          .map(
            (grp) => `
          <div class="v1-group-section">
            <div class="v1-group-header">
              <span class="v1-group-title">${grp.header}</span>
              <span class="v1-group-count tabular-nums">(${grp.items.length})</span>
              <div class="v1-group-divider"></div>
            </div>
            <div class="v1-updates-list">
              ${grp.items
                .map((m) => {
                  const fallbackSvg = buildMangaCoverSvg(m);
                  const coverSrc = this.getMangaCoverHtmlSrc(m);
                  const pageStr = formatHistoryReadingProgress(m.lastReadPage, m.lastReadTotalPages);
                  return `
                    <div class="v1-update-row">
                      <div class="v1-update-left" data-open-detail="${m.id}">
                        <img class="v1-update-cover" src="${coverSrc}" alt="${escapeXml(m.title)}" loading="lazy" onerror="this.onerror=null;this.src='${fallbackSvg}';" />
                        <div class="v1-update-info">
                          <div class="v1-update-title" title="${escapeXml(m.title)}">${escapeXml(m.title)}</div>
                          <div class="v1-update-ch-line">
                            ${this.buildSourceFaviconHtml(m.sourceName, m.sourceId, 13)}
                            ${m.sourceName ? `<span class="v1-update-source-name">${escapeXml(m.sourceName)}</span><span class="v1-update-ch-sep">·</span>` : ''}
                            <span class="v1-update-ch-num tabular-nums">Ch. ${m.lastReadChapter}</span>
                            ${pageStr ? `<span class="v1-update-ch-sep">·</span><span class="v1-update-ch-title tabular-nums">${pageStr}</span>` : ''}
                          </div>
                        </div>
                      </div>
                      <div class="v1-update-right">
                        <span class="v1-update-time tabular-nums">${escapeXml(m.lastReadTimeAgo || '')}</span>
                        <button class="v1-history-play-btn" data-quick-read="${m.id}" data-ch="${m.lastReadChapter}" title="${escapeXml(this.l('Lanjutkan Membaca Ch. ' + m.lastReadChapter, 'Continue Reading Ch. ' + m.lastReadChapter))}" aria-label="${escapeXml(this.l('Lanjutkan Membaca', 'Continue Reading'))}">
                          ${getIconSvg('play-linear', { size: 16 })}
                        </button>
                        <button class="v1-history-del-btn" data-del-history="${m.id}" title="${escapeXml(this.l('Hapus dari Riwayat', 'Remove from History'))}" aria-label="${escapeXml(this.l('Hapus dari Riwayat', 'Remove from History'))}">
                          ${getIconSvg('delete-bin-line', { size: 15 })}
                        </button>
                      </div>
                    </div>`;
                })
                .join('')}
            </div>
          </div>`
          )
          .join('')}
      </div>
    `;
  }
  container.innerHTML = `
    <div class="v1-page-header">
      <div class="v1-page-header-bar">
        <div class="v1-page-header-left">
          ${getIconSvg('history-line', { size: 24 })}
          <span class="v1-lib-title-text">${this.t('nav.history')}</span>
          <span class="v1-lib-count-inline tabular-nums">(${historyItems.length})</span>
        </div>
        ${
          historyItems.length > 0
            ? `<div class="v1-lib-actions">
          <button id="btnOpenStatsFromHistory" class="v1-lib-action-btn" title="${this.l('Statistik Membaca', 'Reading Statistics')}" aria-label="${this.l('Statistik Membaca', 'Reading Statistics')}">
            ${getIconSvg('chart-2-linear', { size: 19 })}
          </button>
          <button id="btnClearAllHistory" class="v1-lib-action-btn hazard" title="${this.l('Hapus Semua Riwayat', 'Clear All History')}" aria-label="${this.l('Hapus Semua Riwayat', 'Clear All History')}">
            ${getIconSvg('delete-bin-line', { size: 19 })}
          </button>
          <button id="btnRefreshHistory" class="v1-lib-action-btn" title="${this.l('Segarkan Riwayat', 'Refresh History')}" aria-label="${this.l('Segarkan Riwayat', 'Refresh History')}">
            ${getIconSvg('refresh-line', { size: 19 })}
          </button>
          <button id="btnToggleHistoryViewMode" class="v1-lib-action-btn" title="${this.l('Alihkan Mode Tampilan (Grid / Linimasa)', 'Switch View Mode (Grid / Timeline)')}" aria-label="${this.l('Alihkan Mode Tampilan', 'Switch View Mode')}">
            ${getIconSvg(this.historyViewMode === 'grid' ? 'list' : 'layout-grid', { size: 19 })}
          </button>
        </div>`
            : ''
        }
      </div>
    </div>
    ${contentHtml}
  `;
  document.getElementById('btnClearAllHistory')?.addEventListener('click', async () => {
    const confirmed = await this.showConfirmModal({
      title: this.l('Hapus Seluruh Riwayat', 'Clear All History'),
      message: this.l(
        'Apakah Anda benar-benar yakin ingin menghapus seluruh riwayat bacaan Anda? Tindakan ini tidak dapat dibatalkan.',
        'Are you sure you want to clear your entire reading history? This action cannot be undone.'
      ),
      confirmText: this.l('Konfirmasi Hapus', 'Confirm Clear'),
      cancelText: this.t('modal.cancel'),
      isDanger: true,
      icon: 'danger-triangle-linear',
      confirmIcon: 'trash-bin-trash-linear'
    });
    if (!confirmed) return;
    this.mangaList.forEach((m) => {
      this.removedHistoryIds.add(m.id);
      m.lastViewedEpoch = 0;
      m.lastReadTimeAgo = 'Belum dibaca';
    });
    if (this.bridge.isWebViewHost) {
      void this.bridge.invoke('history:clear-all');
    }
    this.renderHistoryView(container);
    this.showToast(this.t('history.clearedToast'));
  });
  document.getElementById('btnRefreshHistory')?.addEventListener('click', () => {
    this.removedHistoryIds.clear();
    if (this.bridge.isWebViewHost) {
      void this.bridge.invoke<MangaItem[]>('history:get-list').then((items) => {
        if (Array.isArray(items)) {
          for (const m of items) this.upsertMangaItem(m);
        }
        this.renderHistoryView(container);
      });
    } else {
      this.renderHistoryView(container);
    }
    this.showToast(this.l('Riwayat baca telah disegarkan.', 'Reading history refreshed.'));
  });
  document.getElementById('btnToggleHistoryViewMode')?.addEventListener('click', () => {
    this.historyViewMode = this.historyViewMode === 'grid' ? 'list' : 'grid';
    this.renderHistoryView(container);
  });
  container.querySelectorAll<HTMLButtonElement>('[data-del-history]').forEach((btn) => {
    btn.addEventListener('click', (ev) => {
      ev.stopPropagation();
      const id = btn.dataset.delHistory;
      if (id) {
        this.removedHistoryIds.add(id);
        const found = this.mangaList.find((m) => m.id === id);
        if (found) {
          found.lastViewedEpoch = 0;
          found.lastReadTimeAgo = 'Belum dibaca';
        }
        if (this.bridge.isWebViewHost) {
          void this.bridge.invoke('history:remove-item', { mangaId: id });
        }
        this.renderHistoryView(container);
        this.showToast(this.l('Item dihapus dari riwayat.', 'Item removed from history.'));
      }
    });
  });
  document.getElementById('btnOpenStatsFromHistory')?.addEventListener('click', () => {
    this.isLibraryStatsOpen = true;
    this.currentTab = 'library';
    document.querySelectorAll<HTMLButtonElement>('.nav-btn[data-nav]').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.nav === 'library');
    });
    this.renderLibraryView(container);
    void this.fetchReadingStatistics(container, true);
  });
  this.bindCommonCardTriggers(container);
}

/* =========================================================================
 * 2B. READING STATISTICS / INSIGHTS VIEW & MOTION ENGINE
 * ========================================================================= */

function normalizeGenreTitle(raw: string): string {
  const clean = (raw || '').trim();
  if (!clean) return '';
  if (clean[0] === clean[0].toLowerCase()) {
    return clean.replace(/\b\w/g, (ch) => ch.toUpperCase());
  }
  return clean;
}

export function computeClientFallbackStatistics(this: YomicApp): ReadingStatisticsPayload {
  const libraryManga = this.mangaList.filter((m) => m.inLibrary);
  let readingCount = 0;
  let completedCount = 0;
  let unreadMangaCount = 0;
  let totalLibraryChapters = 0;
  let readLibraryChapters = 0;

  const getMangaChapterCounts = (m: MangaItem): { totalCh: number; unreadCh: number; readCh: number } => {
    const totalCh = Math.max(m.totalChapters || 0, m.chapters?.length || 0);
    const hasExplicitChapters = Array.isArray(m.chapters) && m.chapters.length > 0;
    const unreadFromChapters = hasExplicitChapters ? m.chapters.filter((c) => !c.isRead).length : undefined;
    const rawUnread =
      typeof m.unreadCount === 'number'
        ? m.unreadCount
        : typeof unreadFromChapters === 'number'
        ? unreadFromChapters
        : totalCh;
    const unreadCh = Math.max(0, Math.min(totalCh, rawUnread));
    const readCh = Math.max(0, totalCh - unreadCh);
    return { totalCh, unreadCh, readCh };
  };

  for (const m of libraryManga) {
    const { totalCh, unreadCh, readCh } = getMangaChapterCounts(m);

    totalLibraryChapters += totalCh;
    readLibraryChapters += readCh;

    const isDone = (totalCh > 0 && unreadCh === 0) || (m.status === 'Completed' && unreadCh === 0 && totalCh > 0);
    if (isDone) {
      completedCount++;
    } else if (readCh > 0) {
      readingCount++;
    } else {
      unreadMangaCount++;
    }
  }

  let totalChaptersRead = 0;
  let totalDownloadedChapters = 0;
  let totalBookmarkedChapters = 0;

  const activeDateKeys = new Set<string>();
  const dailyMap = new Map<string, { chapters: number; minutes: number }>();

  const toLocalDateKey = (epochMs: number): string | null => {
    if (!epochMs || epochMs <= 0) return null;
    const ms = epochMs < 10_000_000_000 ? epochMs * 1000 : epochMs;
    const d = new Date(ms);
    if (isNaN(d.getTime())) return null;
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };

  const now = new Date();
  const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const formatKey = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const todayKey = formatKey(todayMidnight);
  const yesterdayDate = new Date(todayMidnight.getTime() - 86400000);
  const yesterdayKey = formatKey(yesterdayDate);

  const sourceMangas = libraryManga.length > 0 ? libraryManga : this.mangaList;

  for (const m of sourceMangas) {
    const { readCh } = getMangaChapterCounts(m);

    totalChaptersRead += readCh;
    totalDownloadedChapters += m.downloadedCount || (m.chapters ? m.chapters.filter((c) => c.isDownloaded).length : 0);
    if (m.chapters) {
      totalBookmarkedChapters += m.chapters.filter((c) => c.isBookmarked).length;
    }
  }

  // Collect daily activity and active dates across ALL read/viewed mangas (both Library & History)
  for (const m of this.mangaList) {
    const { readCh } = getMangaChapterCounts(m);
    if (readCh > 0 || (m.lastViewedEpoch && m.lastViewedEpoch > 0)) {
      const dateKey = toLocalDateKey(m.lastViewedEpoch || 0) || todayKey;
      activeDateKeys.add(dateKey);
      const effectiveCh = Math.max(readCh, m.lastViewedEpoch && m.lastViewedEpoch > 0 ? 1 : 0);
      const prev = dailyMap.get(dateKey) || { chapters: 0, minutes: 0 };
      dailyMap.set(dateKey, {
        chapters: prev.chapters + effectiveCh,
        minutes: prev.minutes + Math.max(1, Math.round(effectiveCh * 2.5))
      });
    }
  }

  const sortedDates = Array.from(activeDateKeys).sort();
  let longestStreak = 0;
  let currentRun = 0;
  for (let i = 0; i < sortedDates.length; i++) {
    if (i === 0) {
      currentRun = 1;
    } else {
      const prevD = new Date(sortedDates[i - 1] + 'T00:00:00');
      const curD = new Date(sortedDates[i] + 'T00:00:00');
      const diffDays = Math.round((curD.getTime() - prevD.getTime()) / 86400000);
      if (diffDays === 1) {
        currentRun++;
      } else if (diffDays > 1) {
        currentRun = 1;
      }
    }
    if (currentRun > longestStreak) longestStreak = currentRun;
  }

  let currentStreak = 0;
  let cursor: Date | null = activeDateKeys.has(todayKey)
    ? new Date(todayMidnight)
    : activeDateKeys.has(yesterdayKey)
    ? new Date(yesterdayDate)
    : null;

  while (cursor && activeDateKeys.has(formatKey(cursor))) {
    currentStreak++;
    cursor = new Date(cursor.getTime() - 86400000);
  }

  const dailyActivity: DailyActivityStatItem[] = [];
  for (let offset = 13; offset >= 0; offset--) {
    const d = new Date(todayMidnight.getTime() - offset * 86400000);
    const key = formatKey(d);
    const label = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
    const entry = dailyMap.get(key);
    dailyActivity.push({
      dateLabel: label,
      fullDate: key,
      chaptersRead: entry?.chapters ?? 0,
      minutesRead: entry?.minutes ?? 0
    });
  }

  const genreSourceManga =
    libraryManga.length > 0
      ? libraryManga
      : this.mangaList.filter((m) => getMangaChapterCounts(m).readCh > 0);

  const genreCounter = new Map<string, { display: string; mangaCount: number; chaptersRead: number }>();
  const sourceCount = Math.max(1, genreSourceManga.length);

  for (const m of genreSourceManga) {
    if (!m.genres || m.genres.length === 0) continue;
    const { readCh } = getMangaChapterCounts(m);
    const seen = new Set<string>();
    for (const rawG of m.genres) {
      const clean = normalizeGenreTitle(rawG);
      if (!clean || clean.length < 2) continue;
      const norm = clean.toLowerCase();
      if (seen.has(norm)) continue;
      seen.add(norm);
      const existing = genreCounter.get(norm);
      if (existing) {
        existing.mangaCount += 1;
        existing.chaptersRead += readCh;
      } else {
        genreCounter.set(norm, { display: clean, mangaCount: 1, chaptersRead: readCh });
      }
    }
  }

  const topGenres: GenreStatItem[] = Array.from(genreCounter.values())
    .sort((a, b) => b.mangaCount - a.mangaCount || b.chaptersRead - a.chaptersRead || a.display.localeCompare(b.display))
    .slice(0, 8)
    .map((g) => ({
      genre: g.display,
      mangaCount: g.mangaCount,
      chaptersRead: g.chaptersRead,
      percentage: Math.min(100, Math.round((g.mangaCount / sourceCount) * 1000) / 10)
    }));

  const completionRatePercent =
    totalLibraryChapters > 0 ? Math.round((readLibraryChapters / totalLibraryChapters) * 1000) / 10 : 0;

  return {
    totalLibraryManga: libraryManga.length,
    readingMangaCount: readingCount,
    completedMangaCount: completedCount,
    unreadMangaCount,
    totalChaptersRead,
    totalLibraryChapters,
    completionRatePercent,
    totalDownloadedChapters,
    totalBookmarkedChapters,
    currentStreakDays: currentStreak,
    longestStreakDays: longestStreak,
    totalReadingMinutes: totalChaptersRead > 0 ? Math.max(1, Math.round(totalChaptersRead * 2.5)) : 0,
    activeDaysCount: activeDateKeys.size,
    topGenres,
    dailyActivity
  };
}

function syncStatisticsWithMarkAsRead(
  backend: ReadingStatisticsPayload,
  client: ReadingStatisticsPayload
): ReadingStatisticsPayload {
  if (client.totalLibraryManga <= 0) {
    return backend;
  }

  // Strictly enforce Mark-as-Read library numbers so ghost/non-library chapters never inflate stats
  const synced: ReadingStatisticsPayload = {
    ...backend,
    totalLibraryManga: client.totalLibraryManga,
    readingMangaCount: client.readingMangaCount,
    completedMangaCount: client.completedMangaCount,
    unreadMangaCount: client.unreadMangaCount,
    totalChaptersRead: client.totalChaptersRead,
    totalLibraryChapters: client.totalLibraryChapters,
    completionRatePercent: client.completionRatePercent,
    totalReadingMinutes:
      client.totalChaptersRead > 0 ? Math.max(1, Math.round(client.totalChaptersRead * 2.5)) : 0,
    topGenres: client.topGenres.length > 0 ? client.topGenres : backend.topGenres
  };

  if (client.totalChaptersRead === 0) {
    synced.currentStreakDays = 0;
    synced.longestStreakDays = 0;
    synced.activeDaysCount = 0;
    synced.dailyActivity = client.dailyActivity.map((d) => ({
      ...d,
      chaptersRead: 0,
      minutesRead: 0
    }));
    return synced;
  }

  const backendByDate = new Map<string, DailyActivityStatItem>();
  for (const d of backend.dailyActivity || []) {
    backendByDate.set(d.fullDate, { ...d });
  }

  // Build 14-day timeline anchored on local midnight dates from client
  const mergedDaily: DailyActivityStatItem[] = client.dailyActivity.map((cDay) => {
    const bDay = backendByDate.get(cDay.fullDate);
    const chapters = bDay ? Math.max(bDay.chaptersRead, cDay.chaptersRead) : cDay.chaptersRead;
    return {
      dateLabel: cDay.dateLabel,
      fullDate: cDay.fullDate,
      chaptersRead: chapters,
      minutesRead: chapters > 0 ? Math.max(1, Math.round(chapters * 2.5)) : 0
    };
  });

  // Ensure 14-day sum matches Mark-as-Read chapters when chapters were marked or unmarked
  const sum14 = mergedDaily.reduce((acc, d) => acc + d.chaptersRead, 0);
  if (sum14 < client.totalChaptersRead && mergedDaily.length > 0) {
    // Attribute newly marked-as-read chapters that had no backend History timestamp to the latest active day or today
    const diff = client.totalChaptersRead - sum14;
    let targetIdx = mergedDaily.length - 1;
    for (let i = mergedDaily.length - 1; i >= 0; i--) {
      if (mergedDaily[i].chaptersRead > 0) {
        targetIdx = i;
        break;
      }
    }
    mergedDaily[targetIdx].chaptersRead += diff;
    mergedDaily[targetIdx].minutesRead = Math.max(1, Math.round(mergedDaily[targetIdx].chaptersRead * 2.5));
  } else if (sum14 > client.totalChaptersRead && sum14 > 0) {
    // Trim excess non-library or unmarked chapters from largest bars so chart never exceeds Mark-as-Read total
    let excess = sum14 - client.totalChaptersRead;
    const indicesBySize = mergedDaily
      .map((d, i) => ({ i, ch: d.chaptersRead }))
      .sort((a, b) => b.ch - a.ch);
    for (const item of indicesBySize) {
      if (excess <= 0) break;
      const cut = Math.min(mergedDaily[item.i].chaptersRead, excess);
      mergedDaily[item.i].chaptersRead -= cut;
      mergedDaily[item.i].minutesRead =
        mergedDaily[item.i].chaptersRead > 0
          ? Math.max(1, Math.round(mergedDaily[item.i].chaptersRead * 2.5))
          : 0;
      excess -= cut;
    }
  }

  synced.dailyActivity = mergedDaily;

  // Recompute streak & active days from merged daily activity
  const activeDates = mergedDaily.filter((d) => d.chaptersRead > 0).map((d) => d.fullDate).sort();
  let longest = 0;
  let run = 0;
  for (let i = 0; i < activeDates.length; i++) {
    if (i === 0) {
      run = 1;
    } else {
      const prevD = new Date(activeDates[i - 1] + 'T00:00:00');
      const curD = new Date(activeDates[i] + 'T00:00:00');
      const diffDays = Math.round((curD.getTime() - prevD.getTime()) / 86400000);
      run = diffDays === 1 ? run + 1 : 1;
    }
    if (run > longest) longest = run;
  }

  const activeSet = new Set(activeDates);
  const todayStr = mergedDaily.length > 0 ? mergedDaily[mergedDaily.length - 1].fullDate : '';
  const yesterdayStr = mergedDaily.length > 1 ? mergedDaily[mergedDaily.length - 2].fullDate : '';

  let curStreak = 0;
  let startIdx = -1;
  if (todayStr && activeSet.has(todayStr)) {
    startIdx = mergedDaily.length - 1;
  } else if (yesterdayStr && activeSet.has(yesterdayStr)) {
    startIdx = mergedDaily.length - 2;
  }
  if (startIdx >= 0) {
    for (let i = startIdx; i >= 0; i--) {
      if (mergedDaily[i].chaptersRead > 0) {
        curStreak++;
      } else {
        break;
      }
    }
  }

  synced.currentStreakDays = Math.max(curStreak, client.currentStreakDays, backend.currentStreakDays || 0);
  synced.longestStreakDays = Math.max(longest, synced.currentStreakDays, backend.longestStreakDays || 0);
  synced.activeDaysCount = Math.max(activeDates.length, client.activeDaysCount, backend.activeDaysCount || 0);

  return synced;
}

export async function fetchReadingStatistics(
  this: YomicApp,
  container: HTMLElement,
  forceRefresh = false
): Promise<void> {
  const clientFallback = this.computeClientFallbackStatistics();
  if (!this.readingStatsData || forceRefresh) {
    this.readingStatsData = clientFallback;
  }
  if (!this.bridge.isWebViewHost) {
    return;
  }
  this.isReadingStatsLoading = true;
  try {
    const result = await this.bridge.invoke<ReadingStatisticsPayload>('library:get-statistics');
    if (result && typeof result.totalLibraryManga === 'number') {
      const freshClient = this.computeClientFallbackStatistics();
      this.readingStatsData = syncStatisticsWithMarkAsRead(result, freshClient);
    }
  } catch {
    // Keep client fallback statistics on error
  } finally {
    this.isReadingStatsLoading = false;
    if (this.currentTab === 'library' && this.isLibraryStatsOpen && !this.activeDetailMangaId) {
      this.renderReadingStatisticsView(container);
    }
  }
}

let activeStatsRafIds: number[] = [];

function cancelActiveStatsAnimations(): void {
  for (const id of activeStatsRafIds) {
    cancelAnimationFrame(id);
  }
  activeStatsRafIds = [];
}

function animateReadingStatisticsDom(root: HTMLElement): void {
  cancelActiveStatsAnimations();
  const prefersReducedMotion =
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const counters = root.querySelectorAll<HTMLElement>('[data-stat-counter]');
  const durationMs = 450;

  counters.forEach((el) => {
    const targetVal = Number(el.dataset.statCounter || '0');
    const suffix = el.dataset.statSuffix || '';
    const isDecimal = el.dataset.statDecimal === 'true';

    if (prefersReducedMotion || targetVal <= 0) {
      el.textContent = `${isDecimal ? targetVal.toFixed(1) : Math.round(targetVal).toLocaleString('id-ID')}${suffix}`;
      return;
    }

    const startTime = performance.now();
    const step = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / durationMs);
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = targetVal * eased;
      el.textContent = `${isDecimal ? current.toFixed(1) : Math.round(current).toLocaleString('id-ID')}${suffix}`;

      if (progress < 1) {
        const rafId = requestAnimationFrame(step);
        activeStatsRafIds.push(rafId);
      } else {
        el.textContent = `${isDecimal ? targetVal.toFixed(1) : Math.round(targetVal).toLocaleString('id-ID')}${suffix}`;
      }
    };
    const rafId = requestAnimationFrame(step);
    activeStatsRafIds.push(rafId);
  });

  const applyVisualTransforms = () => {
    root.querySelectorAll<HTMLElement>('[data-scale-x]').forEach((bar) => {
      const ratio = Math.max(0, Math.min(1, Number(bar.dataset.scaleX || '0')));
      bar.style.transform = `scaleX(${ratio})`;
    });
    root.querySelectorAll<HTMLElement>('[data-scale-y]').forEach((bar) => {
      const ratio = Math.max(0, Math.min(1, Number(bar.dataset.scaleY || '0')));
      bar.style.transform = `scaleY(${ratio})`;
    });
  };

  if (prefersReducedMotion) {
    applyVisualTransforms();
  } else {
    const rafId = requestAnimationFrame(() => {
      const innerRaf = requestAnimationFrame(applyVisualTransforms);
      activeStatsRafIds.push(innerRaf);
    });
    activeStatsRafIds.push(rafId);
  }
}

export function renderReadingStatisticsView(this: YomicApp, container: HTMLElement): void {
  const fallback = this.computeClientFallbackStatistics();
  const stats = this.readingStatsData
    ? syncStatisticsWithMarkAsRead(this.readingStatsData, fallback)
    : fallback;
  this.readingStatsData = stats;

  const hours = Math.floor(stats.totalReadingMinutes / 60);
  const mins = stats.totalReadingMinutes % 60;
  const clampedCompletion = Math.max(0, Math.min(100, stats.completionRatePercent));
  const completionScale = Number((clampedCompletion / 100).toFixed(3));
  const formattedCompletionPct = `${clampedCompletion.toFixed(1).replace(/\.0$/, '')}%`;

  const genreDenominator =
    stats.topGenres.length > 0
      ? Math.max(1, stats.totalLibraryManga, ...stats.topGenres.map((g) => g.mangaCount))
      : 1;
  const maxDailyChapters =
    stats.dailyActivity.length > 0 ? Math.max(1, ...stats.dailyActivity.map((d) => d.chaptersRead)) : 1;
  const last14TotalChapters = stats.dailyActivity.reduce((sum, d) => sum + d.chaptersRead, 0);
  const todayChaptersRead =
    stats.dailyActivity.length > 0 ? stats.dailyActivity[stats.dailyActivity.length - 1].chaptersRead : 0;

  const dayUnit = (n: number) => this.l('hari', n === 1 ? 'day' : 'days');
  const seriesUnit = (n: number) => this.l('komik', n === 1 ? 'series' : 'series');

  const avgMinsPerCh =
    stats.totalChaptersRead > 0
      ? (stats.totalReadingMinutes / stats.totalChaptersRead).toFixed(1).replace(/\.0$/, '')
      : '0';

  const genreRowsHtml =
    stats.topGenres.length === 0
      ? `
        <div class="v1-stats-empty-sub">
          <span>${this.l('Belum ada data genre dari koleksi komik di pustaka Anda.', 'No genre data in your library yet.')}</span>
        </div>
      `
      : stats.topGenres
          .map((g, idx) => {
            const scaleRatio = Math.max(0.04, Number((g.mangaCount / genreDenominator).toFixed(3)));
            const rankStr = String(idx + 1).padStart(2, '0');
            const displayGenre = normalizeGenreTitle(g.genre);
            return `
              <div class="v1-stats-genre-row">
                <div class="v1-stats-genre-meta">
                  <div class="v1-stats-genre-left">
                    <span class="v1-stats-genre-index tabular-nums">${rankStr}</span>
                    <span class="v1-stats-genre-name">${escapeXml(displayGenre)}</span>
                  </div>
                  <div class="v1-stats-genre-right tabular-nums">
                    <span class="v1-stats-genre-count">${g.mangaCount} ${seriesUnit(g.mangaCount)}</span>
                    <span class="v1-stats-genre-ch">${g.chaptersRead} ch</span>
                  </div>
                </div>
                <div class="v1-stats-genre-track">
                  <div class="v1-stats-genre-bar-fill" data-scale-x="${scaleRatio}" style="transform: scaleX(0);"></div>
                </div>
              </div>
            `;
          })
          .join('');

  const activityBarsHtml = stats.dailyActivity
    .map((day, idx) => {
      const isToday = idx === stats.dailyActivity.length - 1;
      const hasActivity = day.chaptersRead > 0;
      // Square-root damped scaling so 1-5 chapter days remain clearly visible next to bulk-read days
      const dampedRatio = hasActivity ? Math.sqrt(day.chaptersRead) / Math.sqrt(maxDailyChapters) : 0;
      const scaleY = hasActivity ? Math.max(0.14, Number(dampedRatio.toFixed(3))) : 0;
      const tooltip = hasActivity
        ? `${day.fullDate} — ${day.chaptersRead} ${this.l('bab dibaca', day.chaptersRead === 1 ? 'chapter read' : 'chapters read')}`
        : `${day.fullDate} — ${this.l('Tidak ada aktivitas', 'No activity')}`;
      return `
        <div class="v1-stats-day-col ${isToday ? 'is-today' : ''} ${hasActivity ? 'has-activity' : ''}" title="${escapeXml(tooltip)}">
          <div class="v1-stats-day-val tabular-nums">${hasActivity ? day.chaptersRead : ''}</div>
          <div class="v1-stats-day-stage">
            ${
              hasActivity
                ? `<div class="v1-stats-day-bar" data-scale-y="${scaleY}" style="transform: scaleY(0);"></div>`
                : `<div class="v1-stats-day-zero-tick"></div>`
            }
          </div>
          <div class="v1-stats-day-label tabular-nums">${escapeXml(day.dateLabel)}</div>
        </div>
      `;
    })
    .join('');

  const libraryReadChapters =
    stats.totalLibraryChapters > 0
      ? Math.min(stats.totalLibraryChapters, stats.totalChaptersRead)
      : stats.totalChaptersRead;

  const chapterSubtext =
    stats.totalLibraryChapters > 0
      ? this.l(
          `${libraryReadChapters} dari ${stats.totalLibraryChapters} bab di pustaka`,
          `${libraryReadChapters} of ${stats.totalLibraryChapters} library chapters`
        )
      : stats.totalDownloadedChapters > 0
      ? `${stats.totalDownloadedChapters} ${this.l('bab tersimpan offline', 'downloaded chapters')}`
      : this.l('Total bab yang telah diselesaikan', 'Total completed chapters');

  const streakStatusNote =
    stats.currentStreakDays > 0 && todayChaptersRead === 0
      ? this.l('Baca hari ini untuk lanjutkan', 'Read today to extend')
      : `${stats.activeDaysCount} ${this.l('hari aktif', stats.activeDaysCount === 1 ? 'active day' : 'active days')}`;

  container.innerHTML = `
    <div class="v1-stats-wrap">
      <!-- Top Master Bar -->
      <div class="v1-lib-top">
        <div class="v1-lib-master-bar">
          <div class="v1-lib-left-group">
            <div class="v1-lib-title-row">
              <button id="btnBackFromStats" class="v1-lib-action-btn" title="${escapeXml(this.l('Kembali ke Pustaka (Esc)', 'Back to Library (Esc)'))}" aria-label="${escapeXml(this.l('Kembali ke Pustaka', 'Back to Library'))}">
                ${getIconSvg('arrow-left-linear', { size: 18 })}
              </button>
              ${getIconSvg('chart-2-linear', { size: 22 })}
              <span class="v1-lib-title-text">${this.l('Statistik Membaca', 'Reading Insights')}</span>
            </div>
          </div>
          <div class="v1-lib-actions">
            <button id="btnRefreshStats" class="v1-lib-action-btn ${this.isReadingStatsLoading ? 'loading' : ''}" title="${escapeXml(this.l('Segarkan Data', 'Refresh Data'))}" aria-label="${escapeXml(this.l('Segarkan Data', 'Refresh Data'))}">
              ${this.isReadingStatsLoading ? '<div class="v1-lib-action-btn-spinner"></div>' : getIconSvg('refresh-line', { size: 17 })}
            </button>
          </div>
        </div>
      </div>

      <!-- Unified 4-Column Architectural Metric Strip -->
      <section class="v1-stats-summary-strip" aria-label="${escapeXml(this.l('Ringkasan Statistik', 'Summary Metrics'))}">
        <!-- 1. Library Collection -->
        <div class="v1-stats-metric-cell">
          <div class="v1-stats-metric-head-row">
            <span class="v1-stats-metric-label">
              <span class="v1-stats-metric-icon">${getIconSvg('book-open-line', { size: 15 })}</span>
              <span>${this.l('Koleksi Pustaka', 'Library Collection')}</span>
            </span>
          </div>
          <div class="v1-stats-metric-main tabular-nums">
            <span class="v1-stats-metric-number" data-stat-counter="${stats.totalLibraryManga}">0</span>
            <span class="v1-stats-metric-unit">${seriesUnit(stats.totalLibraryManga)}</span>
          </div>
          <div class="v1-stats-metric-meta tabular-nums">
            <span>${stats.completedMangaCount} ${this.l('selesai', 'done')}</span>
            <span class="v1-stats-dot">·</span>
            <span>${stats.readingMangaCount} ${this.l('dibaca', 'reading')}</span>
            <span class="v1-stats-dot">·</span>
            <span>${stats.unreadMangaCount} ${this.l('belum', 'unread')}</span>
          </div>
        </div>

        <!-- 2. Chapters Read -->
        <div class="v1-stats-metric-cell">
          <div class="v1-stats-metric-head-row">
            <span class="v1-stats-metric-label">
              <span class="v1-stats-metric-icon">${getIconSvg('check-read-linear', { size: 15 })}</span>
              <span>${this.l('Bab Selesai Dibaca', 'Chapters Read')}</span>
            </span>
            <span class="v1-stats-metric-inline-pct tabular-nums" title="${escapeXml(this.l('Tingkat penyelesaian bab di pustaka', 'Library chapter completion rate'))}">${formattedCompletionPct}</span>
          </div>
          <div class="v1-stats-metric-main tabular-nums">
            <span class="v1-stats-metric-number" data-stat-counter="${stats.totalChaptersRead}">0</span>
            <span class="v1-stats-metric-unit">${this.l('bab', stats.totalChaptersRead === 1 ? 'chapter' : 'chapters')}</span>
          </div>
          <div class="v1-stats-inline-progress">
            <div class="v1-stats-inline-progress-fill" data-scale-x="${completionScale}" style="transform: scaleX(0);"></div>
          </div>
          <div class="v1-stats-metric-meta tabular-nums">
            <span>${escapeXml(chapterSubtext)}</span>
          </div>
        </div>

        <!-- 3. Daily Streak -->
        <div class="v1-stats-metric-cell">
          <div class="v1-stats-metric-head-row">
            <span class="v1-stats-metric-label">
              <span class="v1-stats-metric-icon">${getIconSvg('fire-linear', { size: 15 })}</span>
              <span>${this.l('Streak Harian', 'Daily Streak')}</span>
            </span>
          </div>
          <div class="v1-stats-metric-main tabular-nums">
            <span class="v1-stats-metric-number" data-stat-counter="${stats.currentStreakDays}">0</span>
            <span class="v1-stats-metric-unit">${dayUnit(stats.currentStreakDays)}</span>
          </div>
          <div class="v1-stats-metric-meta tabular-nums">
            <span class="v1-stats-meta-inline-icon">${getIconSvg('award-linear', { size: 13 })} ${this.l('Rekor', 'Longest')} ${stats.longestStreakDays} ${dayUnit(stats.longestStreakDays)}</span>
            <span class="v1-stats-dot">·</span>
            <span>${escapeXml(streakStatusNote)}</span>
          </div>
        </div>

        <!-- 4. Estimated Reading Time -->
        <div class="v1-stats-metric-cell">
          <div class="v1-stats-metric-head-row">
            <span class="v1-stats-metric-label">
              <span class="v1-stats-metric-icon">${getIconSvg('clock-circle-linear', { size: 15 })}</span>
              <span>${this.l('Estimasi Waktu Baca', 'Reading Time')}</span>
            </span>
          </div>
          <div class="v1-stats-metric-main tabular-nums">
            ${
              hours > 0
                ? `<span class="v1-stats-metric-number" data-stat-counter="${hours}">0</span><span class="v1-stats-metric-unit">${this.l('j', 'h')}</span>`
                : ''
            }
            <span class="v1-stats-metric-number" data-stat-counter="${mins}">0</span>
            <span class="v1-stats-metric-unit">${this.l('mnt', 'm')}</span>
          </div>
          <div class="v1-stats-metric-meta tabular-nums">
            <span>${
              stats.totalChaptersRead > 0
                ? `${this.l('Dari', 'From')} ${stats.totalChaptersRead} ${this.l('bab', 'ch')} · ~${avgMinsPerCh} ${this.l('mnt/bab', 'min/ch')}`
                : this.l('Belum ada riwayat sesi baca', 'No reading sessions recorded')
            }</span>
          </div>
        </div>
      </section>

      <!-- 2-Column Analytical Ledger -->
      <div class="v1-stats-panels-grid">
        <!-- Left Panel: Genre Distribution -->
        <section class="v1-stats-panel">
          <div class="v1-stats-panel-header">
            <div class="v1-stats-panel-title-wrap">
              <h3 class="v1-stats-panel-title">
                <span class="v1-stats-panel-icon">${getIconSvg('bookmark-linear', { size: 15 })}</span>
                <span>${this.l('Distribusi Genre Pustaka', 'Library Genre Breakdown')}</span>
              </h3>
              <p class="v1-stats-panel-subtitle">${this.l('Proporsi genre berdasarkan komik yang tersimpan di pustaka Anda', 'Genre distribution across series saved in your library')}</p>
            </div>
            <span class="v1-stats-panel-badge tabular-nums">${stats.totalLibraryManga} ${seriesUnit(stats.totalLibraryManga)}</span>
          </div>
          <div class="v1-stats-genre-list">
            ${genreRowsHtml}
          </div>
        </section>

        <!-- Right Panel: 14-Day Reading Activity -->
        <section class="v1-stats-panel">
          <div class="v1-stats-panel-header">
            <div class="v1-stats-panel-title-wrap">
              <h3 class="v1-stats-panel-title">
                <span class="v1-stats-panel-icon">${getIconSvg('history-line', { size: 15 })}</span>
                <span>${this.l('Aktivitas 14 Hari Terakhir', 'Last 14 Days Activity')}</span>
              </h3>
              <p class="v1-stats-panel-subtitle">${this.l('Bab yang dibuka dan dibaca per hari berdasarkan catatan riwayat', 'Chapters read per day from your reading history log')}</p>
            </div>
            <span class="v1-stats-panel-badge tabular-nums">${last14TotalChapters} ${this.l('bab', last14TotalChapters === 1 ? 'chapter' : 'chapters')}</span>
          </div>
          <div class="v1-stats-activity-chart">
            ${activityBarsHtml}
          </div>
        </section>
      </div>
    </div>
  `;

  animateReadingStatisticsDom(container);

  const closeStats = () => {
    cancelActiveStatsAnimations();
    this.isLibraryStatsOpen = false;
    this.renderLibraryView(container);
  };

  document.getElementById('btnBackFromStats')?.addEventListener('click', closeStats);
  document.getElementById('btnRefreshStats')?.addEventListener('click', () => {
    void this.fetchReadingStatistics(container, true);
  });
}
