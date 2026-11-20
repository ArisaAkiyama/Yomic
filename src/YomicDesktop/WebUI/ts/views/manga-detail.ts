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
  MalSearchResult,
  MangaItem,
  NavTabId,
  ReaderMode,
  ReaderPagesResult,
  SettingsSubTab,
  SourceFeedResult
} from '../types.js';

/* =========================================================================
 * 5. MANGA DETAIL VIEW (1:1 MIRROR OF YOMIC V1 MangaDetailView.axaml)
 * ========================================================================= */

export function buildMangaDetailHtml(this: YomicApp, manga: MangaItem): string {
  const fallbackSvg = buildMangaCoverSvg(manga);
  const coverSrc = this.getMangaCoverHtmlSrc(manga);
  const latestChapter = manga.chapters.length > 0
    ? manga.chapters.reduce((prev, curr) => (curr.number > prev.number ? curr : prev), manga.chapters[0])
    : null;

  let chapters = [...manga.chapters];
  if (this.detailChapterFilter === 'unread') {
    chapters = chapters.filter((c) => !c.isRead);
  } else if (this.detailChapterFilter === 'bookmarked') {
    chapters = chapters.filter((c) => c.isBookmarked);
  }
  if (this.detailChapterAsc) {
    chapters.reverse();
  }

  const isOngoing = manga.status === 'Ongoing';
  const statusColor = isOngoing ? '#E53935' : 'var(--ink-secondary)';
  const statusText = isOngoing ? 'Berjalan' : 'Tamat Terbit';

  // Bookmark / Saved Icon for Library Toggle: Solar Bold when in library, Linear outline when not
  const librarySvg = manga.inLibrary
    ? getIconSvg('bookmark-bold', { size: 26, color: 'var(--ocean-primary)' })
    : getIconSvg('bookmark', { size: 26 });
  return `
    <div class="v1-detail-wrap">
      <!-- AMBIENT BACKGROUND (scrolls with header, exact mirror of MangaDetailView.axaml lines 28-45) -->
      <div class="v1-ambient-bg">
        <img class="v1-ambient-img" src="${coverSrc}" alt="" onerror="this.onerror=null;this.src='${fallbackSvg}';" />
        <div class="v1-ambient-black-overlay"></div>
        <div class="v1-ambient-fade-gradient"></div>
      </div>
      <!-- FOREGROUND INTERACTIVE CONTENT -->
      <div class="v1-detail-foreground">

      <!-- HEADER CONTENT (2-Column Grid: 230px Cover Left + Info & 6-Action Grid Right) -->
      <div class="v1-header-grid">
        <!-- Left Column: Sharp Cover Image ONLY (Width=230, Height=345, CornerRadius=12) -->
        <div class="v1-cover-border">
          <img class="v1-cover-img" src="${coverSrc}" alt="${manga.title}" onerror="this.onerror=null;this.src='${fallbackSvg}';" />
        </div>
        <!-- Right Column: Title, Vertical Meta Stack, Genres, 6-Col Action Grid, Expandable Synopsis -->
        <div class="v1-info-col">
          <div class="v1-title-row">
            <h2 class="v1-manga-title">${manga.title}</h2>
            <button id="btnBackFromDetail" class="v1-close-btn" title="${this.l('Tutup (Esc)', 'Close (Esc)')}" aria-label="${this.t('modal.close')}">
              ${getIconSvg('close', { size: 22 })}
            </button>
          </div>
          <!-- Author, Status, Source Vertical Stack -->
          <div class="v1-meta-stack">
            <!-- Author -->
            <div class="v1-meta-row">
              ${getIconSvg('information-line', { size: 15 })}
              <span>${manga.author} (${manga.artist})</span>
            </div>
            <!-- Status with Timer Icon -->
            <div class="v1-meta-row" style="color:${statusColor};">
              ${getIconSvg('time-line', { size: 15, color: statusColor })}
              <span>${statusText}</span>
            </div>
            <!-- Source Info -->
            <div class="v1-meta-row">
              ${(() => {
                const matched = this.extensions.find((e) => String(e.sourceId) === String(manga.sourceId) || e.name.toLowerCase() === manga.sourceName.toLowerCase());
                return matched ? this.buildSourceLogoHtml(matched, 18) : `<span class="v1-source-badge">${manga.sourceName.slice(0, 2).toUpperCase()}</span>`;
              })()}
              <span>${manga.sourceName}</span>
            </div>
          </div>
          <!-- GENRES WrapPanel -->
          <div class="v1-genres-wrap">
            ${manga.genres.map((g) => `<span class="v1-genre-pill">${g}</span>`).join('')}
          </div>
          <!-- Action Buttons (UniformGrid Rows=1 Columns=6) -->
          <div class="v1-action-grid">
            <!-- 1. Read Now / Resume -->
            <button class="v1-action-btn" data-quick-read="${manga.id}" data-ch="${manga.lastReadChapter}">
              ${getIconSvg('play-linear', { size: 26 })}
              <span>${this.t('detail.continueChapter', { num: manga.lastReadChapter })}</span>
            </button>
            <!-- 2. Library Toggle (Bookmark Outline / Blue Filled ala Gambar 2) -->
            <button id="btnToggleInLibrary" class="v1-action-btn">
              ${librarySvg}
              <span>${manga.inLibrary ? this.t('detail.inLibrary') : this.t('detail.addToLibrary')}</span>
            </button>
            <!-- 3. Track (MyAnimeList) -->
            <button id="btnOpenTrackerPopup" class="v1-action-btn">
              ${getIconSvg('checkbox-circle-line', { size: 26 })}
              <span>${this.l('Lacak', 'Track')}</span>
            </button>
            <!-- 4. Open in Browser -->
            <button id="btnOpenWebViewSource" class="v1-action-btn">
              ${getIconSvg('compass-3-line', { size: 26 })}
              <span>Browser</span>
            </button>
            <!-- 5. Refresh -->
            <button id="btnRefreshMangaDetail" class="v1-action-btn">
              ${getIconSvg('refresh-line', { size: 26 })}
              <span>${this.t('common.refresh')}</span>
            </button>
            <!-- 6. Download All -->
            <button id="btnDownloadAllChapters" class="v1-action-btn">
              ${getIconSvg('download-2-line', { size: 26 })}
              <span>${this.l('Unduh', 'Download')}</span>
            </button>
          </div>
          <!-- Description / Synopsis -->
          <div class="v1-synopsis-heading">${this.l('Sinopsis', 'Synopsis')}</div>
          <div class="v1-synopsis-body ${this.isSynopsisExpanded ? '' : 'collapsed'}">
            ${manga.synopsis}
          </div>
          <button id="btnToggleSynopsis" class="v1-synopsis-toggle" title="${escapeXml(this.isSynopsisExpanded ? this.l('Ciutkan Sinopsis', 'Collapse Synopsis') : this.l('Perluas Sinopsis', 'Expand Synopsis'))}" aria-label="${escapeXml(this.l('Perluas atau ciutkan sinopsis', 'Expand or collapse synopsis'))}">
            ${getIconSvg(this.isSynopsisExpanded ? 'chevron-up' : 'chevron-down', { size: 20 })}
          </button>
        </div>
      </div>
      <!-- CHAPTERS DIVIDER (Title + Count Badge Left | Filter Flyout, Delete All Downloads, Sort Right) -->
      <div class="v1-chapters-divider">
        <div class="v1-chapters-left">
          <span class="v1-chapters-title">${this.l('Daftar chapter', 'Chapters')}</span>
          <span class="v1-chapters-count-badge tabular-nums">(${chapters.length})</span>
        </div>
        <div class="v1-chapters-controls">
          <!-- 1. Filter Flyout Button -->
          <button id="btnToggleFilterFlyout" class="v1-chapter-ctrl-btn" title="${escapeXml(this.l('Filter Chapter', 'Filter Chapters'))}" aria-label="${escapeXml(this.l('Filter Chapter', 'Filter Chapters'))}">
            ${getIconSvg('filter', { size: 16 })}
          </button>
          <!-- Filter Flyout Menu -->
          <div id="chapterFilterFlyout" class="v1-filter-flyout ${this.isChapterFilterFlyoutOpen ? 'open' : ''}">
            <button class="v1-flyout-item" data-ch-filter="all">
              <span class="v1-flyout-check">
                ${this.detailChapterFilter === 'all' ? getIconSvg('check-line', { size: 14 }) : ''}
              </span>
              <span>${this.l('Semua Bab', 'All Chapters')}</span>
            </button>
            <button class="v1-flyout-item" data-ch-filter="unread">
              <span class="v1-flyout-check">
                ${this.detailChapterFilter === 'unread' ? getIconSvg('check-line', { size: 14 }) : ''}
              </span>
              <span>${this.libraryFilterMode ? this.t('library.filterUnread') : 'Belum Dibaca'}</span>
            </button>
            <button class="v1-flyout-item" data-ch-filter="bookmarked">
              <span class="v1-flyout-check">
                ${this.detailChapterFilter === 'bookmarked' ? getIconSvg('check-line', { size: 14 }) : ''}
              </span>
              <span>${this.l('Ditandai', 'Bookmarked')}</span>
            </button>
          </div>
          <!-- 2. Delete All Downloads Button -->
          <button id="btnDeleteAllDownloads" class="v1-chapter-ctrl-btn danger" title="${escapeXml(this.l('Hapus Semua Unduhan Bab Ini', 'Delete All Chapter Downloads'))}" aria-label="${escapeXml(this.l('Hapus Semua Unduhan Bab Ini', 'Delete All Chapter Downloads'))}">
            ${getIconSvg('delete-bin-line', { size: 16 })}
          </button>
          <!-- 3. Sort Button (Icon only with smooth animated flip) -->
          <button id="btnToggleChOrder" class="v1-chapter-ctrl-btn ${this.detailChapterAsc ? 'asc' : 'desc'}" title="${this.detailChapterAsc ? this.l('Urutan: Terlama Dahulu (Klik untuk Terbaru)', 'Order: Oldest First (Click for Latest)') : this.l('Urutan: Terbaru Dahulu (Klik untuk Terlama)', 'Order: Latest First (Click for Oldest)')}" aria-label="${this.detailChapterAsc ? this.l('Urutkan Terlama Dahulu', 'Sort Oldest First') : this.l('Urutkan Terbaru Dahulu', 'Sort Latest First')}">
            <span class="v1-ch-sort-icon">
              ${getIconSvg('arrow-up-down-line', { size: 16 })}
            </span>
          </button>
        </div>
      </div>
      <!-- UNIFIED CHAPTER LIST TABLE GROUP (Clean Desktop List) -->
      <div class="v1-chapters-list">
        ${
          this.isDetailLoading && chapters.length === 0
            ? Array.from({ length: 8 })
                .map(
                  () => `
                  <div class="v1-skeleton-chapter-row" aria-hidden="true">
                    <div class="v1-skeleton-chapter-left">
                      <div class="v1-skeleton-line v1-skeleton-shimmer" style="width: 42%; height: 13px;"></div>
                      <div class="v1-skeleton-line v1-skeleton-shimmer" style="width: 22%; height: 10px;"></div>
                    </div>
                    <div class="v1-skeleton-chapter-right">
                      <div class="v1-skeleton-dot v1-skeleton-shimmer"></div>
                      <div class="v1-skeleton-dot v1-skeleton-shimmer"></div>
                    </div>
                  </div>`
                )
                .join('')
            : chapters
          .map((ch: ChapterItem) => {
            const isNewRelease =
              latestChapter != null &&
              (ch.id != null ? ch.id === latestChapter.id : ch.number === latestChapter.number) &&
              !ch.isRead;
            const isLastRead = manga.lastReadChapter > 0 && ch.number === manga.lastReadChapter;
            return `
              <div class="v1-chapter-row ${ch.isRead ? 'is-read' : ''} ${isLastRead ? 'is-last-read' : ''}" data-read-ch="${ch.number}">
                <div class="v1-chapter-main">
                  <div class="v1-chapter-title-row">
                    <span class="v1-chapter-title">Chapter ${ch.number}${ch.title ? ` — ${ch.title}` : ''}</span>
                    ${isLastRead ? `<span class="v1-ch-lastread-pill">${this.l('Terakhir dibaca', 'Last read')}</span>` : ''}
                    ${isNewRelease ? `<span class="v1-ch-new-pill">${this.l('Baru', 'New')}</span>` : ''}
                  </div>
                  <div class="v1-chapter-meta-sub">
                    <span>${ch.releaseDate}</span>
                    ${ch.scanlator ? `<span class="v1-chapter-meta-sep">•</span><span>${ch.scanlator}</span>` : ''}
                  </div>
                </div>
                <div class="v1-chapter-actions">
                  <!-- Bookmark Toggle Star -->
                  <button class="v1-ch-icon-btn ${ch.isBookmarked ? 'bookmarked' : ''}" data-toggle-bookmark="${ch.number}" title="${ch.isBookmarked ? this.l('Hapus Penanda', 'Remove Bookmark') : this.l('Tandai Chapter', 'Bookmark Chapter')}" aria-label="${this.l('Alihkan Penanda', 'Toggle Bookmark')}">
                    ${getIconSvg(ch.isBookmarked ? 'bookmark-bold' : 'bookmark', { size: 18, color: ch.isBookmarked ? 'var(--ocean-primary)' : 'currentColor' })}
                  </button>
                  <!-- Download / Offline Saved Indicator -->
                  ${
                    ch.isDownloaded
                      ? `<button class="v1-ch-icon-btn is-downloaded" data-del-single-ch="${ch.number}" title="${this.l('Tersimpan Offline (Klik untuk menghapus unduhan)', 'Saved Offline (Click to remove download)')}" aria-label="${this.l('Tersimpan Offline', 'Saved Offline')}">
                           ${getIconSvg('download-done', { size: 18 })}
                         </button>`
                      : `<button class="v1-ch-icon-btn" data-dl-single-ch="${ch.number}" title="${this.l('Unduh Bab', 'Download Chapter')}" aria-label="${this.l('Unduh Bab', 'Download Chapter')}">
                           ${getIconSvg('download-2-line', { size: 18 })}
                         </button>`
                  }
                  <!-- Chapter More Options Button -->
                  <button class="v1-ch-icon-btn v1-ch-more-btn" data-ch-more="${ch.number}" title="${this.l('Opsi Bab', 'Chapter Options')}" aria-label="${this.l('Opsi Bab', 'Chapter Options')}">
                    ${getIconSvg('more-vertical', { size: 16 })}
                  </button>
                </div>
              </div>`;
          })
          .join('')}
      </div>
      </div>
      <!-- MyAnimeList Tracker Edit / Search Dialog — Clean & Deslopped -->
      <div id="malTrackerModalBackdrop" class="v1-mal-backdrop ${this.isMalTrackerPopupOpen ? 'open' : ''}">
        <div class="v1-mal-dialog" role="dialog" aria-modal="true" aria-labelledby="malModalTitle">
          ${renderMalModalContent.call(this, manga)}
        </div>
      </div>
    </div>
  `;
}

function cleanMangaTitleForMalSearch(title: string): string {
  if (!title) return '';
  return title
    .replace(/\s*(\(.*\)|\[.*\])\s*$/g, '')
    .replace(/\s*(bahasa\s+indonesia|indonesia|raw|colored|color)\s*$/gi, '')
    .trim();
}

function renderMalDropdown(
  id: string,
  options: { value: string; label: string }[],
  selectedValue: string,
  ariaLabel: string,
  openUpward = false
): string {
  const activeOption = options.find((opt) => opt.value === selectedValue) || options[0];
  return `
    <div class="v1-mal-dropdown ${openUpward ? 'open-up' : ''}" data-dropdown-for="${escapeXml(id)}">
      <input type="hidden" id="${escapeXml(id)}" value="${escapeXml(activeOption?.value ?? selectedValue)}" />
      <button type="button" class="v1-mal-dropdown-trigger" aria-haspopup="listbox" aria-expanded="false" aria-label="${escapeXml(ariaLabel)}">
        <span class="v1-mal-dropdown-value">${escapeXml(activeOption?.label ?? '')}</span>
        <span class="v1-mal-dropdown-arrow">${getIconSvg('alt-arrow-down-linear', { size: 16 })}</span>
      </button>
      <div class="v1-mal-dropdown-menu" role="listbox">
        ${options
          .map((opt) => {
            const isSelected = opt.value === (activeOption?.value ?? selectedValue);
            return `
              <button type="button" class="v1-mal-dropdown-option ${isSelected ? 'selected' : ''}" data-value="${escapeXml(opt.value)}" role="option" aria-selected="${isSelected ? 'true' : 'false'}">
                <span>${escapeXml(opt.label)}</span>
                ${isSelected ? `<span class="v1-mal-dropdown-check">${getIconSvg('check', { size: 14 })}</span>` : ''}
              </button>
            `;
          })
          .join('')}
      </div>
    </div>
  `;
}

function setMalDropdownValue(id: string, value: string): void {
  const input = document.getElementById(id) as HTMLInputElement | null;
  if (!input) return;
  const dropdown = input.closest('.v1-mal-dropdown');
  if (!dropdown) {
    input.value = value;
    return;
  }
  const options = Array.from(dropdown.querySelectorAll<HTMLButtonElement>('.v1-mal-dropdown-option'));
  const target = options.find((opt) => opt.dataset.value === value) || options[0];
  if (!target) return;
  input.value = target.dataset.value ?? value;
  const valueSpan = dropdown.querySelector<HTMLElement>('.v1-mal-dropdown-value');
  const labelText = target.querySelector('span')?.textContent ?? '';
  if (valueSpan) valueSpan.textContent = labelText;

  options.forEach((opt) => {
    const selected = opt === target;
    opt.classList.toggle('selected', selected);
    opt.setAttribute('aria-selected', selected ? 'true' : 'false');
    const existingCheck = opt.querySelector('.v1-mal-dropdown-check');
    if (selected && !existingCheck) {
      opt.insertAdjacentHTML('beforeend', `<span class="v1-mal-dropdown-check">${getIconSvg('check', { size: 14 })}</span>`);
    } else if (!selected && existingCheck) {
      existingCheck.remove();
    }
  });
}

function renderMalModalContent(this: YomicApp, manga: MangaItem): string {
  if (!this.settings.isMalConnected) {
    return `
      <div class="v1-mal-header">
        <div class="v1-mal-title-wrap">
          <span id="malModalTitle" class="v1-mal-title">${this.l('Pelacakan MyAnimeList', 'MyAnimeList Tracking')}</span>
        </div>
        <button id="btnCloseMalTracker" class="v1-mal-close-btn" aria-label="${escapeXml(this.t('modal.close'))}">
          ${getIconSvg('close-linear', { size: 18 })}
        </button>
      </div>
      <div class="v1-mal-not-connected-box">
        <div class="v1-mal-warning-icon">
          ${getIconSvg('alert-triangle', { size: 36, color: '#F59E0B' })}
        </div>
        <div class="v1-mal-warning-title">${this.l('Akun MyAnimeList Belum Terhubung', 'MyAnimeList Account Not Connected')}</div>
        <p class="v1-mal-warning-text">
          ${this.l(
            'Hubungkan akun MyAnimeList Anda di menu Pengaturan untuk mengaktifkan sinkronisasi status membaca, progres bab, dan penilaian skor secara otomatis.',
            'Connect your MyAnimeList account in Settings to enable automatic syncing of reading status, chapter progress, and score.'
          )}
        </p>
        <button id="btnMalGoToSettings" class="v1-mal-btn-primary" type="button">
          ${this.l('Buka Pengaturan', 'Open Settings')}
        </button>
      </div>
    `;
  }

  if (this.isMalSearchMode) {
    const queryVal = this.malSearchQuery || cleanMangaTitleForMalSearch(manga.title);
    return `
      <div class="v1-mal-header">
        <div class="v1-mal-title-wrap">
          ${(manga.malTracked || this.malSelectedEntry) ? `
            <button id="btnMalBackToEdit" class="v1-mal-back-btn" title="${escapeXml(this.l('Kembali ke formulir status', 'Back to status form'))}" aria-label="${escapeXml(this.t('detail.backToLibrary'))}">
              ${getIconSvg('alt-arrow-left-linear', { size: 18 })}
            </button>
          ` : ''}
          <span id="malModalTitle" class="v1-mal-title">${this.l('Cari di MyAnimeList', 'Search MyAnimeList')}</span>
        </div>
        <button id="btnCloseMalTracker" class="v1-mal-close-btn" aria-label="${escapeXml(this.t('modal.close'))}">
          ${getIconSvg('close-linear', { size: 18 })}
        </button>
      </div>
      <div class="v1-mal-subtitle" title="${escapeXml(manga.title)}">${this.l('Mencari entri untuk:', 'Searching entry for:')} <strong>${escapeXml(manga.title)}</strong></div>

      <div class="v1-mal-search-bar">
        <div class="v1-mal-search-input-wrap">
          <span class="v1-mal-search-icon">${getIconSvg('search', { size: 16 })}</span>
          <input id="malSearchQueryInput" type="text" class="v1-mal-search-input" placeholder="${escapeXml(this.t('detail.malSearchPlaceholder'))}" value="${escapeXml(queryVal)}" autocomplete="off" />
        </div>
        <button id="btnExecuteMalSearch" class="v1-mal-btn-search" type="button" ${this.isMalSearching ? 'disabled' : ''}>
          ${this.isMalSearching ? this.l('Mencari...', 'Searching...') : this.t('detail.malSearchBtn')}
        </button>
      </div>

      <div class="v1-mal-results-area">
        ${this.isMalSearching ? `
          <div class="v1-mal-state-box">
            <div class="v1-spinner"></div>
            <span>${this.t('detail.malSearching')}</span>
          </div>
        ` : this.malSearchError ? `
          <div class="v1-mal-state-box error">
            <span>${escapeXml(this.malSearchError)}</span>
            <button id="btnRetryMalSearch" class="v1-mal-btn-retry" type="button">${this.t('reader.retryPage')}</button>
          </div>
        ` : this.malSearchResults.length === 0 ? `
          <div class="v1-mal-state-box empty">
            <span>${this.l('Tidak ada manga ditemukan. Coba gunakan judul alternatif dalam bahasa Inggris atau Romaji.', 'No manga found. Try using an alternative English or Romaji title.')}</span>
          </div>
        ` : `
          <div class="v1-mal-results-list">
            ${this.malSearchResults.map((r) => `
              <div class="v1-mal-result-card" data-select-mal-id="${r.id}" data-select-mal-title="${escapeXml(r.title)}" data-select-mal-cover="${escapeXml(r.coverUrl || '')}">
                <div class="v1-mal-result-thumb-wrap">
                  ${r.coverUrl
                    ? `<img class="v1-mal-result-thumb" src="${escapeXml(r.coverUrl)}" alt="${escapeXml(r.title)}" loading="lazy" onerror="this.style.display='none';" />`
                    : `<div class="v1-mal-result-no-thumb">📖</div>`
                  }
                </div>
                <div class="v1-mal-result-info">
                  <div class="v1-mal-result-title" title="${escapeXml(r.title)}">${escapeXml(r.title)}</div>
                  <div class="v1-mal-result-meta">
                    <span class="v1-mal-id-badge">MAL ID: #${r.id}</span>
                  </div>
                </div>
                <button class="v1-mal-btn-select" type="button" data-select-mal-id="${r.id}" data-select-mal-title="${escapeXml(r.title)}" data-select-mal-cover="${escapeXml(r.coverUrl || '')}">
                  ${this.t('detail.malSelectBtn')}
                </button>
              </div>
            `).join('')}
          </div>
        `}
      </div>
    `;
  }

  // Edit Mode
  const activeMalId = this.malSelectedEntry?.id || manga.malId || 0;
  const activeTitle = this.malSelectedEntry?.title || manga.malTitle || manga.title;
  const activeStatus = manga.malStatus || 'reading';
  const activeChaptersRead = manga.lastReadChapter ?? 0;
  const activeScore = typeof manga.malScore === 'number' ? manga.malScore : 0;

  return `
    <div class="v1-mal-header">
      <div class="v1-mal-title-wrap">
        <span id="malModalTitle" class="v1-mal-title">${this.l('Status Pelacakan', 'Tracking Status')}</span>
      </div>
      <button id="btnCloseMalTracker" class="v1-mal-close-btn" aria-label="${escapeXml(this.t('modal.close'))}">
        ${getIconSvg('close-linear', { size: 18 })}
      </button>
    </div>
    <div class="v1-mal-subtitle" title="${escapeXml(manga.title)}">${escapeXml(manga.title)}</div>

    <div class="v1-mal-linked-card">
      <div class="v1-mal-linked-info">
        <span class="v1-mal-linked-label">${this.l('Tertaut ke MyAnimeList:', 'Linked to MyAnimeList:')}</span>
        <span class="v1-mal-linked-title" title="${escapeXml(activeTitle)}">${escapeXml(activeTitle)}</span>
        <span class="v1-mal-linked-id">MAL ID: #${activeMalId}</span>
      </div>
      <button id="btnMalChangeManga" class="v1-mal-btn-change" type="button" title="${escapeXml(this.l('Ganti entri judul di MyAnimeList', 'Change MyAnimeList title entry'))}">
        ${this.l('Ganti Entri', 'Change Entry')}
      </button>
    </div>

    <!-- Field 1: Status Membaca -->
    <div class="v1-mal-field">
      <label class="v1-mal-label">${this.t('detail.malStatusLabel')}</label>
      ${renderMalDropdown(
        'malStatusSelect',
        [
          { value: 'reading', label: this.l('Sedang Membaca (Reading)', 'Reading') },
          { value: 'completed', label: this.l('Selesai Dibaca (Completed)', 'Completed') },
          { value: 'on_hold', label: this.l('Ditunda (On Hold)', 'On Hold') },
          { value: 'dropped', label: this.l('Dibatalkan (Dropped)', 'Dropped') },
          { value: 'plan_to_read', label: this.l('Rencana Dibaca (Plan to Read)', 'Plan to Read') }
        ],
        activeStatus,
        this.t('detail.malStatusLabel'),
        false
      )}
    </div>

    <!-- Field 2: Kemajuan Bab (Progress) -->
    <div class="v1-mal-field">
      <label class="v1-mal-label" for="malChaptersReadInput">${this.t('detail.malChapterLabel')}</label>
      <div class="v1-mal-stepper-container">
        <div class="v1-mal-stepper-box">
          <button id="btnMalDecCh" class="v1-mal-stepper-btn" aria-label="${escapeXml(this.l('Kurangi Bab', 'Decrease Chapter'))}">${getIconSvg('minus', { size: 15 })}</button>
          <input id="malChaptersReadInput" type="text" inputmode="numeric" class="v1-mal-stepper-input tabular-nums" value="${activeChaptersRead}" />
          <button id="btnMalIncCh" class="v1-mal-stepper-btn" aria-label="${escapeXml(this.l('Tambah Bab', 'Increase Chapter'))}">${getIconSvg('plus', { size: 15 })}</button>
        </div>
        <div class="v1-mal-total-badge tabular-nums">/ ${manga.totalChapters} ${this.l('bab', 'ch.')}</div>
      </div>
    </div>

    <!-- Field 3: Skor / Penilaian -->
    <div class="v1-mal-field">
      <label class="v1-mal-label">${this.t('detail.malScoreLabel')}</label>
      ${renderMalDropdown(
        'malScoreSelect',
        [
          { value: '10', label: `10 — ${this.l('Mahakarya (Masterpiece)', 'Masterpiece')}` },
          { value: '9', label: `9 — ${this.l('Hebat (Great)', 'Great')}` },
          { value: '8', label: `8 — ${this.l('Sangat Bagus (Very Good)', 'Very Good')}` },
          { value: '7', label: `7 — ${this.l('Bagus (Good)', 'Good')}` },
          { value: '6', label: `6 — ${this.l('Cukup Baik (Fine)', 'Fine')}` },
          { value: '5', label: `5 — ${this.l('Rata-rata (Average)', 'Average')}` },
          { value: '4', label: `4 — ${this.l('Kurang (Bad)', 'Bad')}` },
          { value: '3', label: `3 — ${this.l('Sangat Kurang (Very Bad)', 'Very Bad')}` },
          { value: '2', label: `2 — ${this.l('Mengerikan (Horrible)', 'Horrible')}` },
          { value: '1', label: `1 — ${this.l('Tak Tertolong (Appalling)', 'Appalling')}` },
          { value: '0', label: this.l('Belum Dinilai (No Score)', 'No Score') }
        ],
        String(activeScore),
        this.t('detail.malScoreLabel'),
        true
      )}
    </div>

    <!-- Footer: Aksi Aman dengan Pemisahan Destruktif -->
    <div class="v1-mal-footer">
      ${manga.malTracked ? `
        <button id="btnUnbindMalTracker" class="v1-mal-btn-danger" type="button" title="${escapeXml(this.l('Putuskan koneksi pelacakan komik ini dari MyAnimeList', 'Disconnect this comic from MyAnimeList'))}">
          ${this.t('detail.malUnlinkBtn')}
        </button>
      ` : '<div></div>'}
      <div class="v1-mal-footer-actions">
        ${manga.malTracked ? `
          <button id="btnSyncMalTracker" class="v1-mal-btn-secondary" type="button" title="${escapeXml(this.l('Sinkronkan data dari MyAnimeList', 'Sync data from MyAnimeList'))}">
            ${this.l('Sinkronkan', 'Sync')}
          </button>
        ` : ''}
        <button id="btnSaveMalTracker" class="v1-mal-btn-primary" type="button">
          ${this.t('modal.save')}
        </button>
      </div>
    </div>
  `;
}

export function bindMangaDetailEvents(this: YomicApp, manga: MangaItem): void {
  document.getElementById('btnBackFromDetail')?.addEventListener('click', () => {
    this.activeDetailMangaId = null;
    this.isChapterFilterFlyoutOpen = false;
    this.isMalTrackerPopupOpen = false;
    this.renderCurrentWorkspace(true);
  });
  document.getElementById('btnToggleInLibrary')?.addEventListener('click', () => {
    manga.inLibrary = !manga.inLibrary;
    this.updateSidebarCounters();
    if (this.bridge.isWebViewHost) {
      void this.bridge
        .invoke<MangaItem>('manga:toggle-library', {
          mangaId: manga.id,
          dbId: manga.dbId,
          sourceId: Number(manga.sourceId) || 0,
          url: manga.url
        })
        .then((updated) => {
          if (updated) this.upsertMangaItem(updated);
          this.updateSidebarCounters();
        });
    }
    this.showToast(
      manga.inLibrary
        ? this.l(`${manga.title} ditambahkan ke Pustaka.`, `${manga.title} added to Library.`)
        : this.l(`${manga.title} dihapus dari Pustaka.`, `${manga.title} removed from Library.`)
    );

    // In-place update for library button: preserves scroll position completely
    const libBtn = document.getElementById('btnToggleInLibrary');
    if (libBtn) {
      const svg = manga.inLibrary
        ? getIconSvg('bookmark-bold', { size: 26, color: 'var(--ocean-primary)' })
        : getIconSvg('bookmark', { size: 26 });
      libBtn.innerHTML = `${svg}<span>${manga.inLibrary ? this.l('Dalam Pustaka', 'In Library') : this.l('Tambah ke Pustaka', 'Add to Library')}</span>`;
      this.persistLocalCache();
    }
  });
  const executeMalSearch = async (query: string) => {
    const q = query.trim();
    if (!q) return;
    this.malSearchQuery = q;
    this.isMalSearching = true;
    this.malSearchError = '';
    this.renderCurrentWorkspace(true);

    try {
      const res = await this.bridge.invoke<{ ok: boolean; results?: MalSearchResult[]; error?: string }>('mal:search', {
        query: q
      });
      this.isMalSearching = false;
      if (res && res.ok && Array.isArray(res.results)) {
        this.malSearchResults = res.results;
        this.malSearchError = '';
      } else {
        this.malSearchResults = [];
        this.malSearchError = res?.error || this.l('Gagal mencari manga di MyAnimeList.', 'Failed to search manga on MyAnimeList.');
      }
    } catch (err: any) {
      this.isMalSearching = false;
      this.malSearchResults = [];
      this.malSearchError = err?.message || this.l('Terjadi kesalahan saat menghubungi MyAnimeList.', 'An error occurred while contacting MyAnimeList.');
    }
    this.renderCurrentWorkspace(true);
  };

  const handleSelectMalEntry = async (id: number, title: string, coverUrl?: string) => {
    this.malSelectedEntry = { id, title, coverUrl };
    this.isMalSearchMode = false;
    this.renderCurrentWorkspace(true);

    try {
      const res = await this.bridge.invoke<{
        ok: boolean;
        track?: {
          remoteId: number;
          title: string;
          status: string;
          score: number;
          lastChapterRead: number;
          totalChapters: number;
        };
      }>('mal:get-track', {
        mangaId: manga.id,
        remoteId: id
      });

      if (res && res.ok && res.track) {
        if (res.track.status) {
          manga.malStatus = res.track.status;
          setMalDropdownValue('malStatusSelect', res.track.status);
        }
        if (typeof res.track.lastChapterRead === 'number' && res.track.lastChapterRead > 0) {
          manga.lastReadChapter = Math.max(manga.lastReadChapter, res.track.lastChapterRead);
          const inp = document.getElementById('malChaptersReadInput') as HTMLInputElement | null;
          if (inp) inp.value = manga.lastReadChapter.toString();
        }
        if (typeof res.track.score === 'number' && res.track.score > 0) {
          manga.malScore = res.track.score;
          setMalDropdownValue('malScoreSelect', res.track.score.toString());
        }
      }
    } catch {
      // Keep defaults
    }
  };

  document.getElementById('btnOpenTrackerPopup')?.addEventListener('click', () => {
    this.isMalTrackerPopupOpen = true;
    if (this.settings.isMalConnected) {
      if (manga.malTracked && manga.malId && manga.malId > 0) {
        this.isMalSearchMode = false;
        this.malSelectedEntry = {
          id: manga.malId,
          title: manga.malTitle || manga.title
        };
      } else {
        this.isMalSearchMode = true;
        this.malSelectedEntry = null;
        this.malSearchQuery = cleanMangaTitleForMalSearch(manga.title);
        this.malSearchResults = [];
        this.malSearchError = '';
        if (this.malSearchQuery) {
          void executeMalSearch(this.malSearchQuery);
        }
      }
    }
    this.renderCurrentWorkspace(true);
  });

  document.getElementById('btnCloseMalTracker')?.addEventListener('click', () => {
    this.isMalTrackerPopupOpen = false;
    this.renderCurrentWorkspace(true);
  });

  document.getElementById('malTrackerModalBackdrop')?.addEventListener('click', (e) => {
    const backdrop = document.getElementById('malTrackerModalBackdrop');
    if (e.target === backdrop) {
      this.isMalTrackerPopupOpen = false;
      this.renderCurrentWorkspace(true);
      return;
    }

    const targetEl = e.target as HTMLElement | null;
    const trigger = targetEl?.closest('.v1-mal-dropdown-trigger') as HTMLButtonElement | null;
    if (trigger) {
      const dropdown = trigger.closest('.v1-mal-dropdown');
      const willOpen = !dropdown?.classList.contains('open');
      backdrop?.querySelectorAll('.v1-mal-dropdown.open').forEach((d) => {
        d.classList.remove('open');
        d.querySelector('.v1-mal-dropdown-trigger')?.setAttribute('aria-expanded', 'false');
      });
      if (dropdown && willOpen) {
        dropdown.classList.add('open');
        trigger.setAttribute('aria-expanded', 'true');
      }
      return;
    }

    const optionBtn = targetEl?.closest('.v1-mal-dropdown-option') as HTMLButtonElement | null;
    if (optionBtn) {
      const dropdown = optionBtn.closest('.v1-mal-dropdown') as HTMLElement | null;
      const targetId = dropdown?.dataset.dropdownFor;
      const val = optionBtn.dataset.value ?? '';
      if (targetId) {
        setMalDropdownValue(targetId, val);
      }
      dropdown?.classList.remove('open');
      dropdown?.querySelector('.v1-mal-dropdown-trigger')?.setAttribute('aria-expanded', 'false');
      return;
    }

    if (!targetEl?.closest('.v1-mal-dropdown')) {
      backdrop?.querySelectorAll('.v1-mal-dropdown.open').forEach((d) => {
        d.classList.remove('open');
        d.querySelector('.v1-mal-dropdown-trigger')?.setAttribute('aria-expanded', 'false');
      });
    }
  });

  document.getElementById('btnMalGoToSettings')?.addEventListener('click', () => {
    this.isMalTrackerPopupOpen = false;
    this.navigateToTab('settings');
    document.getElementById('settingsTrackerSection')?.scrollIntoView({ behavior: 'instant' as ScrollBehavior, block: 'center' });
  });

  document.getElementById('btnMalBackToEdit')?.addEventListener('click', () => {
    this.isMalSearchMode = false;
    this.renderCurrentWorkspace(true);
  });

  document.getElementById('btnMalChangeManga')?.addEventListener('click', () => {
    this.isMalSearchMode = true;
    if (!this.malSearchQuery) {
      this.malSearchQuery = cleanMangaTitleForMalSearch(manga.title);
    }
    this.renderCurrentWorkspace(true);
    if (this.malSearchResults.length === 0 && this.malSearchQuery) {
      void executeMalSearch(this.malSearchQuery);
    }
  });

  const searchInput = document.getElementById('malSearchQueryInput') as HTMLInputElement | null;
  const triggerSearch = () => {
    const q = searchInput?.value.trim() || '';
    if (q) {
      void executeMalSearch(q);
    }
  };

  document.getElementById('btnExecuteMalSearch')?.addEventListener('click', triggerSearch);
  document.getElementById('btnRetryMalSearch')?.addEventListener('click', triggerSearch);
  searchInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      triggerSearch();
    }
  });

  document.querySelectorAll<HTMLElement>('[data-select-mal-id]').forEach((el) => {
    el.addEventListener('click', (ev) => {
      ev.stopPropagation();
      const idStr = el.dataset.selectMalId;
      const title = el.dataset.selectMalTitle || '';
      const cover = el.dataset.selectMalCover || '';
      const malId = Number(idStr);
      if (!isNaN(malId) && malId > 0) {
        void handleSelectMalEntry(malId, title, cover);
      }
    });
  });

  document.getElementById('btnMalDecCh')?.addEventListener('click', () => {
    manga.lastReadChapter = Math.max(0, manga.lastReadChapter - 1);
    const inp = document.getElementById('malChaptersReadInput') as HTMLInputElement | null;
    if (inp) {
      inp.value = manga.lastReadChapter.toString();
    } else {
      this.renderCurrentWorkspace(true);
    }
  });

  document.getElementById('btnMalIncCh')?.addEventListener('click', () => {
    const next = manga.lastReadChapter + 1;
    manga.lastReadChapter = manga.totalChapters > 0 ? Math.min(manga.totalChapters, next) : next;
    const inp = document.getElementById('malChaptersReadInput') as HTMLInputElement | null;
    if (inp) {
      inp.value = manga.lastReadChapter.toString();
    } else {
      this.renderCurrentWorkspace(true);
    }
  });

  const malChInput = document.getElementById('malChaptersReadInput') as HTMLInputElement | null;
  malChInput?.addEventListener('input', () => {
    const digitsOnly = malChInput.value.replace(/[^\d]/g, '');
    if (digitsOnly === '') {
      malChInput.value = '';
      return;
    }
    const parsed = Number(digitsOnly);
    const clamped = manga.totalChapters > 0 ? Math.min(manga.totalChapters, Math.max(0, parsed)) : Math.max(0, parsed);
    manga.lastReadChapter = clamped;
    if (malChInput.value !== clamped.toString()) {
      malChInput.value = clamped.toString();
    }
  });
  malChInput?.addEventListener('blur', () => {
    if (malChInput.value.trim() === '') {
      malChInput.value = manga.lastReadChapter.toString();
    }
  });

  document.getElementById('btnSaveMalTracker')?.addEventListener('click', () => {
    const statusSel = document.getElementById('malStatusSelect') as HTMLSelectElement | null;
    const scoreSel = document.getElementById('malScoreSelect') as HTMLSelectElement | null;
    const statusVal = statusSel?.value || 'reading';
    const scoreVal = Number(scoreSel?.value || '0');
    const targetRemoteId = this.malSelectedEntry?.id || manga.malId || 0;
    const targetTitle = this.malSelectedEntry?.title || manga.malTitle || manga.title;

    if (!targetRemoteId || targetRemoteId <= 0) {
      this.showToast(this.l('Silakan pilih entri manga di MyAnimeList terlebih dahulu.', 'Please select a MyAnimeList manga entry first.'), 'warning');
      this.isMalSearchMode = true;
      this.renderCurrentWorkspace(true);
      return;
    }

    manga.malTracked = true;
    manga.malId = targetRemoteId;
    manga.malTitle = targetTitle;
    manga.malStatus = statusVal;
    manga.malScore = scoreVal;
    this.isMalTrackerPopupOpen = false;

    if (this.bridge.isWebViewHost) {
      void this.bridge.invoke('mal:save-track', {
        mangaId: manga.id,
        dbId: manga.dbId,
        remoteId: targetRemoteId,
        malTitle: targetTitle,
        status: statusVal,
        chaptersRead: manga.lastReadChapter,
        score: scoreVal
      });
    }

    this.persistLocalCache();
    this.showToast(this.l('Status pelacakan MyAnimeList berhasil disimpan.', 'MyAnimeList tracking status saved.'));
    this.renderCurrentWorkspace(true);
  });

  document.getElementById('btnSyncMalTracker')?.addEventListener('click', async () => {
    const targetRemoteId = manga.malId || this.malSelectedEntry?.id || 0;
    if (!targetRemoteId || targetRemoteId <= 0) {
      this.showToast(this.l('Komik belum ditautkan ke MyAnimeList.', 'Comic is not linked to MyAnimeList yet.'), 'warning');
      return;
    }

    this.showToast(this.l('Menyinkronkan data dengan MyAnimeList...', 'Syncing data with MyAnimeList...'), 'refresh');
    try {
      const res = await this.bridge.invoke<{
        ok: boolean;
        track?: {
          remoteId: number;
          title: string;
          status: string;
          score: number;
          lastChapterRead: number;
          totalChapters: number;
        };
      }>('mal:get-track', {
        mangaId: manga.id,
        remoteId: targetRemoteId
      });

      if (res && res.ok && res.track) {
        if (res.track.status) {
          manga.malStatus = res.track.status;
          setMalDropdownValue('malStatusSelect', res.track.status);
        }
        if (typeof res.track.lastChapterRead === 'number') {
          manga.lastReadChapter = Math.max(manga.lastReadChapter, res.track.lastChapterRead);
          const inp = document.getElementById('malChaptersReadInput') as HTMLInputElement | null;
          if (inp) inp.value = manga.lastReadChapter.toString();
        }
        if (typeof res.track.score === 'number') {
          manga.malScore = res.track.score;
          setMalDropdownValue('malScoreSelect', res.track.score.toString());
        }
        this.persistLocalCache();
        this.showToast(this.l('Berhasil menyinkronkan data dari MyAnimeList.', 'Successfully synced data from MyAnimeList.'));
      } else {
        this.showToast(this.l('Gagal menyinkronkan data dari MyAnimeList.', 'Failed to sync data from MyAnimeList.'), 'warning');
      }
    } catch {
      this.showToast(this.l('Gagal menyinkronkan data dari MyAnimeList.', 'Failed to sync data from MyAnimeList.'), 'warning');
    }
  });

  document.getElementById('btnUnbindMalTracker')?.addEventListener('click', () => {
    manga.malTracked = false;
    manga.malId = 0;
    manga.malTitle = '';
    manga.malStatus = 'reading';
    manga.malScore = 0;
    this.malSelectedEntry = null;
    this.isMalTrackerPopupOpen = false;

    if (this.bridge.isWebViewHost) {
      void this.bridge.invoke('mal:unbind-track', {
        mangaId: manga.id,
        dbId: manga.dbId
      });
    }

    this.persistLocalCache();
    this.showToast('Tautan MyAnimeList telah dilepas.');
    this.renderCurrentWorkspace(true);
  });
  document.getElementById('btnOpenWebViewSource')?.addEventListener('click', () => {
    const ext = this.extensions.find(
      (e) => e.id === manga.sourceId || String(e.sourceId) === String(manga.sourceId) || e.name === manga.sourceName
    );
    const targetUrl =
      manga.url && manga.url.startsWith('http')
        ? manga.url
        : ext?.baseUrl && manga.url
        ? `${ext.baseUrl.replace(/\/$/, '')}${manga.url.startsWith('/') ? '' : '/'}${manga.url}`
        : ext?.baseUrl || 'https://google.com';
    this.bridge.openExternalUrl(targetUrl);
    this.showToast(this.l(`Membuka halaman sumber ${manga.sourceName} di browser...`, `Opening ${manga.sourceName} source page in browser...`));
  });
  document.getElementById('btnRefreshMangaDetail')?.addEventListener('click', () => {
    this.showToast(this.l(`Menyegarkan daftar chapter ${manga.title}...`, `Refreshing chapter list for ${manga.title}...`));
    if (this.bridge.isWebViewHost) {
      void this.fetchMangaDetailFromBackend(manga.id, manga.url, manga.sourceId, true);
    }
  });
  document.getElementById('btnDownloadAllChapters')?.addEventListener('click', () => {
    manga.chapters.forEach((c) => {
      c.isDownloaded = true;
    });
    this.enqueueDownload(manga, manga.lastReadChapter, 'all');
    this.renderCurrentWorkspace(true);
  });
  document.getElementById('btnToggleSynopsis')?.addEventListener('click', () => {
    this.isSynopsisExpanded = !this.isSynopsisExpanded;
    const body = document.querySelector('.v1-synopsis-body');
    const btn = document.getElementById('btnToggleSynopsis');
    if (body && btn) {
      body.classList.toggle('collapsed', !this.isSynopsisExpanded);
      btn.title = this.isSynopsisExpanded ? this.l('Ciutkan Sinopsis', 'Collapse Synopsis') : this.l('Perluas Sinopsis', 'Expand Synopsis');
      btn.innerHTML = getIconSvg(this.isSynopsisExpanded ? 'chevron-up' : 'chevron-down', { size: 20 });
    } else {
      this.renderCurrentWorkspace(true);
    }
  });
  document.getElementById('btnToggleFilterFlyout')?.addEventListener('click', (ev) => {
    ev.stopPropagation();
    this.isChapterFilterFlyoutOpen = !this.isChapterFilterFlyoutOpen;
    this.renderCurrentWorkspace(true);
  });
  document.getElementById('btnDeleteAllDownloads')?.addEventListener('click', () => {
    manga.chapters.forEach((c) => {
      c.isDownloaded = false;
    });
    if (this.bridge.isWebViewHost) {
      void this.bridge.invoke('downloads:delete-manga', { mangaId: manga.id, dbId: manga.dbId });
    }
    this.showToast(this.l(`Seluruh unduhan chapter untuk ${manga.title} telah dihapus.`, `All chapter downloads for ${manga.title} deleted.`));
    this.renderCurrentWorkspace(true);
  });
  const container = document.getElementById('viewContainer');
  if (!container) return;
  container.querySelectorAll<HTMLButtonElement>('[data-ch-filter]').forEach((btn) => {
    btn.addEventListener('click', () => {
      this.detailChapterFilter = (btn.dataset.chFilter as 'all' | 'unread' | 'bookmarked') || 'all';
      this.isChapterFilterFlyoutOpen = false;
      this.renderCurrentWorkspace(true);
    });
  });
  document.getElementById('btnToggleChOrder')?.addEventListener('click', () => {
    this.detailChapterAsc = !this.detailChapterAsc;
    this.renderCurrentWorkspace(true);
  });

  // In-place bookmark toggle: never scrolls to top
  container.querySelectorAll<HTMLElement>('[data-toggle-bookmark]').forEach((btn) => {
    btn.addEventListener('click', (ev) => {
      ev.stopPropagation();
      const chNum = Number(btn.dataset.toggleBookmark);
      const found = manga.chapters.find((c) => c.number === chNum);
      if (found) {
        found.isBookmarked = !found.isBookmarked;
        if (this.bridge.isWebViewHost) {
          void this.bridge.invoke('manga:toggle-bookmark', {
            mangaId: manga.id,
            dbId: manga.dbId,
            chapterId: found.dbId,
            chapterNumber: chNum
          });
        }
        if (this.detailChapterFilter === 'bookmarked') {
          this.renderCurrentWorkspace(true);
          return;
        }
        btn.classList.toggle('bookmarked', found.isBookmarked);
        btn.title = found.isBookmarked ? this.l('Hapus Penanda', 'Remove Bookmark') : this.l('Tandai Chapter', 'Bookmark Chapter');
        btn.innerHTML = getIconSvg(found.isBookmarked ? 'bookmark-bold' : 'bookmark', {
          size: 18,
          color: found.isBookmarked ? 'var(--ocean-primary)' : 'currentColor'
        });
      }
    });
  });

  // In-place download action: never scrolls to top
  const setupDownloadAction = (btn: HTMLElement, chNum: number, isDownloaded: boolean) => {
    btn.onclick = (ev) => {
      ev.stopPropagation();
      const found = manga.chapters.find((c) => c.number === chNum);
      if (!found) return;
      if (isDownloaded) {
        found.isDownloaded = false;
        if (this.bridge.isWebViewHost) {
          void this.bridge.invoke('downloads:delete-chapter', {
            mangaId: manga.id,
            dbId: manga.dbId,
            chapterId: found.dbId,
            chapterNumber: chNum
          });
        }
        this.showToast(this.l(`Unduhan Chapter ${chNum} dihapus.`, `Chapter ${chNum} download deleted.`));
        this.updateSidebarCounters();
        btn.className = 'v1-ch-icon-btn';
        btn.title = this.l('Unduh Bab', 'Download Chapter');
        btn.setAttribute('aria-label', this.l('Unduh Bab', 'Download Chapter'));
        btn.innerHTML = getIconSvg('download-2-line', { size: 18 });
        setupDownloadAction(btn, chNum, false);
      } else {
        found.isDownloaded = true;
        this.enqueueDownload(manga, chNum, 'single');
        btn.className = 'v1-ch-icon-btn is-downloaded';
        btn.title = this.l('Tersimpan Offline (Klik untuk menghapus unduhan)', 'Saved Offline (Click to remove download)');
        btn.setAttribute('aria-label', this.l('Tersimpan Offline', 'Saved Offline'));
        btn.innerHTML = getIconSvg('download-done', { size: 18 });
        setupDownloadAction(btn, chNum, true);
      }
    };
  };
  container.querySelectorAll<HTMLElement>('[data-dl-single-ch]').forEach((btn) => {
    const chNum = Number(btn.dataset.dlSingleCh);
    setupDownloadAction(btn, chNum, false);
  });
  container.querySelectorAll<HTMLElement>('[data-del-single-ch]').forEach((btn) => {
    const chNum = Number(btn.dataset.delSingleCh);
    setupDownloadAction(btn, chNum, true);
  });
  // Chapter Context Menu & More Options (Tandai Sudah Dibaca / Belum Dibaca / Bab Sebelumnya)
  const hideChapterMenu = () => {
    const existing = document.getElementById('chapterContextMenu');
    if (existing) {
      existing.remove();
    }
  };

  const showChapterMenu = (chNum: number, clientX: number, clientY: number) => {
    hideChapterMenu();
    const ch = manga.chapters.find((c) => Math.abs(c.number - chNum) < 0.01);
    if (!ch) return;

    const menu = document.createElement('div');
    menu.id = 'chapterContextMenu';
    menu.className = 'v1-context-menu v1-chapter-ctx-menu open';

    const isRead = !!ch.isRead;
    menu.innerHTML = `
      ${
        !isRead
          ? `<button class="v1-ctx-item" data-action="mark-read">
               ${getIconSvg('check-line', { size: 16 })}
               <span>${this.l('Tandai Sudah Dibaca', 'Mark as Read')}</span>
             </button>`
          : `<button class="v1-ctx-item" data-action="mark-unread">
               ${getIconSvg('eye-off-line', { size: 16 })}
               <span>${this.l('Tandai Belum Dibaca', 'Mark as Unread')}</span>
             </button>`
      }
      <button class="v1-ctx-item" data-action="mark-before-read">
        ${getIconSvg('check-double-line', { size: 16 })}
        <span>${this.l('Tandai Bab Sebelumnya Sudah Dibaca', 'Mark Previous Chapters as Read')}</span>
      </button>
    `;

    document.body.appendChild(menu);

    // Position menu safely within viewport bounds
    const menuWidth = 250;
    const menuHeight = 76;
    let posX = clientX;
    let posY = clientY;
    if (posX + menuWidth > window.innerWidth - 10) {
      posX = Math.max(10, clientX - menuWidth);
    }
    if (posY + menuHeight > window.innerHeight - 10) {
      posY = Math.max(10, clientY - menuHeight);
    }
    menu.style.left = `${posX}px`;
    menu.style.top = `${posY}px`;

    menu.querySelectorAll<HTMLButtonElement>('[data-action]').forEach((actionBtn) => {
      actionBtn.addEventListener('click', (ev) => {
        ev.stopPropagation();
        const action = actionBtn.dataset.action;
        hideChapterMenu();

        if (action === 'mark-read') {
          ch.isRead = true;
          manga.unreadCount = Math.max(0, manga.unreadCount - 1);
          manga.lastViewedEpoch = Date.now();
          this.readingStatsData = null;
          const row = container.querySelector<HTMLElement>(`[data-read-ch="${ch.number}"]`);
          row?.classList.add('is-read');
          row?.querySelector('.v1-ch-new-pill')?.remove();
          if (this.bridge.isWebViewHost) {
            void this.bridge.invoke('manga:mark-chapters', {
              mangaId: manga.id,
              mode: 'single-read',
              chapterNumber: ch.number,
              chapterUrl: ch.url,
              mangaUrl: manga.url,
              sourceId: manga.sourceId
            });
          }
          this.showToast(this.l(`Chapter ${ch.number} ditandai sudah dibaca.`, `Chapter ${ch.number} marked as read.`));
          this.updateSidebarCounters();
        } else if (action === 'mark-unread') {
          ch.isRead = false;
          manga.unreadCount++;
          if (manga.unreadCount >= Math.max(manga.totalChapters || 0, manga.chapters.length)) {
            manga.lastViewedEpoch = 0;
          }
          this.readingStatsData = null;
          const row = container.querySelector<HTMLElement>(`[data-read-ch="${ch.number}"]`);
          row?.classList.remove('is-read');
          if (this.bridge.isWebViewHost) {
            void this.bridge.invoke('manga:mark-chapters', {
              mangaId: manga.id,
              mode: 'single-unread',
              chapterNumber: ch.number,
              chapterUrl: ch.url,
              mangaUrl: manga.url,
              sourceId: manga.sourceId
            });
          }
          this.showToast(this.l(`Chapter ${ch.number} ditandai belum dibaca.`, `Chapter ${ch.number} marked as unread.`));
          this.updateSidebarCounters();
        } else if (action === 'mark-before-read') {
          const prevChapters = manga.chapters.filter((c) => c.number < ch.number && !c.isRead);
          prevChapters.forEach((c) => {
            c.isRead = true;
            const r = container.querySelector<HTMLElement>(`[data-read-ch="${c.number}"]`);
            r?.classList.add('is-read');
            r?.querySelector('.v1-ch-new-pill')?.remove();
          });
          manga.unreadCount = manga.chapters.filter((c) => !c.isRead).length;
          if (prevChapters.length > 0) {
            manga.lastViewedEpoch = Date.now();
          }
          this.readingStatsData = null;
          if (this.bridge.isWebViewHost) {
            void this.bridge.invoke('manga:mark-chapters', {
              mangaId: manga.id,
              mode: 'before-read',
              chapterNumber: ch.number,
              mangaUrl: manga.url,
              sourceId: manga.sourceId
            });
          }
          this.showToast(this.l(`Seluruh bab sebelum Chapter ${ch.number} ditandai sudah dibaca.`, `All chapters before Chapter ${ch.number} marked as read.`));
          this.updateSidebarCounters();
        }
      });
    });
  };

  // Close context menu on outside clicks / escape with single active listener
  const onGlobalClick = (ev: MouseEvent) => {
    const menu = document.getElementById('chapterContextMenu');
    if (menu && !menu.contains(ev.target as Node)) {
      hideChapterMenu();
    }
  };
  const onGlobalKeyDown = (ev: KeyboardEvent) => {
    if (ev.key === 'Escape') {
      hideChapterMenu();
    }
  };
  const win = window as unknown as { _onChapterCtxClick?: (ev: MouseEvent) => void; _onChapterCtxKey?: (ev: KeyboardEvent) => void };
  if (win._onChapterCtxClick) window.removeEventListener('click', win._onChapterCtxClick);
  if (win._onChapterCtxKey) window.removeEventListener('keydown', win._onChapterCtxKey);
  win._onChapterCtxClick = onGlobalClick;
  win._onChapterCtxKey = onGlobalKeyDown;
  window.addEventListener('click', onGlobalClick);
  window.addEventListener('keydown', onGlobalKeyDown);

  // Chapter row click to open reader
  container.querySelectorAll<HTMLElement>('[data-read-ch]').forEach((el) => {
    el.addEventListener('click', (ev) => {
      // Ignore if user clicked on one of the action buttons inside
      if ((ev.target as HTMLElement).closest('.v1-ch-icon-btn, button')) {
        return;
      }
      const chNum = Number(el.dataset.readCh);
      if (!Number.isNaN(chNum)) {
        this.openReader(manga.id, chNum);
      }
    });

    // Right-click contextmenu on chapter row
    el.addEventListener('contextmenu', (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      const chNum = Number(el.dataset.readCh);
      if (!Number.isNaN(chNum)) {
        showChapterMenu(chNum, ev.clientX, ev.clientY);
      }
    });
  });

  // More options button (•••) click
  container.querySelectorAll<HTMLElement>('[data-ch-more]').forEach((btn) => {
    btn.addEventListener('click', (ev) => {
      ev.stopPropagation();
      const chNum = Number(btn.dataset.chMore);
      if (!Number.isNaN(chNum)) {
        const rect = btn.getBoundingClientRect();
        showChapterMenu(chNum, rect.right, rect.bottom + 4);
      }
    });
  });

  this.bindCommonCardTriggers(container);
}
