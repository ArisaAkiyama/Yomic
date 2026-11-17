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
 * 4. DOWNLOADS VIEW (MINIMALIST YOMIC V1 MIRROR — DownloadsView.axaml)
 * ========================================================================= */

/**
 * Updates download progress in-place on existing DOM elements without destroying and recreating the view.
 * Returns true if in-place update succeeded, false if a full re-render is required.
 */
export function updateDownloadsProgressInPlace(container: HTMLElement, downloads: DownloadQueueItem[]): boolean {
  const dlList = container.querySelector('.v1-dl-list');
  if (!dlList) return false;

  const rows = dlList.querySelectorAll<HTMLElement>('.v1-update-row');
  if (rows.length !== downloads.length) return false;

  for (let i = 0; i < downloads.length; i++) {
    const dl = downloads[i];
    const row = rows[i];
    const cancelBtn = row.querySelector<HTMLButtonElement>('[data-cancel-dl]');
    if (!cancelBtn || cancelBtn.dataset.cancelDl !== dl.id) return false;

    // Check if completion status flipped
    const isDone = dl.status === 'completed';
    const wasDone = cancelBtn.dataset.isDone === '1';
    if (isDone !== wasDone) return false;

    // If active / paused, update progress bar & status text without touching DOM nodes
    if (!isDone) {
      const isPaused = dl.status === 'paused';
      const fill = row.querySelector<HTMLElement>('.v1-dl-bar-fill');
      if (fill) {
        fill.style.width = `${dl.progressPercent}%`;
        fill.className = `v1-dl-bar-fill ${isPaused ? 'paused' : ''}`;
      }
      const isEn = document.documentElement.lang === 'en';
      const timeSpan = row.querySelector<HTMLElement>('.v1-dl-progress-box .v1-update-time');
      if (timeSpan) {
        timeSpan.textContent = isPaused ? (isEn ? `Paused (${dl.progressPercent}%)` : `Dijeda (${dl.progressPercent}%)`) : `${dl.progressPercent}% · ${dl.speedText}`;
      }
      const toggleBtn = row.querySelector<HTMLButtonElement>('[data-toggle-dl]');
      if (toggleBtn) {
        const toggleTitle = isPaused ? (isEn ? 'Resume Download' : 'Lanjutkan Unduhan') : (isEn ? 'Pause Download' : 'Jeda Unduhan');
        toggleBtn.title = toggleTitle;
        toggleBtn.setAttribute('aria-label', toggleTitle);
        toggleBtn.innerHTML = getIconSvg(isPaused ? 'play-linear' : 'pause-linear', { size: 15 });
      }
    }
  }

  // Update header count badge
  const headerCount = container.querySelector('.v1-lib-count-inline');
  if (headerCount) {
    headerCount.textContent = `(${downloads.length})`;
  }

  return true;
}

export function renderDownloadsView(this: YomicApp, container: HTMLElement): void {
  this.setTopbarHeader(this.t('downloads.title'));

  const hasPaused = this.downloads.some((d) => d.status === 'paused');
  const hasActive = this.downloads.some((d) => d.status === 'downloading' || d.status === 'queued');
  const hasCompleted = this.downloads.some((d) => d.status === 'completed');

  const queueHtml =
    this.downloads.length === 0
      ? `
      <div class="empty-state-box">
        <div class="empty-state-icon-wrap">
          ${getIconSvg('download-2-line', { size: 48 })}
        </div>
        <div class="empty-state-title">${this.t('downloads.emptyTitle')}</div>
        <div class="empty-state-desc">${this.t('downloads.emptyDesc')}</div>
        <button id="btnGoToLibraryFromDl" class="empty-state-btn primary">${this.l('Buka Pustaka', 'Open Library')}</button>
      </div>`
      : `
      <div class="v1-dl-list">
        ${this.downloads
          .map((dl) => {
            const manga = this.mangaList.find((m) => m.id === dl.mangaId);
            const fallbackSvg = buildMangaCoverSvg(
              manga ||
                ({
                  id: dl.mangaId,
                  title: dl.mangaTitle,
                  sourceName: dl.sourceName
                } as MangaItem)
            );
            const thumb = dl.coverUrl || (manga ? this.getMangaCoverHtmlSrc(manga) : fallbackSvg);
            const isDone = dl.status === 'completed';
            const isPaused = dl.status === 'paused';
            const stateClass = isDone ? 'completed' : isPaused ? 'paused' : '';

            // Accurate chapter number calculation (preserves decimals like 137.5, handles non-English labels)
            const chapterNum =
              typeof dl.chapterNumber === 'number' && dl.chapterNumber > 0
                ? dl.chapterNumber
                : (() => {
                    const match = dl.chapterLabel.match(/(\d+(\.\d+)?)/);
                    return match ? parseFloat(match[1]) : 1;
                  })();

            const escapedMangaTitle = escapeXml(dl.mangaTitle);
            const escapedChLabel = escapeXml(dl.chapterLabel);
            const sizeLabel = dl.sizeText && dl.sizeText !== 'Tersimpan' ? `${escapeXml(dl.sizeText)} · ` : '';

            return `
              <div class="v1-update-row">
                <div class="v1-update-left" data-open-detail="${dl.mangaId}">
                  <img class="v1-update-cover" src="${thumb}" alt="${escapedMangaTitle}" loading="lazy" onerror="this.onerror=null;this.src='${fallbackSvg}';" />
                  <div class="v1-update-info">
                    <div class="v1-update-title" title="${escapedMangaTitle}">${escapedMangaTitle}</div>
                    <div class="v1-update-ch-line">
                      <span class="v1-update-ch-num tabular-nums">${escapedChLabel}</span>
                      <span class="v1-update-ch-sep">·</span>
                      ${this.buildSourceFaviconHtml(dl.sourceName, undefined, 13)}
                    </div>
                  </div>
                </div>
                <div class="v1-update-right">
                  ${
                    isDone
                      ? `<span class="v1-update-time tabular-nums">${sizeLabel}${this.l('Tersimpan', 'Saved')}</span>
                         <button class="v1-update-action-btn primary" data-quick-read="${dl.mangaId}" data-ch="${chapterNum}" title="${escapeXml(this.t('common.read') + ' ' + dl.chapterLabel)}">
                           ${getIconSvg('play-linear', { size: 13 })}
                           <span>${this.t('common.read')}</span>
                         </button>`
                      : `<div class="v1-dl-progress-box">
                           <div class="v1-dl-bar-track">
                             <div class="v1-dl-bar-fill ${stateClass}" style="width:${dl.progressPercent}%;"></div>
                           </div>
                           <span class="v1-update-time tabular-nums">${isPaused ? `${this.t('downloads.statusPaused')} (${dl.progressPercent}%)` : `${dl.progressPercent}% · ${dl.speedText}`}</span>
                         </div>
                         <button class="v1-dl-icon-btn" data-toggle-dl="${dl.id}" title="${escapeXml(isPaused ? this.l('Lanjutkan Unduhan', 'Resume Download') : this.l('Jeda Unduhan', 'Pause Download'))}" aria-label="${escapeXml(isPaused ? this.l('Lanjutkan Unduhan', 'Resume Download') : this.l('Jeda Unduhan', 'Pause Download'))}">
                           ${getIconSvg(isPaused ? 'play-linear' : 'pause-linear', { size: 15 })}
                         </button>`
                  }
                  <button class="v1-history-del-btn" data-cancel-dl="${dl.id}" data-url="${dl.chapterUrl || ''}" data-is-done="${isDone ? '1' : '0'}" data-title="${escapedMangaTitle}" data-chapter="${escapedChLabel}" title="${escapeXml(isDone ? this.l('Hapus File Unduhan', 'Delete Downloaded File') : this.l('Batalkan Unduhan', 'Cancel Download'))}" aria-label="${escapeXml(isDone ? this.l('Hapus File Unduhan', 'Delete Downloaded File') : this.l('Batalkan Unduhan', 'Cancel Download'))}">
                    ${getIconSvg('delete-bin-line', { size: 16 })}
                  </button>
                </div>
              </div>`;
          })
          .join('')}
      </div>`;

  container.innerHTML = `
    <div class="v1-page-header">
      <div class="v1-page-header-bar">
        <div class="v1-page-header-left">
          ${getIconSvg('download-2-line', { size: 24 })}
          <span class="v1-lib-title-text">${this.t('downloads.title')}</span>
          <span class="v1-lib-count-inline tabular-nums">(${this.downloads.length})</span>
        </div>
        <div class="v1-lib-actions">
          ${
            hasPaused
              ? `<button id="btnResumeAllDl" class="v1-lib-action-btn success" title="${this.l('Lanjutkan Semua Unduhan yang Dijeda', 'Resume All Paused Downloads')}" aria-label="${this.l('Lanjutkan Semua', 'Resume All')}">
                   ${getIconSvg('play-linear', { size: 18 })}
                 </button>`
              : ''
          }
          ${
            hasActive
              ? `<button id="btnPauseAllDl" class="v1-lib-action-btn" title="${this.l('Jeda Semua Unduhan Aktif', 'Pause All Active Downloads')}" aria-label="${this.l('Jeda Semua', 'Pause All')}">
                   ${getIconSvg('pause-fill', { size: 18 })}
                 </button>`
              : ''
          }
          ${
            hasCompleted
              ? `<button id="btnClearCompletedDl" class="v1-lib-action-btn hazard" title="${this.l('Bersihkan Daftar Unduhan Selesai', 'Clear Completed Downloads List')}" aria-label="${this.l('Bersihkan Unduhan Selesai', 'Clear Completed Downloads')}">
                   ${getIconSvg('delete-bin-line', { size: 18 })}
                 </button>`
              : ''
          }
        </div>
      </div>
    </div>
    ${queueHtml}
  `;

  document.getElementById('btnGoToLibraryFromDl')?.addEventListener('click', () => {
    this.navigateToTab('library');
  });

  document.getElementById('btnResumeAllDl')?.addEventListener('click', () => {
    if (this.bridge.isWebViewHost) {
      void this.bridge.invoke<DownloadQueueItem[]>('downloads:resume-all').then((queue) => {
        if (Array.isArray(queue)) {
          this.downloads.length = 0;
          this.downloads.push(...queue);
          this.renderDownloadsView(container);
        }
      });
    } else {
      this.downloads.forEach((d) => {
        if (d.status === 'paused') {
          d.status = 'downloading';
          d.speedText = '4.8 MB/s';
        }
      });
      this.renderDownloadsView(container);
    }
    this.showToast(this.l('Seluruh unduhan dilanjutkan.', 'All downloads resumed.'));
  });

  document.getElementById('btnPauseAllDl')?.addEventListener('click', () => {
    if (this.bridge.isWebViewHost) {
      void this.bridge.invoke<DownloadQueueItem[]>('downloads:pause-all').then((queue) => {
        if (Array.isArray(queue)) {
          this.downloads.length = 0;
          this.downloads.push(...queue);
          this.renderDownloadsView(container);
        }
      });
    } else {
      this.downloads.forEach((d) => {
        if (d.status === 'downloading') {
          d.status = 'paused';
          d.speedText = this.t('downloads.statusPaused');
        }
      });
      this.renderDownloadsView(container);
    }
    this.showToast(this.l('Seluruh unduhan aktif telah dijeda.', 'All active downloads paused.'));
  });

  document.getElementById('btnClearCompletedDl')?.addEventListener('click', async () => {
    const completedCount = this.downloads.filter((d) => d.status === 'completed').length;
    if (completedCount === 0) {
      this.showToast(this.l('Tidak ada unduhan selesai untuk dibersihkan.', 'No completed downloads to clear.'));
      return;
    }
    const confirmed = await this.showConfirmModal({
      title: this.l('Bersihkan Daftar Unduhan', 'Clear Download List'),
      message: this.l(
        `Apakah Anda benar-benar yakin ingin membersihkan ${completedCount} daftar unduhan selesai? File yang tersimpan di komputer Anda akan tetap aman.`,
        `Are you sure you want to clear ${completedCount} completed download entries? Files saved on your computer will remain safe.`
      ),
      confirmText: this.l('Konfirmasi Bersihkan', 'Confirm Clear'),
      cancelText: this.t('modal.cancel'),
      isDanger: true,
      icon: 'danger-triangle-linear',
      confirmIcon: 'trash-bin-trash-linear'
    });
    if (!confirmed) return;

    if (this.bridge.isWebViewHost) {
      void this.bridge.invoke<DownloadQueueItem[]>('downloads:clear-completed').then((queue) => {
        if (Array.isArray(queue)) {
          this.downloads.length = 0;
          this.downloads.push(...queue);
          this.updateSidebarCounters();
          this.renderDownloadsView(container);
        }
      });
    } else {
      for (let i = this.downloads.length - 1; i >= 0; i--) {
        if (this.downloads[i].status === 'completed') {
          this.downloads.splice(i, 1);
        }
      }
      this.updateSidebarCounters();
      this.renderDownloadsView(container);
    }
    this.showToast(this.l('Daftar unduhan selesai telah dibersihkan.', 'Completed downloads list cleared.'));
  });

  container.querySelectorAll<HTMLButtonElement>('[data-toggle-dl]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const dlId = btn.dataset.toggleDl;
      if (!dlId) return;
      if (this.bridge.isWebViewHost) {
        void this.bridge.invoke<DownloadQueueItem[]>('downloads:toggle-pause', { id: dlId }).then((queue) => {
          if (Array.isArray(queue)) {
            this.downloads.length = 0;
            this.downloads.push(...queue);
            this.renderDownloadsView(container);
          }
        });
        return;
      }
      const dl = this.downloads.find((d) => d.id === dlId);
      if (dl) {
        dl.status = dl.status === 'paused' ? 'downloading' : 'paused';
        dl.speedText = dl.status === 'paused' ? this.l('Dijeda', 'Paused') : '4.6 MB/s';
        this.renderDownloadsView(container);
      }
    });
  });

  container.querySelectorAll<HTMLButtonElement>('[data-cancel-dl]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const dlId = btn.dataset.cancelDl;
      if (!dlId) return;
      const isDone = btn.dataset.isDone === '1';
      const mangaTitle = btn.dataset.title || this.l('Komik', 'Comic');
      const chLabel = btn.dataset.chapter || this.l('Bab', 'Chapter');
      const chapterUrl = btn.dataset.url || '';

      if (isDone) {
        const confirmed = await this.showConfirmModal({
          title: this.l('Hapus File Unduhan', 'Delete Downloaded File'),
          message: this.l(
            `Apakah Anda benar-benar yakin ingin menghapus file unduhan untuk "${mangaTitle} - ${chLabel}"? Tindakan ini tidak dapat dibatalkan dan file fisik pada hard disk akan dibersihkan.`,
            `Are you sure you want to delete the downloaded file for "${mangaTitle} - ${chLabel}"? This action cannot be undone and the file on disk will be removed.`
          ),
          confirmText: this.l('Konfirmasi Hapus', 'Confirm Delete'),
          cancelText: this.t('modal.cancel'),
          isDanger: true,
          icon: 'danger-triangle-linear',
          confirmIcon: 'trash-bin-trash-linear'
        });
        if (!confirmed) return;
      }

      if (this.bridge.isWebViewHost) {
        void this.bridge.invoke<DownloadQueueItem[]>('downloads:cancel', { id: dlId, chapterUrl }).then((queue) => {
          if (Array.isArray(queue)) {
            this.downloads.length = 0;
            this.downloads.push(...queue);
            this.updateSidebarCounters();
            this.renderDownloadsView(container);
          }
        });
        this.showToast(
          isDone
            ? this.l('File unduhan berhasil dihapus dari komputer.', 'Downloaded file deleted from disk.')
            : this.l('Item unduhan dibatalkan dari antrean.', 'Download item cancelled from queue.')
        );
        return;
      }
      const idx = this.downloads.findIndex((d) => d.id === dlId);
      if (idx >= 0) {
        this.downloads.splice(idx, 1);
        this.renderDownloadsView(container);
        this.showToast(
          isDone
            ? this.l('File unduhan berhasil dihapus.', 'Downloaded file deleted.')
            : this.l('Item unduhan dibatalkan dari antrean.', 'Download item cancelled from queue.')
        );
      }
    });
  });

  this.bindCommonCardTriggers(container);
}

export function enqueueDownload(
  this: YomicApp,
  manga: MangaItem,
  chapterNumber: number,
  mode: 'single' | 'all' = 'single'
): void {
  if (this.bridge.isWebViewHost) {
    const ch = manga.chapters.find((c) => c.number === chapterNumber);
    void this.bridge
      .invoke<DownloadQueueItem[]>('downloads:enqueue', {
        mangaId: manga.id,
        dbId: manga.dbId,
        sourceId: Number(manga.sourceId) || 0,
        url: manga.url,
        chapterId: ch?.dbId,
        chapterNumber,
        chapterUrl: ch?.url,
        mode
      })
      .then((queue) => {
        if (Array.isArray(queue)) {
          this.downloads.length = 0;
          this.downloads.push(...queue);
          this.updateSidebarCounters();
        }
      });
    this.showToast(
      mode === 'all'
        ? this.l(`Menambahkan seluruh bab ${manga.title} ke antrean unduhan...`, `Adding all chapters of ${manga.title} to download queue...`)
        : this.l(`Mengunduh ${manga.title} Chapter ${chapterNumber}...`, `Downloading ${manga.title} Chapter ${chapterNumber}...`)
    );
    return;
  }
  const newId = `dl-${Date.now()}`;
  this.downloads.unshift({
    id: newId,
    mangaId: manga.id,
    mangaTitle: manga.title,
    chapterLabel: `Chapter ${chapterNumber}`,
    sourceName: manga.sourceName,
    progressPercent: 12,
    speedText: '5.1 MB/s',
    sizeText: '2.4 / 20.0 MB',
    status: 'downloading'
  });
  this.updateSidebarCounters();
  this.showToast(`Mengunduh ${manga.title} Chapter ${chapterNumber}...`);
}

export function startDownloadProgressTicker(this: YomicApp): void {
  // Never run fake progress simulation if connected to WebView2 desktop backend
  if (this.bridge.isWebViewHost) return;

  window.setInterval(() => {
    if (this.bridge.isWebViewHost) return;
    let changed = false;
    for (const dl of this.downloads) {
      if (dl.status === 'downloading' && dl.progressPercent < 100) {
        dl.progressPercent = Math.min(100, dl.progressPercent + 4);
        if (dl.progressPercent >= 100) {
          dl.status = 'completed';
          dl.speedText = 'Tersimpan';
        }
        changed = true;
      }
    }
    if (changed && this.currentTab === 'downloads' && !this.activeDetailMangaId) {
      const container = document.getElementById('viewContainer');
      if (container) {
        const inPlaceUpdated = updateDownloadsProgressInPlace(container, this.downloads);
        if (!inPlaceUpdated) {
          this.renderDownloadsView(container);
        }
      }
      this.updateSidebarCounters();
    }
  }, 1800);
}
