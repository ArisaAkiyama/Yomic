import type { YomicApp } from '../app.js';
import { getIconSvg } from '../icons.js';
import { escapeXml } from '../mock-data.js';
import { ExtensionItem } from '../types.js';
import { isAdultExtension } from './browse.js';

export function renderExtensionsView(this: YomicApp, container: HTMLElement): void {
  this.setTopbarHeader(this.t('nav.extensions'));

  const filteredExts = this.extensions
    .filter((e) => {
      if (!this.settings.showNsfw && (e.isNsfw || isAdultExtension(e))) return false;
      const isMangaDex = e.id.toLowerCase().includes('mangadex') || e.name.toLowerCase().includes('mangadex');
      const extLang = (e.lang || 'ALL').toUpperCase();
      if (this.extensionLangFilter !== 'ALL' && extLang !== this.extensionLangFilter && extLang !== 'ALL' && !isMangaDex) {
        return false;
      }
      if (this.extensionSearchQuery) {
        const q = this.extensionSearchQuery.toLowerCase();
        return e.name.toLowerCase().includes(q) || (e.baseUrl && e.baseUrl.toLowerCase().includes(q));
      }
      return true;
    })
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));

  const installedExts = filteredExts.filter((e) => e.installed);
  const availableExts = filteredExts.filter((e) => !e.installed);
  const isFiltered = this.extensionSearchQuery.trim() !== '' || this.extensionLangFilter !== 'ALL';
  const checkSvg = getIconSvg('check', { size: 13, strokeWidth: 2.5 });

  const buildExtRow = (ext: ExtensionItem): string => {
    const dlPct = this.downloadingExtProgress.get(ext.id);
    const isDownloading = dlPct !== undefined;
    let rightActionsHtml = '';
    if (isDownloading) {
      rightActionsHtml = `
        <div class="v1-ext-dl-progress">
          <div class="v1-ext-dl-bar">
            <div class="v1-ext-dl-fill" style="width:${dlPct}%;"></div>
          </div>
          <span class="tabular-nums" style="font-size:11.5px;font-weight:700;color:var(--ocean-primary);">${dlPct}%</span>
        </div>`;
    } else if (ext.installed) {
      rightActionsHtml = `
        ${
          ext.hasUpdate
            ? `<button class="v1-ext-pill-btn update" data-update-ext="${escapeXml(ext.id)}" title="${escapeXml(this.l('Perbarui ke versi terbaru', 'Update to latest version'))}" aria-label="${escapeXml(this.t('extensions.update'))}">
                 ${getIconSvg('refresh-line', { size: 13 })}
                 <span>${this.t('extensions.update')}</span>
               </button>`
            : ''
        }
        <button class="v1-ext-icon-btn uninstall" data-toggle-ext="${escapeXml(ext.id)}" title="${escapeXml(this.t('extensions.uninstall'))}" aria-label="${escapeXml(this.t('extensions.uninstall'))}">
          ${getIconSvg('delete-bin-line', { size: 16 })}
        </button>`;
    } else {
      rightActionsHtml = `
        <button class="v1-ext-pill-btn install" data-install-ext="${escapeXml(ext.id)}" title="${escapeXml(this.t('extensions.install'))}" aria-label="${escapeXml(this.t('extensions.install'))}">
          ${getIconSvg('download-2-line', { size: 13 })}
          <span>${this.t('extensions.install')}</span>
        </button>`;
    }
    return `
      <div class="v1-ext-row" data-ext-id="${escapeXml(ext.id)}">
        ${this.buildSourceLogoHtml(ext)}
        <div class="v1-source-info">
          <div class="v1-ext-title-row">
            <span class="v1-source-name">${escapeXml(ext.name)}</span>
            ${ext.isNsfw ? '<span class="v1-ext-badge-nsfw">18+</span>' : ''}
          </div>
          <div class="v1-ext-sub tabular-nums">${escapeXml(ext.version)}</div>
        </div>
        <div class="v1-ext-actions">
          ${rightActionsHtml}
        </div>
      </div>`;
  };

  let listContentHtml = '';
  if (filteredExts.length === 0) {
    listContentHtml = `
      <div class="empty-state-box">
        <div class="empty-state-icon-wrap">
          ${getIconSvg('widget-2-linear', { size: 48 })}
        </div>
        <div class="empty-state-title">${isFiltered ? this.t('extensions.emptyTitle') : this.l('Belum Ada Ekstensi', 'No Extensions Available')}</div>
        <div class="empty-state-desc">${
          isFiltered
            ? this.t('extensions.emptyDesc')
            : this.l('Belum ada ekstensi yang tersedia di repositori saat ini.', 'No extensions are currently available in the repository.')
        }</div>
        ${
          isFiltered
            ? `<button id="btnResetExtFilter" class="empty-state-btn">
                 ${getIconSvg('refresh-line', { size: 14 })}
                 <span>${this.l('Atur Ulang Pencarian', 'Reset Search')}</span>
               </button>`
            : `<button id="btnRefreshExtRepo" class="empty-state-btn primary">
                 ${getIconSvg('refresh-line', { size: 14 })}
                 <span>${this.t('extensions.refreshRepo')}</span>
               </button>`
        }
      </div>`;
  } else {
    listContentHtml = `
      ${
        installedExts.length > 0
          ? `
        <div class="v1-ext-section" data-section-type="installed">
          <div class="v1-ext-section-head">
            <span class="v1-ext-section-title">${this.t('extensions.filterInstalled')}</span>
            <span class="v1-ext-section-count tabular-nums">${installedExts.length}</span>
          </div>
          <div class="v1-ext-group">
            ${installedExts.map((ext) => buildExtRow(ext)).join('')}
          </div>
        </div>`
          : ''
      }
      ${
        availableExts.length > 0
          ? `
        <div class="v1-ext-section" data-section-type="available">
          <div class="v1-ext-section-head">
            <span class="v1-ext-section-title">${this.t('extensions.filterAvailable')}</span>
            <span class="v1-ext-section-count tabular-nums">${availableExts.length}</span>
          </div>
          <div class="v1-ext-group">
            ${availableExts.map((ext) => buildExtRow(ext)).join('')}
          </div>
        </div>`
          : installedExts.length > 0 && !isFiltered
          ? `
        <div class="v1-ext-all-installed-note" style="display:flex;align-items:center;justify-content:center;gap:8px;padding:28px 0 16px 0;color:var(--ink-muted);font-size:12.5px;">
          ${getIconSvg('check-circle-linear', { size: 16, color: '#0066CC' })}
          <span>${this.l('Semua ekstensi dari repositori telah terpasang.', 'All extensions from the repository are installed.')}</span>
        </div>`
          : ''
      }
    `;
  }

  // Floating Sync Pill if refresh is active
  let syncPillHtml = '';
  if (this.extVerificationProgress.active) {
    syncPillHtml = `
      <div id="extSyncPill" class="v1-sync-pill open">
        <div class="v1-sync-pill-top">
          <span>${this.l('Memeriksa Repositori Ekstensi...', 'Checking Extension Repository...')}</span>
          <span class="tabular-nums" style="color:var(--ocean-primary); font-weight:700;">${this.l('Sinkronisasi', 'Syncing')}</span>
        </div>
        <div class="v1-sync-track">
          <div class="empty-state-progress-fill" style="width: 100%; height: 100%; background: var(--ocean-primary); border-radius: 2px; animation: extPulse 1.2s infinite ease-in-out;"></div>
        </div>
      </div>
    `;
  }

  container.innerHTML = `
    <!-- Header: 3D Cube Icon + "Ekstensi" (ExtensionsView.axaml L347-363) -->
    <div class="v1-lib-top">
      <div class="v1-lib-master-bar">
        <div class="v1-lib-title-group">
          <div class="v1-lib-title-row">
            ${getIconSvg('widget-2-linear', { size: 24 })}
            <span class="v1-lib-title-text">${this.t('nav.extensions')}</span>
            <span class="v1-lib-count-inline tabular-nums">(${filteredExts.length})</span>
          </div>
        </div>
        <div class="v1-lib-actions">
          <!-- 1. Morphing Animated Expandable Search -->
          <div id="extExpandSearch" class="v1-expand-search ${this.isExtensionSearchOpen || this.extensionSearchQuery ? 'open' : ''}">
            <button id="btnToggleExtSearch" class="v1-expand-search-icon-btn" title="${escapeXml(this.t('extensions.searchPlaceholder'))}" aria-label="${escapeXml(this.t('extensions.searchPlaceholder'))}">
              ${getIconSvg('search-line', { size: 18 })}
            </button>
            <input id="extSearchInput" class="v1-expand-search-input" type="text" placeholder="${escapeXml(this.t('extensions.searchPlaceholder'))}" value="${escapeXml(this.extensionSearchQuery)}" autocomplete="off" />
            <button id="btnClearExtSearch" class="v1-expand-search-clear-btn" title="${escapeXml(this.t('modal.close'))}" aria-label="${escapeXml(this.t('modal.close'))}">
              ${getIconSvg('close-line', { size: 13 })}
            </button>
          </div>
          <!-- 2. Refresh Extensions & Check Updates -->
          <button id="btnRefreshExtensions" class="v1-lib-action-btn ${this.extVerificationProgress.active ? 'is-disabled' : ''}" title="${escapeXml(this.extVerificationProgress.active ? this.l('Sedang Memeriksa...', 'Checking...') : this.t('extensions.refreshRepo'))}" aria-label="${escapeXml(this.t('extensions.refreshRepo'))}" ${this.extVerificationProgress.active ? 'disabled' : ''}>
            ${getIconSvg('refresh-line', { size: 18 })}
          </button>
          <!-- 3. Filter Languages Flyout -->
          <button id="btnExtLangFlyout" class="v1-lib-action-btn ${this.isExtensionLangFlyoutOpen ? 'active' : ''} ${this.extensionLangFilter !== 'ALL' ? 'has-filter' : ''}" title="${escapeXml(this.l('Filter Bahasa', 'Language Filter'))}" aria-label="${escapeXml(this.l('Filter Bahasa', 'Language Filter'))}">
            ${getIconSvg('filter', { size: 18 })}
          </button>
          <div id="extLangFlyoutMenu" class="v1-lib-flyout ${this.isExtensionLangFlyoutOpen ? 'open' : ''}">
            <div class="v1-flyout-section-label">${this.l('Filter Bahasa', 'Language Filter')}</div>
            <button class="v1-lib-flyout-item ${this.extensionLangFilter === 'ALL' ? 'selected' : ''}" data-ext-lang="ALL">
              <span class="v1-lib-flyout-check">${this.extensionLangFilter === 'ALL' ? checkSvg : ''}</span>
              ${this.buildLangBadgeHtml('ALL')}
              <span>${this.l('Tampilkan Semua', 'Show All')}</span>
            </button>
            <button class="v1-lib-flyout-item ${this.extensionLangFilter === 'ID' ? 'selected' : ''}" data-ext-lang="ID">
              <span class="v1-lib-flyout-check">${this.extensionLangFilter === 'ID' ? checkSvg : ''}</span>
              ${this.buildLangBadgeHtml('ID')}
              <span>${this.l('Bahasa Indonesia', 'Indonesian')}</span>
            </button>
            <button class="v1-lib-flyout-item ${this.extensionLangFilter === 'EN' ? 'selected' : ''}" data-ext-lang="EN">
              <span class="v1-lib-flyout-check">${this.extensionLangFilter === 'EN' ? checkSvg : ''}</span>
              ${this.buildLangBadgeHtml('EN')}
              <span>English</span>
            </button>
          </div>
        </div>
      </div>
    </div>
    ${listContentHtml}
    ${syncPillHtml}
  `;

  // In-Place Search Filtering (60 FPS without DOM rebuild or cursor jumps)
  const extSearchInput = document.getElementById('extSearchInput') as HTMLInputElement | null;
  const filterExtRowsInPlace = () => {
    const q = (extSearchInput?.value ?? '').trim().toLowerCase();
    this.extensionSearchQuery = extSearchInput?.value ?? '';
    const rows = container.querySelectorAll<HTMLElement>('.v1-ext-row');
    let visibleInstalled = 0;
    let visibleAvailable = 0;

    rows.forEach((row) => {
      const name = (row.querySelector('.v1-source-name')?.textContent ?? '').toLowerCase();
      const matches = !q || name.includes(q);
      row.style.display = matches ? '' : 'none';
      if (matches) {
        const sec = row.closest('.v1-ext-section');
        if (sec?.getAttribute('data-section-type') === 'installed') {
          visibleInstalled++;
        } else {
          visibleAvailable++;
        }
      }
    });

    // Update section counts & visibility
    container.querySelectorAll<HTMLElement>('.v1-ext-section').forEach((sec) => {
      const isInstalled = sec.getAttribute('data-section-type') === 'installed';
      const count = isInstalled ? visibleInstalled : visibleAvailable;
      const countEl = sec.querySelector('.v1-ext-section-count');
      if (countEl) countEl.textContent = count.toString();
      sec.style.display = count === 0 && q ? 'none' : '';
    });

    // Update total counter in header
    const totalVisible = visibleInstalled + visibleAvailable;
    const headerCountEl = container.querySelector('.v1-lib-count-inline');
    if (headerCountEl) headerCountEl.textContent = `(${totalVisible})`;

    // Search empty state
    let emptyBox = container.querySelector<HTMLElement>('.v1-ext-search-empty');
    if (totalVisible === 0 && rows.length > 0) {
      if (!emptyBox) {
        const newEmpty = document.createElement('div');
        newEmpty.className = 'empty-state-box v1-ext-search-empty';
        newEmpty.style.padding = '36px 0';
        newEmpty.innerHTML = `
          <div class="empty-state-icon-wrap">${getIconSvg('search', { size: 36 })}</div>
          <div class="empty-state-title">${this.t('extensions.emptyTitle')}</div>
          <div class="empty-state-desc">${this.l(`Tidak ada ekstensi yang cocok dengan kata kunci "${escapeXml(q)}".`, `No extensions match "${escapeXml(q)}".`)}</div>
        `;
        container.appendChild(newEmpty);
      } else {
        emptyBox.style.display = '';
        const desc = emptyBox.querySelector('.empty-state-desc');
        if (desc) desc.textContent = this.l(`Tidak ada ekstensi yang cocok dengan kata kunci "${q}".`, `No extensions match "${q}".`);
      }
    } else if (emptyBox) {
      emptyBox.style.display = 'none';
    }
  };

  document.getElementById('btnToggleExtSearch')?.addEventListener('click', (ev) => {
    ev.stopPropagation();
    const box = document.getElementById('extExpandSearch');
    const input = document.getElementById('extSearchInput') as HTMLInputElement | null;
    this.isExtensionSearchOpen = !this.isExtensionSearchOpen;
    if (this.isExtensionSearchOpen) {
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
      if (this.extensionSearchQuery) {
        this.extensionSearchQuery = '';
        if (input) input.value = '';
        filterExtRowsInPlace();
      }
    }
  });

  extSearchInput?.addEventListener('input', () => {
    filterExtRowsInPlace();
  });

  extSearchInput?.addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape') {
      ev.preventDefault();
      const box = document.getElementById('extExpandSearch');
      this.isExtensionSearchOpen = false;
      this.extensionSearchQuery = '';
      if (extSearchInput) extSearchInput.value = '';
      box?.classList.remove('animating', 'open');
      extSearchInput?.blur();
      filterExtRowsInPlace();
    }
  });

  document.getElementById('btnClearExtSearch')?.addEventListener('click', (ev) => {
    ev.stopPropagation();
    const box = document.getElementById('extExpandSearch');
    const input = document.getElementById('extSearchInput') as HTMLInputElement | null;
    this.extensionSearchQuery = '';
    this.isExtensionSearchOpen = false;
    if (input) input.value = '';
    box?.classList.remove('animating', 'open');
    input?.blur();
    filterExtRowsInPlace();
  });

  document.getElementById('btnResetExtFilter')?.addEventListener('click', (ev) => {
    ev.stopPropagation();
    this.extensionSearchQuery = '';
    this.extensionLangFilter = 'ALL';
    this.isExtensionSearchOpen = false;
    this.renderExtensionsView(container);
  });

  // Non-destructive refresh: keep extensions visible and show floating sync pill
  const refreshExtensionsAction = () => {
    if (this.extVerificationProgress.active) return;
    this.extVerificationProgress = { active: true, current: 0, total: 1 };

    const btn = document.getElementById('btnRefreshExtensions');
    if (btn) {
      btn.classList.add('is-disabled');
      btn.setAttribute('disabled', 'true');
      btn.title = this.l('Sedang Memeriksa...', 'Checking...');
    }

    let pill = document.getElementById('extSyncPill');
    if (!pill) {
      pill = document.createElement('div');
      pill.id = 'extSyncPill';
      pill.className = 'v1-sync-pill open';
      pill.innerHTML = `
        <div class="v1-sync-pill-top">
          <span>${this.l('Memeriksa Repositori Ekstensi...', 'Checking Extension Repository...')}</span>
          <span class="tabular-nums" style="color:var(--ocean-primary); font-weight:700;">${this.l('Sinkronisasi', 'Syncing')}</span>
        </div>
        <div class="v1-sync-track">
          <div class="empty-state-progress-fill" style="width: 100%; height: 100%; background: var(--ocean-primary); border-radius: 2px; animation: extPulse 1.2s infinite ease-in-out;"></div>
        </div>
      `;
      container.appendChild(pill);
    }

    const finishRefresh = (list?: ExtensionItem[]) => {
      if (Array.isArray(list) && list.length > 0) {
        this.extensions.length = 0;
        this.extensions.push(...list);
      }
      setTimeout(() => {
        this.extVerificationProgress.active = false;
        const curPill = document.getElementById('extSyncPill');
        if (curPill) curPill.remove();
        if (this.currentTab === 'extensions') {
          this.renderExtensionsView(container);
        }
        this.showToast(this.l('Daftar repositori ekstensi berhasil diperbarui.', 'Extension repository list updated.'));
      }, 300);
    };

    if (this.bridge.isWebViewHost) {
      void this.bridge
        .invoke<ExtensionItem[]>('ext:list', { refreshRemote: true }, 30000)
        .then((list) => {
          finishRefresh(list);
        })
        .catch(() => {
          finishRefresh();
        });
    } else {
      setTimeout(() => {
        finishRefresh();
      }, 1200);
    }
  };

  document.getElementById('btnRefreshExtRepo')?.addEventListener('click', refreshExtensionsAction);
  document.getElementById('btnRefreshExtensions')?.addEventListener('click', refreshExtensionsAction);

  // Language Filter Flyout Menu & Click-Outside Listener
  const flyout = document.getElementById('extLangFlyoutMenu');
  const btnFlyout = document.getElementById('btnExtLangFlyout');
  btnFlyout?.addEventListener('click', (ev) => {
    ev.stopPropagation();
    this.isExtensionLangFlyoutOpen = !this.isExtensionLangFlyoutOpen;
    flyout?.classList.toggle('open', this.isExtensionLangFlyoutOpen);
    btnFlyout.classList.toggle('active', this.isExtensionLangFlyoutOpen);
  });
  flyout?.addEventListener('click', (ev) => {
    ev.stopPropagation();
  });
  const onDocClick = (ev: MouseEvent) => {
    if (this.isExtensionLangFlyoutOpen) {
      const target = ev.target as Node | null;
      if (flyout && !flyout.contains(target) && btnFlyout && !btnFlyout.contains(target)) {
        this.isExtensionLangFlyoutOpen = false;
        flyout.classList.remove('open');
        btnFlyout?.classList.remove('active');
      }
    }
  };
  document.addEventListener('click', onDocClick);

  container.querySelectorAll<HTMLButtonElement>('[data-ext-lang]').forEach((btn) => {
    btn.addEventListener('click', () => {
      this.extensionLangFilter = (btn.dataset.extLang as 'ALL' | 'ID' | 'EN') || 'ALL';
      this.isExtensionLangFlyoutOpen = false;
      this.renderExtensionsView(container);
    });
  });

  container.querySelectorAll<HTMLButtonElement>('[data-update-ext]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const ext = this.extensions.find((e) => e.id === btn.dataset.updateExt);
      if (!ext) return;
      if (this.bridge.isWebViewHost) {
        void this.bridge
          .invoke<ExtensionItem[]>('ext:update', { id: ext.id, pkg: ext.pkg || ext.id }, 30000)
          .then((list) => {
            if (Array.isArray(list) && list.length > 0) {
              this.extensions.length = 0;
              this.extensions.push(...list);
            } else {
              ext.hasUpdate = false;
            }
            if (this.currentTab === 'extensions') this.renderExtensionsView(container);
            this.showToast(this.l(`Ekstensi ${ext.name} berhasil diperbarui.`, `Extension ${ext.name} updated.`));
          });
        return;
      }
      ext.hasUpdate = false;
      ext.version = 'v2.2.0';
      this.renderExtensionsView(container);
      this.showToast(this.l(`Ekstensi ${ext.name} berhasil diperbarui ke ${ext.version}.`, `Extension ${ext.name} updated to ${ext.version}.`));
    });
  });

  // Safe Uninstallation with Modern Confirm Modal Dialog
  container.querySelectorAll<HTMLButtonElement>('[data-toggle-ext]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const ext = this.extensions.find((e) => e.id === btn.dataset.toggleExt);
      if (!ext) return;

      const confirmed = await this.showConfirmModal({
        title: this.l('Copot Ekstensi', 'Uninstall Extension'),
        message: this.l(
          `Apakah Anda yakin ingin mencopot ekstensi "${ext.name}"? File plugin fisik pada komputer akan dihapus dan komik dari sumber ini tidak dapat diperbarui sampai ekstensi dipasang kembali.`,
          `Are you sure you want to uninstall "${ext.name}"? The plugin file on disk will be deleted and comics from this source cannot be updated until reinstalled.`
        ),
        confirmText: this.l('Copot Ekstensi', 'Uninstall'),
        cancelText: this.t('modal.cancel'),
        isDanger: true,
        icon: 'danger-triangle-linear',
        confirmIcon: 'trash-bin-trash-linear'
      });
      if (!confirmed) return;

      if (this.bridge.isWebViewHost) {
        void this.bridge
          .invoke<ExtensionItem[]>('ext:uninstall', { id: ext.id, pkg: ext.pkg || ext.id }, 30000)
          .then((list) => {
            if (Array.isArray(list) && list.length > 0) {
              this.extensions.length = 0;
              this.extensions.push(...list);
            } else {
              ext.installed = false;
            }
            if (this.currentTab === 'extensions') this.renderExtensionsView(container);
            this.showToast(this.l(`Ekstensi ${ext.name} telah dicopot.`, `Extension ${ext.name} uninstalled.`));
          });
        return;
      }
      ext.installed = false;
      this.renderExtensionsView(container);
      this.showToast(this.l(`Ekstensi ${ext.name} telah dicopot.`, `Extension ${ext.name} uninstalled.`));
    });
  });

  container.querySelectorAll<HTMLButtonElement>('[data-install-ext]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const ext = this.extensions.find((e) => e.id === btn.dataset.installExt);
      if (!ext || this.downloadingExtProgress.has(ext.id)) return;
      this.downloadingExtProgress.set(ext.id, 35);
      this.renderExtensionsView(container);
      if (this.bridge.isWebViewHost) {
        void this.bridge
          .invoke<ExtensionItem[]>('ext:install', { id: ext.id, pkg: ext.pkg || ext.id }, 30000)
          .then((list) => {
            this.downloadingExtProgress.delete(ext.id);
            if (Array.isArray(list) && list.length > 0) {
              this.extensions.length = 0;
              this.extensions.push(...list);
            } else {
              ext.installed = true;
            }
            const current = this.extensions.find((e) => e.id === ext.id || e.pkg === ext.pkg);
            if (current && current.installed) {
              this.showToast(this.l(`Ekstensi ${ext.name} berhasil dipasang.`, `Extension ${ext.name} installed.`));
            } else {
              this.showToast(this.l(`Gagal memasang ekstensi ${ext.name}.`, `Failed to install extension ${ext.name}.`));
            }
            if (this.currentTab === 'extensions') this.renderExtensionsView(container);
          });
        return;
      }
      window.setTimeout(() => {
        this.downloadingExtProgress.set(ext.id, 85);
        if (this.currentTab === 'extensions') this.renderExtensionsView(container);
      }, 180);
      window.setTimeout(() => {
        this.downloadingExtProgress.delete(ext.id);
        ext.installed = true;
        if (this.currentTab === 'extensions') this.renderExtensionsView(container);
        this.showToast(this.l(`Ekstensi ${ext.name} berhasil dipasang.`, `Extension ${ext.name} installed.`));
      }, 380);
    });
  });
}
