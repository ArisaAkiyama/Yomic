import type { YomicApp } from '../app.js';
import { getIconSvg, SOLAR_PATHS, icons } from '../icons.js';
import { applyStaticDomTranslations, TranslationKey } from '../i18n.js';
import {
  buildComicPageSvg,
  buildMangaCoverSvg,
  DEFAULT_APP_SETTINGS,
  DEFAULT_HOTKEYS,
  HOTKEY_DEFINITIONS,
  escapeXml
} from '../mock-data.js';
import {
  ActivityUpdateItem,
  AppSettingsState,
  ChapterItem,
  DownloadQueueItem,
  ExtensionItem,
  HotkeyDefinition,
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
 * 7. SETTINGS VIEW (MIRROR OF YOMIC V1 SettingsView.axaml — SINGLE SCROLL)
 * ========================================================================= */

export function renderSettingsView(this: YomicApp, container: HTMLElement): void {
  const isReRender = Boolean(container.querySelector('.v1-settings-page'));
  const savedContainerScroll = isReRender ? container.scrollTop : 0;
  const savedParentScroll = isReRender && container.parentElement ? container.parentElement.scrollTop : 0;
  this.setTopbarHeader(this.t('settings.title'));

  const formatHotkeyBadgeHtml = (hotkeyStr: string): string => {
    if (!hotkeyStr) return `<span class="v1-hotkey-empty">${this.settings.appLanguage === 'en' ? 'Unbound' : 'Belum diatur'}</span>`;
    const parts = hotkeyStr.split('+');
    return parts
      .map((p) => {
        let display = p;
        const isEn = this.settings.appLanguage === 'en';
        if (p.toLowerCase() === 'arrowright') display = isEn ? '→ Right' : '→ Kanan';
        else if (p.toLowerCase() === 'arrowleft') display = isEn ? '← Left' : '← Kiri';
        else if (p.toLowerCase() === 'arrowup') display = isEn ? '↑ Up' : '↑ Atas';
        else if (p.toLowerCase() === 'arrowdown') display = isEn ? '↓ Down' : '↓ Bawah';
        else if (p.toLowerCase() === 'space') display = isEn ? 'Space' : 'Spasi';
        else if (p.length === 1) display = p.toUpperCase();
        return `<kbd class="v1-hotkey-badge">${escapeXml(display)}</kbd>`;
      })
      .join('<span class="v1-hotkey-plus">+</span>');
  };

  const renderHotkeyItem = (def: HotkeyDefinition): string => {
    const currentKey = this.getEffectiveHotkey(def.id);
    const isCustom = Boolean(this.settings.customHotkeys && this.settings.customHotkeys[def.id]);
    const labelText = this.t(`hotkey.${def.id}.label` as TranslationKey) || def.label;
    const descText = this.t(`hotkey.${def.id}.desc` as TranslationKey) || def.description;
    return `
      <div class="v1-setting-row v1-hotkey-row" data-hotkey-action="${def.id}">
        <div class="v1-setting-info">
          <div class="v1-setting-title-row">
            <span class="v1-setting-title">${escapeXml(labelText)}</span>
            ${isCustom ? `<span class="v1-hotkey-custom-tag">${this.settings.appLanguage === 'en' ? 'Custom' : 'Kustom'}</span>` : ''}
          </div>
          <span class="v1-setting-desc">${escapeXml(descText)}</span>
        </div>
        <div class="v1-hotkey-controls">
          <button class="v1-hotkey-bind-btn" data-rebind-action="${def.id}" title="${escapeXml(currentKey)}" aria-label="${escapeXml(labelText)}">
            <span class="v1-hotkey-display">${formatHotkeyBadgeHtml(currentKey)}</span>
          </button>
          ${
            isCustom
              ? `<button class="v1-hotkey-reset-btn" data-reset-hotkey="${def.id}" title="${escapeXml(this.t('settings.hotkeys.resetTooltip', { key: def.defaultKey }))}" aria-label="${escapeXml(this.t('settings.hotkeys.resetTooltip', { key: def.defaultKey }))}">
                  ${getIconSvg('restart-linear', { size: 14 })}
                 </button>`
              : ''
          }
        </div>
      </div>
    `;
  };

  const readerHotkeysHtml = HOTKEY_DEFINITIONS.filter((d) => d.category === 'reader')
    .map(renderHotkeyItem)
    .join('');

  const globalHotkeysHtml = HOTKEY_DEFINITIONS.filter((d) => d.category === 'global')
    .map(renderHotkeyItem)
    .join('');

  const renderSettingDropdown = (
    id: string,
    options: { value: string; label: string }[],
    selectedValue: string,
    ariaLabel: string
  ): string => {
    const activeOption = options.find((opt) => opt.value === selectedValue) || options[0];
    return `
      <div class="v1-mal-dropdown v1-setting-dropdown" data-dropdown-for="${escapeXml(id)}">
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
                </button>
              `;
            })
            .join('')}
        </div>
      </div>
    `;
  };

  container.innerHTML = `
    <div class="v1-settings-page">
      <!-- Header: Settings Icon + Title -->
      <div class="v1-lib-top" style="margin-bottom:4px;">
        <div class="v1-lib-title-row">
          ${getIconSvg('settings-3-line', { size: 24 })}
          <span class="v1-lib-title-text">${this.t('settings.title')}</span>
        </div>
      </div>
      <!-- 1. TAMPILAN & PEMBACA -->
      <section class="v1-settings-section">
        <div class="v1-settings-sec-head">
          <h2 class="v1-settings-sec-title">${this.t('settings.tab.appearance')}</h2>
        </div>
        <div class="v1-settings-group">
          <div class="v1-setting-row">
            <div class="v1-setting-info">
              <div class="v1-setting-title-row">
                <span class="v1-setting-title">${this.t('settings.appearance.languageTitle')}</span>
              </div>
              <span class="v1-setting-desc">${this.t('settings.appearance.languageDesc')}</span>
            </div>
            ${renderSettingDropdown(
              'selAppLanguage',
              [
                { value: 'id', label: this.t('settings.appearance.languageId') },
                { value: 'en', label: this.t('settings.appearance.languageEn') }
              ],
              this.settings.appLanguage === 'en' ? 'en' : 'id',
              this.t('settings.appearance.languageTitle')
            )}
          </div>
          <div class="v1-setting-row">
            <div class="v1-setting-info">
              <div class="v1-setting-title-row">
                <span class="v1-setting-title">${this.t('settings.appearance.readerModeTitle')}</span>
              </div>
              <span class="v1-setting-desc">${this.t('settings.appearance.readerModeDesc')}</span>
            </div>
            ${renderSettingDropdown(
              'selDefaultReaderMode',
              [
                { value: 'webtoon', label: this.t('settings.appearance.readerModeWebtoon') },
                { value: 'single', label: this.t('settings.appearance.readerModeSingle') },
                { value: 'dual', label: this.t('settings.appearance.readerModeDual') }
              ],
              this.settings.defaultReaderMode || 'webtoon',
              this.t('settings.appearance.readerModeTitle')
            )}
          </div>
          <div class="v1-setting-row">
            <div class="v1-setting-info">
              <div class="v1-setting-title-row">
                <span class="v1-setting-title">${this.t('settings.appearance.directionTitle')}</span>
              </div>
              <span class="v1-setting-desc">${this.t('settings.appearance.directionDesc')}</span>
            </div>
            ${renderSettingDropdown(
              'selReadingDirection',
              [
                { value: 'ltr', label: this.t('settings.appearance.directionLtr') },
                { value: 'rtl', label: this.t('settings.appearance.directionRtl') }
              ],
              this.settings.readingDirection || 'ltr',
              this.t('settings.appearance.directionTitle')
            )}
          </div>
          <div class="v1-setting-row">
            <div class="v1-setting-info">
              <div class="v1-setting-title-row">
                <span class="v1-setting-title">${this.t('settings.appearance.fitModeTitle')}</span>
              </div>
              <span class="v1-setting-desc">${this.t('settings.appearance.fitModeDesc')}</span>
            </div>
            ${renderSettingDropdown(
              'selReaderFitMode',
              [
                { value: 'fit-width', label: this.t('settings.appearance.fitWidth') },
                { value: 'fit-height', label: this.t('settings.appearance.fitHeight') },
                { value: 'original', label: this.t('settings.appearance.fitOriginal') }
              ],
              this.settings.readerFitMode || 'fit-width',
              this.t('settings.appearance.fitModeTitle')
            )}
          </div>
          <div class="v1-setting-row">
            <div class="v1-setting-info">
              <div class="v1-setting-title-row">
                <span class="v1-setting-title">${this.t('settings.appearance.darkModeTitle')}</span>
              </div>
              <span class="v1-setting-desc">${this.t('settings.appearance.darkModeDesc')}</span>
            </div>
            <div class="toggle-switch ${this.settings.isDarkMode ? 'on' : ''}" data-toggle-setting="isDarkMode" role="switch" aria-checked="${this.settings.isDarkMode}">
              <div class="toggle-thumb"></div>
            </div>
          </div>
          <!-- Fitur Asli Yomic v1: Preload Next Chapter -->
          <div class="v1-setting-row">
            <div class="v1-setting-info">
              <div class="v1-setting-title-row">
                <span class="v1-setting-title">${this.t('settings.appearance.preloadTitle')}</span>
              </div>
              <span class="v1-setting-desc">${this.t('settings.appearance.preloadDesc')}</span>
            </div>
            <div class="toggle-switch ${this.settings.preloadNextChapter ? 'on' : ''}" data-toggle-setting="preloadNextChapter" role="switch" aria-checked="${this.settings.preloadNextChapter}">
              <div class="toggle-thumb"></div>
            </div>
          </div>
          <!-- Fitur Asli Yomic v1: Auto Download Next Chapter -->
          <div class="v1-setting-row">
            <div class="v1-setting-info">
              <div class="v1-setting-title-row">
                <span class="v1-setting-title">${this.t('settings.appearance.autoDownloadTitle')}</span>
              </div>
              <span class="v1-setting-desc">${this.t('settings.appearance.autoDownloadDesc')}</span>
            </div>
            <div class="toggle-switch ${this.settings.autoDownloadNextChapter ? 'on' : ''}" data-toggle-setting="autoDownloadNextChapter" role="switch" aria-checked="${this.settings.autoDownloadNextChapter}">
              <div class="toggle-thumb"></div>
            </div>
          </div>
          <!-- Fitur Asli Yomic v1: Skip Filtered Chapters -->
          <div class="v1-setting-row">
            <div class="v1-setting-info">
              <div class="v1-setting-title-row">
                <span class="v1-setting-title">${this.t('settings.library.skipFilteredTitle')}</span>
              </div>
              <span class="v1-setting-desc">${this.t('settings.library.skipFilteredDesc')}</span>
            </div>
            <div class="toggle-switch ${this.settings.skipFilteredChapters ? 'on' : ''}" data-toggle-setting="skipFilteredChapters" role="switch" aria-checked="${this.settings.skipFilteredChapters}">
              <div class="toggle-thumb"></div>
            </div>
          </div>
          <!-- Fitur Asli Yomic v1: Max Reader Cache Size -->
          <div class="v1-setting-row">
            <div class="v1-setting-info">
              <div class="v1-setting-title-row">
                <span class="v1-setting-title">${this.t('settings.storage.maxCacheTitle')}</span>
              </div>
              <span class="v1-setting-desc">${this.t('settings.storage.maxCacheDesc')}</span>
            </div>
            ${renderSettingDropdown(
              'selMaxReaderCacheSize',
              [
                { value: '250MB', label: '250 MB' },
                { value: '500MB', label: '500 MB' },
                { value: '1GB', label: '1 GB' },
                { value: '2GB', label: '2 GB' }
              ],
              this.settings.maxReaderCacheSize || '500MB',
              this.t('settings.storage.maxCacheTitle')
            )}
          </div>
          <!-- Fitur Asli Yomic v1: Show Unread Badges -->
          <div class="v1-setting-row">
            <div class="v1-setting-info">
              <div class="v1-setting-title-row">
                <span class="v1-setting-title">${this.t('settings.library.unreadBadgeTitle')}</span>
              </div>
              <span class="v1-setting-desc">${this.t('settings.library.unreadBadgeDesc')}</span>
            </div>
            <div class="toggle-switch ${this.settings.showUnreadBadges ? 'on' : ''}" data-toggle-setting="showUnreadBadges" role="switch" aria-checked="${this.settings.showUnreadBadges}">
              <div class="toggle-thumb"></div>
            </div>
          </div>
          <div class="v1-setting-row">
            <div class="v1-setting-info">
              <div class="v1-setting-title-row">
                <span class="v1-setting-title">${this.t('settings.library.showNsfwTitle')}</span>
              </div>
              <span class="v1-setting-desc">${this.t('settings.library.showNsfwDesc')}</span>
            </div>
            <div class="toggle-switch ${this.settings.showNsfw ? 'on' : ''}" data-toggle-setting="showNsfw" role="switch" aria-checked="${this.settings.showNsfw}">
              <div class="toggle-thumb"></div>
            </div>
          </div>
          <div class="v1-setting-row">
            <div class="v1-setting-info">
              <div class="v1-setting-title-row">
                <span class="v1-setting-title">${this.t('settings.library.blurNsfwTitle')}</span>
              </div>
              <span class="v1-setting-desc">${this.t('settings.library.blurNsfwDesc')}</span>
            </div>
            <div class="toggle-switch ${this.settings.blurExplicitCovers ? 'on' : ''}" data-toggle-setting="blurExplicitCovers" role="switch" aria-checked="${this.settings.blurExplicitCovers}">
              <div class="toggle-thumb"></div>
            </div>
          </div>
          <div class="v1-setting-row">
            <div class="v1-setting-info">
              <div class="v1-setting-title-row">
                <span class="v1-setting-title">${this.settings.appLanguage === 'en' ? 'Refresh Library Covers' : 'Segarkan Sampul Pustaka'}</span>
              </div>
              <span class="v1-setting-desc">${this.settings.appLanguage === 'en' ? 'Reload all comic cover images in your Library from their original sources.' : 'Muat ulang seluruh gambar sampul (cover) komik di Pustaka dari sumber aslinya.'}</span>
            </div>
            <button id="btnRefreshLibraryCovers" class="v1-setting-btn">${this.t('common.refresh')}</button>
          </div>
        </div>
      </section>
      <!-- 2. PEMROSESAN & KUALITAS GAMBAR (SKIASHARP) -->
      <section class="v1-settings-section">
        <div class="v1-settings-sec-head">
          <h2 class="v1-settings-sec-title">${this.t('settings.appearance.imageHeaderTitle')}</h2>
        </div>
        <div class="v1-settings-group">
          <!-- 1. Smart Image Optimization -->
          <div class="v1-setting-row">
            <div class="v1-setting-info">
              <div class="v1-setting-title-row">
                <span class="v1-setting-title">${this.t('settings.appearance.smartOptTitle')}</span>
              </div>
              <span class="v1-setting-desc">${this.t('settings.appearance.smartOptDesc')}</span>
            </div>
            <div class="toggle-switch ${this.settings.enableImageOptimization ? 'on' : ''}" data-toggle-setting="enableImageOptimization" role="switch" aria-checked="${this.settings.enableImageOptimization}">
              <div class="toggle-thumb"></div>
            </div>
          </div>
          <!-- 2. Max Image Dimension -->
          <div class="v1-setting-row">
            <div class="v1-setting-info">
              <div class="v1-setting-title-row">
                <span class="v1-setting-title">${this.t('settings.appearance.maxResTitle')}</span>
              </div>
              <span class="v1-setting-desc">${this.t('settings.appearance.maxResDesc')}</span>
            </div>
            ${renderSettingDropdown(
              'selMaxImageDimension',
              [
                { value: '1600', label: `1600 px (${this.settings.appLanguage === 'en' ? 'Memory Saver' : 'Hemat Memori'})` },
                { value: '2160', label: this.t('settings.appearance.maxRes2160') },
                { value: '2880', label: this.t('settings.appearance.maxRes2880') },
                { value: '0', label: this.t('settings.appearance.maxRes0') }
              ],
              String(this.settings.maxImageDimension ?? 2160),
              this.t('settings.appearance.maxResTitle')
            )}
          </div>
        </div>
      </section>
      <!-- 2. PINTASAN KEYBOARD (HOTKEYS) -->
      <section class="v1-settings-section">
        <div class="v1-settings-sec-head" style="display:flex; justify-content:space-between; align-items:center; width:100%;">
          <div style="display:flex; align-items:center; gap:8px;">
            <h2 class="v1-settings-sec-title">${this.t('settings.hotkeys.headerTitle')}</h2>
          </div>
          <button id="btnResetAllHotkeys" class="v1-setting-btn blue-soft" style="font-size:12px; height:28px; padding:0 12px; gap:6px; display:${this.hasCustomHotkeys() ? 'inline-flex' : 'none'}; align-items:center;" title="${escapeXml(this.t('settings.hotkeys.resetAll'))}">
            ${getIconSvg('restart-linear', { size: 14 })}
            <span>${this.t('settings.hotkeys.resetAll')}</span>
          </button>
        </div>
        <div class="v1-settings-group">
          <div class="v1-hotkey-group-header">
            <span class="v1-hotkey-group-title">${this.t('settings.hotkeys.groupReader')}</span>
            <span class="v1-hotkey-group-hint">${this.t('settings.hotkeys.headerDesc')}</span>
          </div>
          ${readerHotkeysHtml}

          <div class="v1-hotkey-group-header">
            <span class="v1-hotkey-group-title">${this.t('settings.hotkeys.groupGlobal')}</span>
            <span class="v1-hotkey-group-hint">${this.t('settings.hotkeys.headerDesc')}</span>
          </div>
          ${globalHotkeysHtml}
        </div>
      </section>
      <!-- 3. PUSTAKA & PEMBARUAN (Fitur Asli Yomic v1 LibraryHeader) -->
      <section class="v1-settings-section">
        <div class="v1-settings-sec-head">
          <h2 class="v1-settings-sec-title">${this.t('settings.library.headerTitle')}</h2>
        </div>
        <div class="v1-settings-group">
          <div class="v1-setting-row">
            <div class="v1-setting-info">
              <div class="v1-setting-title-row">
                <span class="v1-setting-title">${this.t('settings.library.autoSyncStartupTitle')}</span>
              </div>
              <span class="v1-setting-desc">${this.t('settings.library.autoSyncStartupDesc')}</span>
            </div>
            <div class="toggle-switch ${this.settings.autoSyncStartup ? 'on' : ''}" data-toggle-setting="autoSyncStartup" role="switch" aria-checked="${this.settings.autoSyncStartup}">
              <div class="toggle-thumb"></div>
            </div>
          </div>
          <div class="v1-setting-row">
            <div class="v1-setting-info">
              <div class="v1-setting-title-row">
                <span class="v1-setting-title">${this.t('settings.library.smartUpdateTitle')}</span>
              </div>
              <span class="v1-setting-desc">${this.t('settings.library.smartUpdateDesc')}</span>
            </div>
            <div class="toggle-switch ${this.settings.smartUpdate ? 'on' : ''}" data-toggle-setting="smartUpdate" role="switch" aria-checked="${this.settings.smartUpdate}">
              <div class="toggle-thumb"></div>
            </div>
          </div>
          <div class="v1-setting-row">
            <div class="v1-setting-info">
              <div class="v1-setting-title-row">
                <span class="v1-setting-title">${this.t('settings.library.bgUpdateTitle')}</span>
              </div>
              <span class="v1-setting-desc">${this.t('settings.library.bgUpdateDesc')}</span>
            </div>
            ${renderSettingDropdown(
              'selBackgroundUpdate',
              [
                { value: 'off', label: this.t('settings.library.bgOff') },
                { value: '6h', label: this.t('settings.library.bg6h') },
                { value: '12h', label: this.t('settings.library.bg12h') },
                { value: '24h', label: this.t('settings.library.bg24h') }
              ],
              this.settings.backgroundUpdateInterval || 'off',
              this.t('settings.library.bgUpdateTitle')
            )}
          </div>
        </div>
      </section>
      <!-- 3. JARINGAN & DNS -->
      <section class="v1-settings-section">
        <div class="v1-settings-sec-head">
          <h2 class="v1-settings-sec-title">${this.t('settings.tab.network')}</h2>
        </div>
        <div class="v1-settings-group">
          <!-- Fitur Asli Yomic v1: Offline Mode -->
          <div class="v1-setting-row">
            <div class="v1-setting-info">
              <div class="v1-setting-title-row">
                <span class="v1-setting-title">${this.t('settings.network.offlineTitle')}</span>
              </div>
              <span class="v1-setting-desc">${this.t('settings.network.offlineDesc')}</span>
            </div>
            <div class="toggle-switch ${this.settings.isOfflineMode ? 'on' : ''}" data-toggle-setting="isOfflineMode" role="switch" aria-checked="${this.settings.isOfflineMode}">
              <div class="toggle-thumb"></div>
            </div>
          </div>
          <div class="v1-setting-row">
            <div class="v1-setting-info">
              <div class="v1-setting-title-row">
                <span class="v1-setting-title">${this.t('settings.network.dohTitle')}</span>
              </div>
              <span class="v1-setting-desc">${this.t('settings.network.dohDesc')}</span>
            </div>
            ${renderSettingDropdown(
              'selDohProvider',
              [
                { value: 'Nonaktif', label: this.t('settings.network.dohSystem') },
                { value: 'Cloudflare (1.1.1.1)', label: 'Cloudflare (1.1.1.1)' },
                { value: 'Google (8.8.8.8)', label: 'Google (8.8.8.8)' },
                { value: 'AdGuard (94.140.14.14)', label: 'AdGuard (94.140.14.14)' }
              ],
              this.settings.dohProvider || 'Nonaktif',
              'DNS over HTTPS'
            )}
          </div>
          <!-- Fitur Asli Yomic v1: Source Status Interval -->
          <div class="v1-setting-row">
            <div class="v1-setting-info">
              <div class="v1-setting-title-row">
                <span class="v1-setting-title">${this.t('settings.network.sourceStatusTitle')}</span>
              </div>
              <span class="v1-setting-desc">${this.t('settings.network.sourceStatusDesc')}</span>
            </div>
            ${renderSettingDropdown(
              'selSourceStatusInterval',
              [
                { value: '15m', label: this.t('settings.network.interval15m') },
                { value: '30m', label: this.t('settings.network.interval30m') },
                { value: '1h', label: this.t('settings.network.interval1h') },
                { value: 'off', label: this.t('settings.network.intervalOff') }
              ],
              this.settings.sourceStatusInterval || '15m',
              this.t('settings.network.sourceStatusTitle')
            )}
          </div>
        </div>
      </section>
      <!-- 4. UNDUHAN & PENYIMPANAN -->
      <section class="v1-settings-section">
        <div class="v1-settings-sec-head">
          <h2 class="v1-settings-sec-title">${this.l('Unduhan &amp; Penyimpanan', 'Downloads &amp; Storage')}</h2>
        </div>
        <div class="v1-settings-group">
          <div class="v1-setting-row">
            <div class="v1-setting-info">
              <div class="v1-setting-title-row">
                <span class="v1-setting-title">${this.l('Folder Penyimpanan Unduhan', 'Downloads Storage Folder')}</span>
              </div>
              <span class="v1-setting-desc">${this.l('Lokasi berkas bab komik yang disimpan untuk dibaca saat offline di komputer Anda.', 'Location of comic chapter files saved for offline reading on your computer.')}</span>
              <span class="v1-setting-meta" style="font-family:ui-monospace, monospace; font-size:11.5px; background:var(--bg-canvas); padding:2px 8px; border-radius:4px; border:1px solid var(--border-subtle); display:inline-block; margin-top:5px; color:var(--ink-secondary);">
                ${escapeXml(this.settings.downloadsFolder)}
              </span>
            </div>
            <button id="btnOpenDownloadsFolder" class="v1-setting-btn primary" style="display:inline-flex; align-items:center; gap:6px; white-space:nowrap;">
              ${getIconSvg('folder-open', { size: 16 })}
              <span>${this.l('Buka di Explorer', 'Open in Explorer')}</span>
            </button>
          </div>
          <div class="v1-setting-row">
            <div class="v1-setting-info">
              <div class="v1-setting-title-row">
                <span class="v1-setting-title">${this.l('Bersihkan Cache Gambar', 'Clear Image Cache')}</span>
              </div>
              <span class="v1-setting-desc">${this.l('Hapus berkas gambar sementara dari memori penyimpanan lokal untuk menghemat ruang disk.', 'Delete temporary image files from local storage to save disk space.')}</span>
              <span class="v1-setting-meta">${this.l('Ukuran data tersimpan:', 'Stored data size:')} ${escapeXml(this.settings.dbSizeText)}</span>
            </div>
            <button id="btnDangerClearCache" class="v1-setting-btn" style="white-space:nowrap;">
              ${this.l('Bersihkan Cache', 'Clear Cache')}
            </button>
          </div>
          <!-- Fitur Asli Yomic v1: Clear Non-Library Cache -->
          <div class="v1-setting-row">
            <div class="v1-setting-info">
              <div class="v1-setting-title-row">
                <span class="v1-setting-title">${this.l('Hapus Cache Non-Pustaka', 'Clear Non-Library Cache')}</span>
              </div>
              <span class="v1-setting-desc">${this.l('Hapus seluruh berkas gambar dan metadata komik dari hasil pencarian sumber yang tidak tersimpan di Pustaka.', 'Delete all image files and comic metadata from source searches not saved in your Library.')}</span>
            </div>
            <button id="btnClearNonLibraryCache" class="v1-setting-btn" style="white-space:nowrap;">
              ${this.l('Hapus Non-Pustaka', 'Clear Non-Library')}
            </button>
          </div>
          <div class="v1-setting-row">
            <div class="v1-setting-info">
              <div class="v1-setting-title-row">
                <span class="v1-setting-title">${this.l('Hapus Riwayat Membaca', 'Clear Reading History')}</span>
              </div>
              <span class="v1-setting-desc">${this.l('Kosongkan seluruh daftar riwayat aktivitas membaca terakhir tanpa menghapus komik di Pustaka.', 'Empty your recent reading activity history without removing comics from your Library.')}</span>
            </div>
            <button id="btnDangerClearHistory" class="v1-setting-btn amber-soft" style="white-space:nowrap;">
              ${this.l('Hapus Riwayat', 'Clear History')}
            </button>
          </div>
          <!-- Fitur Asli Yomic v1: Export App Logs -->
          <div class="v1-setting-row">
            <div class="v1-setting-info">
              <div class="v1-setting-title-row">
                <span class="v1-setting-title">${this.l('Ekspor Log Aplikasi', 'Export App Logs')}</span>
              </div>
              <span class="v1-setting-desc">${this.l('Simpan berkas catatan aktivitas dan diagnostik aplikasi (.log) untuk pelaporan masalah atau troubleshooting.', 'Save application activity and diagnostic logs (.log) for issue reporting or troubleshooting.')}</span>
            </div>
            <button id="btnExportAppLogs" class="v1-setting-btn" style="white-space:nowrap;">
              ${this.l('Ekspor Log', 'Export Logs')}
            </button>
          </div>
        </div>
      </section>
      <!-- 4. CADANGAN & PEMULIHAN -->
      <section class="v1-settings-section">
        <div class="v1-settings-sec-head">
          <h2 class="v1-settings-sec-title">${this.t('settings.storage.backupHeaderTitle')}</h2>
        </div>
        <div class="v1-settings-group">
          <div class="v1-setting-row">
            <div class="v1-setting-info">
              <div class="v1-setting-title-row">
                <span class="v1-setting-title">${this.t('settings.storage.backupBtn')}</span>
              </div>
              <span class="v1-setting-desc">${this.t('settings.storage.backupHeaderDesc')}</span>
              <span class="v1-setting-meta">${this.settings.lastBackupText}</span>
            </div>
            <button id="btnCreateBackup" class="v1-setting-btn" style="white-space:nowrap;">${this.t('settings.storage.backupBtn')}</button>
          </div>
          <div class="v1-setting-row">
            <div class="v1-setting-info">
              <div class="v1-setting-title-row">
                <span class="v1-setting-title">${this.t('settings.storage.restoreBtn')}</span>
              </div>
              <span class="v1-setting-desc">${this.t('settings.storage.backupHeaderDesc')}</span>
            </div>
            <button id="btnRestoreBackup" class="v1-setting-btn" style="white-space:nowrap;">${this.t('settings.storage.restoreBtn')}</button>
          </div>
        </div>
      </section>
      <!-- 5. PELACAKAN (TRACKER) -->
      <section id="settingsTrackerSection" class="v1-settings-section">
        <div class="v1-settings-sec-head">
          <h2 class="v1-settings-sec-title">${this.t('settings.tracker.headerTitle')}</h2>
        </div>
        <div class="v1-settings-group">
          <div class="v1-setting-row">
            <div class="v1-setting-info">
              <div class="v1-setting-title-row">
                <span class="v1-setting-title">MyAnimeList</span>
                ${this.settings.isMalConnected ? `<span style="color:#059669;display:inline-flex;align-items:center;" title="Connected" aria-label="Connected">${getIconSvg('link', { size: 16 })}</span>` : `<span class="v1-setting-badge muted">${this.settings.appLanguage === 'en' ? 'DISCONNECTED' : 'TERPUTUS'}</span>`}
              </div>
              <span class="v1-setting-desc">
                ${
                  this.settings.isMalConnected
                    ? this.t('settings.tracker.malConnectedAs', { user: escapeXml(this.settings.malConnectedUser) })
                    : this.t('settings.tracker.malNotConnected')
                }
              </span>
            </div>
            <button id="btnToggleMalConnect" class="v1-setting-btn ${this.settings.isMalConnected ? 'danger-outline' : 'primary'}" style="white-space:nowrap;">
              ${this.settings.isMalConnected ? this.t('settings.tracker.malDisconnect') : this.t('settings.tracker.malConnect')}
            </button>
          </div>
          <div class="v1-setting-row">
            <div class="v1-setting-info">
              <div class="v1-setting-title-row">
                <span class="v1-setting-title">${this.t('settings.tracker.autoSyncTitle')}</span>
              </div>
              <span class="v1-setting-desc">${this.t('settings.tracker.autoSyncDesc')}</span>
            </div>
            <div class="toggle-switch ${this.settings.autoSyncTracker ? 'on' : ''}" data-toggle-setting="autoSyncTracker" role="switch" aria-checked="${this.settings.autoSyncTracker}">
              <div class="toggle-thumb"></div>
            </div>
          </div>
        </div>
      </section>
      <!-- 5. VERSI APLIKASI (Pola Gambar 2) -->
      <section class="v1-settings-section">
        <div class="v1-settings-sec-head">
          <h2 class="v1-settings-sec-title">${this.t('settings.about.updateTitle')}</h2>
        </div>
        <div class="v1-settings-group">
          <div class="v1-setting-row">
            <div class="v1-setting-info">
              <div class="v1-setting-title-row">
                <span class="v1-setting-title">${this.t('settings.about.updateTitle')}</span>
              </div>
              <span class="v1-setting-desc">${this.t('settings.about.updateDesc')}</span>
            </div>
            <div style="display: flex; align-items: center; gap: 12px;">
              <span style="font-size: 13px; font-weight: 700; color: var(--ink-primary); font-family: var(--font-mono, monospace);">2.0.0</span>
              <button id="btnAboutCheckUpdate" class="v1-setting-btn primary" style="white-space:nowrap; display: inline-flex; align-items: center; gap: 6px;">
                ${getIconSvg('refresh', { size: 14 })}
                <span>${this.t('settings.about.checkUpdate')}</span>
              </button>
            </div>
          </div>
        </div>
      </section>
      <!-- 6. ZONA BAHAYA -->
      <section class="v1-settings-section">
        <div class="v1-settings-sec-head danger">
          ${getIconSvg('danger-triangle-linear', { size: 18 })}
          <h2 class="v1-settings-sec-title">${this.settings.appLanguage === 'en' ? 'Danger Zone' : 'Zona Bahaya'}</h2>
        </div>
        <div class="v1-danger-zone-box">
          <div class="v1-danger-row">
            <div class="v1-setting-info">
              <span class="v1-setting-title danger">${this.t('settings.about.resetTitle')}</span>
              <span class="v1-setting-desc">${this.t('settings.about.resetDesc')}</span>
            </div>
            <button id="btnDangerResetAll" class="v1-setting-btn danger-soft" style="flex-shrink:0;justify-content:center;">
              ${getIconSvg('restart-linear', { size: 15, style: 'flex-shrink:0;display:block;' })}
              <span>${this.t('settings.about.resetBtn')}</span>
            </button>
          </div>
        </div>
      </section>
      <!-- 6. TENTANG & SISTEM -->
      <section class="v1-settings-section">
        <div class="v1-settings-sec-head">
          <h2 class="v1-settings-sec-title">${this.t('settings.tab.about')}</h2>
        </div>
        <!-- Hero Brand Header & Ikon Media Sosial Asli -->
        <div style="display: flex; align-items: flex-start; gap: 16px; padding: 4px 2px 8px 2px;">
          <img src="app-logo.png" style="width: 48px; height: 48px; object-fit: contain; flex-shrink: 0;" alt="Yomic Logo" />
          <div style="display: flex; flex-direction: column; gap: 8px;">
            <div>
              <span style="font-family: var(--font-display); font-size: 19px; font-weight: 800; color: var(--ink-primary); line-height: 1.15;">Yomic</span>
              <div style="font-size: 12.5px; color: var(--ink-secondary); margin-top: 2px;">${this.t('settings.about.desc')}</div>
            </div>
            <!-- Baris Ikon Media Sosial Asli (GitHub, Facebook, Instagram - Murni Ikon Tanpa Background) -->
            <div class="v1-social-row">
              <button class="v1-social-btn github" data-social-url="https://github.com/ArisaAkiyama/Yomic" title="GitHub (ArisaAkiyama/Yomic)">
                ${getIconSvg('brand-github', { size: 20 })}
              </button>
              <button class="v1-social-btn facebook" data-social-url="https://web.facebook.com/febianrizaarzewiniga" title="Facebook (Febian Riza Arzewiniga)">
                ${getIconSvg('brand-facebook', { size: 20 })}
              </button>
              <button class="v1-social-btn instagram" data-social-url="https://www.instagram.com/febianriza.a/" title="Instagram (@febianriza.a)">
                ${getIconSvg('brand-instagram', { size: 20 })}
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  `;
  const persistSetting = (key: string, value: unknown) => {
    this.persistLocalCache();
    if (this.bridge.isWebViewHost) {
      void this.bridge.invoke<AppSettingsState>('settings:update', { key, value }).then((updated) => {
        if (updated) {
          Object.assign(this.settings, updated);
          this.persistLocalCache();
        }
      });
    }
  };

  // Toggle switches
  container.querySelectorAll<HTMLElement>('[data-toggle-setting]').forEach((el) => {
    el.addEventListener('click', () => {
      const key = el.dataset.toggleSetting as keyof AppSettingsState | undefined;
      if (!key) return;
      const currentVal = this.settings[key];
      if (typeof currentVal === 'boolean') {
        const nextVal = !currentVal;
        (this.settings[key] as boolean) = nextVal;
        persistSetting(key, nextVal);
        if (key === 'compactSidebar') {
          this.toggleSidebarCollapse(this.settings.compactSidebar);
        } else if (key === 'isDarkMode') {
          this.applyTheme(this.settings.isDarkMode);
          this.showToast(
            this.settings.isDarkMode
              ? this.l('Mode gelap diaktifkan.', 'Dark mode enabled.')
              : this.l('Mode gelap dinonaktifkan.', 'Dark mode disabled.')
          );
        } else if (key === 'autoDarkReader') {
          this.showToast(
            this.settings.autoDarkReader
              ? 'Mode gelap otomatis saat membaca diaktifkan.'
              : this.l('Mode gelap otomatis saat membaca dinonaktifkan.', 'Auto dark mode while reading disabled.')
          );
        } else if (key === 'showNsfw') {
          this.showToast(
            this.settings.showNsfw
              ? this.l('Katalog sumber NSFW (18+) ditampilkan.', 'NSFW (18+) source catalog shown.')
              : this.l('Katalog sumber NSFW (18+) disembunyikan.', 'NSFW (18+) source catalog hidden.')
          );
          if (!this.settings.showNsfw) {
            this.activeBrowseSourceId = null;
          }
          if (this.bridge.isWebViewHost) {
            void this.bridge.invoke<ExtensionItem[]>('ext:list', { refreshRemote: false }).then((list) => {
              if (Array.isArray(list)) {
                this.extensions.length = 0;
                this.extensions.push(...list);
                this.persistLocalCache();
              }
            });
          }
        } else if (key === 'blurExplicitCovers') {
          this.showToast(
            this.settings.blurExplicitCovers
              ? this.l('Penyamaran sampul eksplisit diaktifkan.', 'Explicit cover blur enabled.')
              : this.l('Penyamaran sampul eksplisit dinonaktifkan.', 'Explicit cover blur disabled.')
          );
        } else if (key === 'autoSyncTracker') {
          this.showToast(
            this.settings.autoSyncTracker
              ? this.l('Sinkronisasi progres bab otomatis diaktifkan.', 'Auto chapter progress sync enabled.')
              : this.l('Sinkronisasi progres bab otomatis dinonaktifkan.', 'Auto chapter progress sync disabled.')
          );
        } else if (key === 'preloadNextChapter') {
          this.showToast(
            this.settings.preloadNextChapter
              ? this.l('Muat awal bab berikutnya diaktifkan.', 'Preload next chapter enabled.')
              : this.l('Muat awal bab berikutnya dinonaktifkan.', 'Preload next chapter disabled.')
          );
        } else if (key === 'autoDownloadNextChapter') {
          this.showToast(
            this.settings.autoDownloadNextChapter
              ? this.l('Unduh otomatis bab berikutnya diaktifkan.', 'Auto-download next chapter enabled.')
              : this.l('Unduh otomatis bab berikutnya dinonaktifkan.', 'Auto-download next chapter disabled.')
          );
        } else if (key === 'skipFilteredChapters') {
          this.showToast(
            this.settings.skipFilteredChapters
              ? this.l('Lewati bab yang difilter diaktifkan.', 'Skip filtered chapters enabled.')
              : this.l('Lewati bab yang difilter dinonaktifkan.', 'Skip filtered chapters disabled.')
          );
        } else if (key === 'showUnreadBadges') {
          this.showToast(
            this.settings.showUnreadBadges
              ? this.l('Lencana belum dibaca di sampul ditampilkan.', 'Unread badges on covers shown.')
              : this.l('Lencana belum dibaca di sampul disembunyikan.', 'Unread badges on covers hidden.')
          );
        } else if (key === 'autoSyncStartup') {
          this.showToast(
            this.settings.autoSyncStartup
              ? this.l('Sinkronisasi otomatis saat mulai diaktifkan.', 'Auto-sync on startup enabled.')
              : this.l('Sinkronisasi otomatis saat mulai dinonaktifkan.', 'Auto-sync on startup disabled.')
          );
        } else if (key === 'smartUpdate') {
          this.showToast(
            this.settings.smartUpdate
              ? this.l('Pembaruan Cerdas (Smart Update) diaktifkan.', 'Smart Update enabled.')
              : this.l('Pembaruan Cerdas (Smart Update) dinonaktifkan.', 'Smart Update disabled.')
          );
        } else if (key === 'isOfflineMode') {
          this.showToast(
            this.settings.isOfflineMode
              ? this.l('Mode Offline aktif (Hanya membaca komik terunduh).', 'Offline Mode active (Downloaded comics only).')
              : this.l('Mode Offline dinonaktifkan (Koneksi online aktif).', 'Offline Mode disabled (Online connection active).')
          );
        } else if (key === 'enableAutoCropBorders') {
          this.showToast(
            this.settings.enableAutoCropBorders
              ? this.l('Potong tepi putih otomatis (Auto-Crop) diaktifkan.', 'Auto-Crop borders enabled.')
              : this.l('Potong tepi putih otomatis (Auto-Crop) dinonaktifkan.', 'Auto-Crop borders disabled.')
          );
        } else if (key === 'enableImageSharpening') {
          this.showToast(
            this.settings.enableImageSharpening
              ? 'Penajaman gambar (Sharpening) diaktifkan.'
              : 'Penajaman gambar (Sharpening) dinonaktifkan.'
          );
        } else if (key === 'enableImageOptimization') {
          this.showToast(
            this.settings.enableImageOptimization
              ? this.l('Optimasi gambar cerdas diaktifkan.', 'Smart image optimization enabled.')
              : this.l('Optimasi gambar cerdas dinonaktifkan.', 'Smart image optimization disabled.')
          );
        }
        this.renderSettingsView(container);
      }
    });
  });

  // Custom dropdowns in Settings (matching Image 2 MAL dropdown style)
  const closeAllSettingDropdowns = () => {
    container.querySelectorAll<HTMLElement>('.v1-setting-dropdown.open').forEach((d) => {
      d.classList.remove('open', 'open-up');
      d.closest('.v1-setting-row')?.classList.remove('dropdown-open');
      d.querySelector('.v1-mal-dropdown-trigger')?.setAttribute('aria-expanded', 'false');
    });
  };

  container.querySelectorAll<HTMLElement>('.v1-setting-dropdown').forEach((dropdown) => {
    const trigger = dropdown.querySelector<HTMLButtonElement>('.v1-mal-dropdown-trigger');
    const options = Array.from(dropdown.querySelectorAll<HTMLButtonElement>('.v1-mal-dropdown-option'));
    const targetId = dropdown.dataset.dropdownFor;

    trigger?.addEventListener('click', (ev) => {
      ev.stopPropagation();
      const willOpen = !dropdown.classList.contains('open');
      closeAllSettingDropdowns();
      if (willOpen) {
        const rect = trigger.getBoundingClientRect();
        const estimatedHeight = Math.min(240, options.length * 38 + 16);
        if (rect.bottom + estimatedHeight > window.innerHeight - 16 && rect.top > estimatedHeight) {
          dropdown.classList.add('open-up');
        } else {
          dropdown.classList.remove('open-up');
        }
        dropdown.classList.add('open');
        dropdown.closest('.v1-setting-row')?.classList.add('dropdown-open');
        trigger.setAttribute('aria-expanded', 'true');
      }
    });

    options.forEach((optBtn) => {
      optBtn.addEventListener('click', (ev) => {
        ev.stopPropagation();
        const val = optBtn.dataset.value ?? '';
        const input = targetId ? (document.getElementById(targetId) as HTMLInputElement | null) : null;
        const valueSpan = dropdown.querySelector<HTMLElement>('.v1-mal-dropdown-value');
        const labelText = optBtn.querySelector('span')?.textContent ?? '';
        if (valueSpan) valueSpan.textContent = labelText;

        options.forEach((opt) => {
          const selected = opt === optBtn;
          opt.classList.toggle('selected', selected);
          opt.setAttribute('aria-selected', selected ? 'true' : 'false');
        });

        closeAllSettingDropdowns();
        if (input && input.value !== val) {
          input.value = val;
          input.dispatchEvent(new Event('change', { bubbles: true }));
        }
      });
    });
  });

  const winDropdown = window as unknown as {
    _onSettingDropdownClick?: (ev: MouseEvent) => void;
    _onSettingDropdownKey?: (ev: KeyboardEvent) => void;
  };
  if (winDropdown._onSettingDropdownClick) {
    window.removeEventListener('click', winDropdown._onSettingDropdownClick);
  }
  if (winDropdown._onSettingDropdownKey) {
    window.removeEventListener('keydown', winDropdown._onSettingDropdownKey);
  }
  winDropdown._onSettingDropdownClick = (ev: MouseEvent) => {
    const target = ev.target as HTMLElement | null;
    if (!target?.closest('.v1-setting-dropdown')) {
      closeAllSettingDropdowns();
    }
  };
  winDropdown._onSettingDropdownKey = (ev: KeyboardEvent) => {
    if (ev.key === 'Escape') {
      closeAllSettingDropdowns();
    }
  };
  window.addEventListener('click', winDropdown._onSettingDropdownClick);
  window.addEventListener('keydown', winDropdown._onSettingDropdownKey);

  // Select dropdowns
  document.getElementById('selMaxImageDimension')?.addEventListener('change', (ev) => {
    const val = Number((ev.target as HTMLSelectElement).value);
    this.settings.maxImageDimension = isNaN(val) ? 2160 : val;
    persistSetting('maxImageDimension', this.settings.maxImageDimension);
    this.showToast(
      val === 0
        ? this.l('Batas resolusi gambar: Tanpa Batas (Ukuran Asli).', 'Image resolution limit: Unlimited (Original Size).')
        : this.l(`Batas resolusi gambar diatur ke: ${val} px.`, `Image resolution limit set to: ${val} px.`)
    );
  });
  document.getElementById('selMaxReaderCacheSize')?.addEventListener('change', (ev) => {
    const val = (ev.target as HTMLSelectElement).value as '250MB' | '500MB' | '1GB' | '2GB';
    this.settings.maxReaderCacheSize = val;
    persistSetting('maxReaderCacheSize', val);
    this.showToast(this.l(`Batas cache pembaca diatur ke: ${val}.`, `Reader cache limit set to: ${val}.`));
  });
  document.getElementById('selBackgroundUpdate')?.addEventListener('change', (ev) => {
    const val = (ev.target as HTMLSelectElement).value as 'off' | '6h' | '12h' | '24h';
    this.settings.backgroundUpdateInterval = val;
    persistSetting('backgroundUpdateInterval', val);
    const label =
      val === 'off'
        ? this.l('Nonaktif', 'Off')
        : val === '6h'
        ? this.l('Tiap 6 Jam', 'Every 6 Hours')
        : val === '12h'
        ? this.l('Tiap 12 Jam', 'Every 12 Hours')
        : this.l('Harian', 'Daily');
    this.showToast(this.l(`Pembaruan latar belakang diatur ke: ${label}.`, `Background update interval set to: ${label}.`));
  });
  document.getElementById('selSourceStatusInterval')?.addEventListener('change', (ev) => {
    const val = (ev.target as HTMLSelectElement).value as '15m' | '30m' | '1h' | 'off';
    this.settings.sourceStatusInterval = val;
    persistSetting('sourceStatusInterval', val);
    const label =
      val === 'off'
        ? this.l('Nonaktif', 'Off')
        : val === '15m'
        ? this.l('Tiap 15 Menit', 'Every 15 Minutes')
        : val === '30m'
        ? this.l('Tiap 30 Menit', 'Every 30 Minutes')
        : this.l('Tiap 1 Jam', 'Every 1 Hour');
    this.showToast(this.l(`Interval status sumber diatur ke: ${label}.`, `Source status interval set to: ${label}.`));
  });
  document.getElementById('btnClearNonLibraryCache')?.addEventListener('click', () => {
    const btn = document.getElementById('btnClearNonLibraryCache') as HTMLButtonElement | null;
    if (btn) {
      btn.disabled = true;
      btn.textContent = this.l('Menghapus...', 'Clearing...');
    }
    for (let i = this.mangaList.length - 1; i >= 0; i--) {
      if (!this.mangaList[i].inLibrary) {
        this.mangaList.splice(i, 1);
      }
    }
    if (this.bridge.isWebViewHost) {
      void this.bridge
        .invoke<{ dbSizeText?: string }>('settings:clear-non-library', undefined, 60000)
        .then((res) => {
          if (res?.dbSizeText) {
            this.settings.dbSizeText = res.dbSizeText;
          }
          this.renderSettingsView(container);
          this.showToast(this.l('Seluruh cache gambar komik non-pustaka berhasil dibersihkan.', 'All non-library comic image cache cleared.'));
        })
        .finally(() => {
          if (btn) {
            btn.disabled = false;
            btn.textContent = this.l('Hapus Non-Pustaka', 'Clear Non-Library');
          }
        });
      return;
    }
    this.renderSettingsView(container);
    this.showToast(this.l('Seluruh cache gambar komik non-pustaka berhasil dibersihkan.', 'All non-library comic image cache cleared.'));
  });
  document.getElementById('btnExportAppLogs')?.addEventListener('click', () => {
    const btn = document.getElementById('btnExportAppLogs') as HTMLButtonElement | null;
    if (this.bridge.isWebViewHost) {
      if (btn) btn.disabled = true;
      void this.bridge
        .invoke<{ ok?: boolean; cancelled?: boolean; path?: string }>('settings:export-logs', undefined, 180000)
        .then((res) => {
          if (res?.path) {
            this.showToast(this.l(`Log aktivitas diekspor ke: ${res.path}`, `Activity logs exported to: ${res.path}`));
          } else if (res && !res.ok && !res.cancelled) {
            this.showToast(this.l('Gagal mengekspor log aktivitas.', 'Failed to export activity logs.'));
          }
        })
        .finally(() => {
          if (btn) btn.disabled = false;
        });
      return;
    }
    this.showToast(this.l('Log aktivitas aplikasi berhasil diekspor.', 'Application activity logs exported.'));
  });
  document.getElementById('selAppLanguage')?.addEventListener('change', (ev) => {
    const val = (ev.target as HTMLSelectElement).value === 'en' ? 'en' : 'id';
    this.settings.appLanguage = val;
    persistSetting('appLanguage', val);
    applyStaticDomTranslations(val);
    this.renderCurrentWorkspace(true);
    const langName = val === 'en' ? 'English' : 'Bahasa Indonesia';
    this.showToast(this.t('settings.appearance.languageChanged', { lang: langName }));
  });
  document.getElementById('selDefaultReaderMode')?.addEventListener('change', (ev) => {
    const val = (ev.target as HTMLSelectElement).value as ReaderMode;
    this.settings.defaultReaderMode = val;
    this.readerMode = val;
    persistSetting('defaultReaderMode', val);
    const label = val === 'webtoon' ? this.l('Webtoon (Gulir)', 'Webtoon (Scroll)') : val === 'single' ? this.l('Halaman Tunggal', 'Single Page') : this.l('Dua Halaman', 'Double Page');
    this.showToast(this.l(`Mode baca bawaan diatur ke: ${label}.`, `Default reading mode set to: ${label}.`));
  });
  document.getElementById('selReadingDirection')?.addEventListener('change', (ev) => {
    const val = (ev.target as HTMLSelectElement).value as 'ltr' | 'rtl';
    this.settings.readingDirection = val;
    persistSetting('readingDirection', val);
    const label = val === 'ltr' ? this.l('Kiri ke Kanan (Manhwa / Barat)', 'Left to Right (Manhwa / Western)') : this.l('Kanan ke Kiri (Manga Jepang)', 'Right to Left (Japanese Manga)');
    this.showToast(this.l(`Arah membaca diatur ke: ${label}.`, `Reading direction set to: ${label}.`));
  });
  document.getElementById('selReaderFitMode')?.addEventListener('change', (ev) => {
    const val = (ev.target as HTMLSelectElement).value as 'fit-width' | 'fit-height' | 'original';
    this.settings.readerFitMode = val;
    persistSetting('readerFitMode', val);
    const label = val === 'fit-width' ? this.l('Pas Lebar', 'Fit Width') : val === 'fit-height' ? this.l('Pas Tinggi', 'Fit Height') : this.l('Ukuran Asli', 'Original Size');
    this.showToast(this.l(`Skala tampilan gambar diatur ke: ${label}.`, `Image fit mode set to: ${label}.`));
  });

  // Action buttons
  document.getElementById('btnRefreshLibraryCovers')?.addEventListener('click', () => {
    const btn = document.getElementById('btnRefreshLibraryCovers') as HTMLButtonElement | null;
    if (btn) {
      btn.disabled = true;
      btn.textContent = this.l('Menyegarkan...', 'Refreshing...');
    }
    this.showToast(this.l('Menyegarkan seluruh gambar sampul komik di Pustaka...', 'Refreshing all comic cover images in Library...'));
    if (this.bridge.isWebViewHost) {
      void this.bridge
        .invoke<{ ok?: boolean; mangaList?: MangaItem[]; dbSizeText?: string }>('settings:refresh-covers', undefined, 180000)
        .then((res) => {
          if (res?.mangaList && Array.isArray(res.mangaList)) {
            for (const item of res.mangaList) this.upsertMangaItem(item);
          }
          if (res?.dbSizeText) {
            this.settings.dbSizeText = res.dbSizeText;
          }
          this.renderSettingsView(container);
          this.showToast(this.l('Sampul pustaka berhasil disegarkan!', 'Library covers refreshed!'));
        })
        .finally(() => {
          if (btn) {
            btn.disabled = false;
            btn.textContent = this.l('Segarkan', 'Refresh');
          }
        });
    } else if (btn) {
      btn.disabled = false;
      btn.textContent = this.l('Segarkan', 'Refresh');
    }
  });
  document.getElementById('btnOpenDownloadsFolder')?.addEventListener('click', () => {
    this.bridge.openFolder();
    this.showToast(this.l('Membuka folder unduhan di File Explorer...', 'Opening downloads folder in File Explorer...'));
  });
  document.getElementById('btnDangerClearCache')?.addEventListener('click', () => {
    const btn = document.getElementById('btnDangerClearCache') as HTMLButtonElement | null;
    if (btn) {
      btn.disabled = true;
      btn.textContent = this.l('Membersihkan...', 'Clearing...');
    }
    if (this.bridge.isWebViewHost) {
      void this.bridge
        .invoke<{ dbSizeText?: string }>('settings:clear-cache', undefined, 60000)
        .then((res) => {
          this.settings.dbSizeText = res?.dbSizeText || '0.0 MB';
          this.renderSettingsView(container);
          this.showToast(this.l('Seluruh berkas cache gambar berhasil dibersihkan.', 'All image cache files cleared.'));
        })
        .finally(() => {
          if (btn) {
            btn.disabled = false;
            btn.textContent = this.l('Bersihkan Cache', 'Clear Cache');
          }
        });
      return;
    }
    this.settings.dbSizeText = '0.0 MB';
    this.renderSettingsView(container);
    this.showToast(this.l('Seluruh berkas cache gambar berhasil dibersihkan.', 'All image cache files cleared.'));
  });
  document.getElementById('btnDangerClearHistory')?.addEventListener('click', () => {
    const btn = document.getElementById('btnDangerClearHistory') as HTMLButtonElement | null;
    if (btn) {
      btn.disabled = true;
      btn.textContent = this.l('Menghapus...', 'Clearing...');
    }
    this.mangaList.forEach((m) => {
      this.removedHistoryIds.add(m.id);
      m.lastViewedEpoch = 0;
      m.lastReadTimeAgo = this.l('Belum dibaca', 'Unread');
      if (Array.isArray(m.chapters)) {
        m.chapters.forEach((c) => {
          c.isRead = false;
        });
        m.unreadCount = m.chapters.length;
      }
    });
    if (this.bridge.isWebViewHost) {
      void this.bridge
        .invoke<{ ok?: boolean; dbSizeText?: string; mangaList?: MangaItem[] }>('history:clear-all', undefined, 60000)
        .then((res) => {
          if (res?.mangaList && Array.isArray(res.mangaList)) {
            for (const item of res.mangaList) this.upsertMangaItem(item);
          }
          if (res?.dbSizeText) {
            this.settings.dbSizeText = res.dbSizeText;
          }
          this.renderSettingsView(container);
          this.showToast(this.l('Seluruh riwayat baca telah dibersihkan.', 'All reading history cleared.'));
        })
        .finally(() => {
          if (btn) {
            btn.disabled = false;
            btn.textContent = this.l('Hapus Riwayat', 'Clear History');
          }
        });
      return;
    }
    this.renderSettingsView(container);
    this.showToast(this.l('Seluruh riwayat baca telah dibersihkan.', 'All reading history cleared.'));
  });
  document.getElementById('selDohProvider')?.addEventListener('change', (e) => {
    const val = (e.target as HTMLSelectElement).value;
    this.settings.dohProvider = val;
    persistSetting('dohProvider', val);
    this.showToast(this.l(`Resolver DNS over HTTPS diatur ke: ${val}`, `DNS over HTTPS resolver set to: ${val}`));
  });
  document.getElementById('btnCreateBackup')?.addEventListener('click', () => {
    const btn = document.getElementById('btnCreateBackup') as HTMLButtonElement | null;
    if (this.bridge.isWebViewHost) {
      if (btn) {
        btn.disabled = true;
        btn.textContent = this.l('Mencadangkan...', 'Backing up...');
      }
      void this.bridge
        .invoke<{ saved?: boolean; cancelled?: boolean; lastBackupText?: string }>('backup:create', undefined, 180000)
        .then((res) => {
          if (res?.saved) {
            this.settings.lastBackupText = res.lastBackupText || this.l('Cadangan terakhir: Baru saja disimpan', 'Last backup: Just saved');
            this.renderSettingsView(container);
            this.showToast(this.l('Berkas cadangan (.yomicbackup) berhasil dibuat.', 'Backup file (.yomicbackup) created.'));
          } else if (!res?.cancelled) {
            this.showToast(this.l('Gagal membuat berkas cadangan.', 'Failed to create backup file.'));
          }
        })
        .finally(() => {
          if (btn) {
            btn.disabled = false;
            btn.textContent = this.l('Cadangkan', 'Back Up');
          }
        });
      return;
    }
    this.settings.lastBackupText = this.l('Cadangan terakhir: Baru saja disimpan', 'Last backup: Just saved');
    this.renderSettingsView(container);
    this.showToast(this.l('Berkas cadangan (.yomicbackup) berhasil dibuat.', 'Backup file (.yomicbackup) created.'));
  });
  document.getElementById('btnRestoreBackup')?.addEventListener('click', () => {
    const btn = document.getElementById('btnRestoreBackup') as HTMLButtonElement | null;
    if (this.bridge.isWebViewHost) {
      if (btn) {
        btn.disabled = true;
        btn.textContent = this.l('Memulihkan...', 'Restoring...');
      }
      this.showToast(this.l('Memilih berkas cadangan (.yomicbackup) untuk dipulihkan...', 'Selecting backup file (.yomicbackup) to restore...'));
      void this.bridge
        .invoke<{ restored?: boolean; cancelled?: boolean }>('backup:restore', undefined, 180000)
        .then((res) => {
          if (res?.restored) {
            void this.bootstrapFromBackend();
            this.showToast(this.l('Cadangan berhasil dipulihkan!', 'Backup restored!'));
          } else if (!res?.cancelled) {
            this.showToast(this.l('Gagal memulihkan berkas cadangan.', 'Failed to restore backup file.'));
          }
        })
        .finally(() => {
          if (btn) {
            btn.disabled = false;
            btn.textContent = this.l('Pulihkan', 'Restore');
          }
        });
      return;
    }
    this.showToast(this.l('Memilih berkas cadangan (.yomicbackup) untuk dipulihkan...', 'Selecting backup file (.yomicbackup) to restore...'));
  });
  document.getElementById('btnToggleMalConnect')?.addEventListener('click', () => {
    const btn = document.getElementById('btnToggleMalConnect') as HTMLButtonElement | null;
    const wasConnected = this.settings.isMalConnected;
    if (this.bridge.isWebViewHost) {
      if (!wasConnected) {
        this.showToast(this.l('Membuka browser untuk login MyAnimeList...', 'Opening browser for MyAnimeList login...'));
        if (btn) {
          btn.disabled = true;
          btn.textContent = this.l('Menunggu Login...', 'Waiting for Login...');
        }
      }
      void this.bridge
        .invoke<AppSettingsState>('mal:toggle-connect', undefined, 180000)
        .then((updated) => {
          if (updated) {
            Object.assign(this.settings, updated);
            this.renderSettingsView(container);
            if (this.settings.isMalConnected) {
              this.showToast(
                this.l(`Terhubung ke MyAnimeList (@${this.settings.malConnectedUser}).`, `Connected to MyAnimeList (@${this.settings.malConnectedUser}).`)
              );
            } else if (wasConnected) {
              this.showToast(
                this.l('Koneksi akun MyAnimeList diputuskan.', 'MyAnimeList account disconnected.')
              );
            } else {
              this.showToast(
                this.l('Login MyAnimeList dibatalkan atau waktu habis.', 'MyAnimeList login cancelled or timed out.')
              );
            }
          }
        })
        .finally(() => {
          if (btn) {
            btn.disabled = false;
            btn.textContent = this.settings.isMalConnected ? this.t('settings.tracker.malDisconnect') : this.t('settings.tracker.malConnect');
          }
        });
      return;
    }
    this.settings.isMalConnected = !this.settings.isMalConnected;
    this.renderSettingsView(container);
    this.showToast(
      this.settings.isMalConnected
        ? this.l(`Terhubung kembali ke MyAnimeList (@${this.settings.malConnectedUser}).`, `Reconnected to MyAnimeList (@${this.settings.malConnectedUser}).`)
        : this.l('Koneksi akun MyAnimeList diputuskan.', 'MyAnimeList account disconnected.')
    );
  });
  document.getElementById('btnDangerResetAll')?.addEventListener('click', () => {
    const existingOverlay = document.getElementById('dangerClearDataModalOverlay');
    if (existingOverlay) {
      existingOverlay.remove();
    }
    const overlay = document.createElement('div');
    overlay.id = 'dangerClearDataModalOverlay';
    overlay.style.cssText =
      'position:fixed;inset:0;background:rgba(15,23,42,0.55);backdrop-filter:blur(4px);z-index:99999;display:flex;align-items:center;justify-content:center;padding:16px;';
    overlay.innerHTML = `
      <div role="dialog" aria-modal="true" style="width:420px;max-width:92vw;background:var(--bg-surface,#ffffff);border:1px solid rgba(239,68,68,0.28);border-radius:16px;padding:24px;box-shadow:0 20px 45px rgba(0,0,0,0.28);color:var(--ink-primary,#0f172a);font-family:inherit;">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;">
          <span style="display:inline-flex;align-items:center;justify-content:center;width:36px;height:36px;border-radius:10px;background:rgba(239,68,68,0.12);color:#ef4444;flex-shrink:0;">
            ${getIconSvg('danger-triangle-linear', { size: 20 })}
          </span>
          <h3 style="margin:0;font-size:18px;font-weight:700;color:#ef4444;">${this.l('Hapus Semua Data', 'Clear All Data')}</h3>
        </div>
        <p id="dangerClearDataModalMsg" style="margin:0 0 22px 0;font-size:13.5px;line-height:1.55;color:var(--ink-secondary,#475569);">
          ${this.l(
            'Apakah Anda benar-benar yakin ingin mengatur ulang semua data? Tindakan ini tidak dapat dibatalkan dan akan menghapus seluruh pustaka lokal, bab terunduh, riwayat membaca, ekstensi, serta pengaturan Anda.',
            'Are you sure you want to reset all data? This action cannot be undone and will delete your local library, downloaded chapters, reading history, extensions, and settings.'
          )}
        </p>
        <div id="dangerClearDataModalActions" style="display:flex;justify-content:flex-end;gap:10px;">
          <button id="btnCancelClearAllData" type="button" style="height:36px;padding:0 18px;border-radius:8px;border:1px solid var(--border-subtle,#cbd5e1);background:transparent;color:var(--ink-primary,#1e293b);font-size:13px;font-weight:600;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;">
            ${this.t('modal.cancel')}
          </button>
          <button id="btnConfirmClearAllData" type="button" style="height:36px;padding:0 18px;border-radius:8px;border:none;background:#ef4444;color:#ffffff;font-size:13px;font-weight:600;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;gap:6px;">
            ${getIconSvg('trash-bin-trash-linear', { size: 15, style: 'flex-shrink:0;display:block;' })}
            <span>${this.l('Konfirmasi Hapus', 'Confirm Delete')}</span>
          </button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    const closeModal = (): void => {
      overlay.remove();
    };
    overlay.addEventListener('click', (ev) => {
      if (ev.target === overlay) {
        closeModal();
      }
    });
    document.getElementById('btnCancelClearAllData')?.addEventListener('click', () => {
      closeModal();
    });
    document.getElementById('btnConfirmClearAllData')?.addEventListener('click', () => {
      const confirmBtn = document.getElementById('btnConfirmClearAllData') as HTMLButtonElement | null;
      const cancelBtn = document.getElementById('btnCancelClearAllData') as HTMLButtonElement | null;
      const msgEl = document.getElementById('dangerClearDataModalMsg');
      if (confirmBtn) {
        confirmBtn.disabled = true;
        confirmBtn.style.opacity = '0.7';
        confirmBtn.textContent = this.l('Menghapus Data...', 'Deleting Data...');
      }
      if (cancelBtn) {
        cancelBtn.style.display = 'none';
      }
      const finishAndCountdown = (serverMsg?: string): void => {
        this.mangaList.splice(0, this.mangaList.length);
        this.removedHistoryIds.clear();
        Object.assign(this.settings, DEFAULT_APP_SETTINGS);
        this.readerMode = this.settings.defaultReaderMode;
        const finalNotice =
          serverMsg ||
          this.l(
            'Semua data berhasil dihapus. Aplikasi akan dimuat ulang otomatis dalam 3 detik.',
            'All data cleared. The application will automatically reload in 3 seconds.'
          );
        if (msgEl) {
          msgEl.style.color = '#ef4444';
          msgEl.style.fontWeight = '600';
          msgEl.textContent = finalNotice;
        }
        if (confirmBtn) {
          confirmBtn.textContent = this.l('Memuat Ulang (3 dtk)...', 'Reloading (3s)...');
        }
        this.showToast(finalNotice);
        let remaining = 3;
        const timer = window.setInterval(() => {
          remaining -= 1;
          if (remaining > 0) {
            if (confirmBtn) {
              confirmBtn.textContent = this.l(`Memuat Ulang (${remaining} dtk)...`, `Reloading (${remaining}s)...`);
            }
          } else {
            window.clearInterval(timer);
            closeModal();
            this.renderSettingsView(container);
          }
        }, 1000);
      };
      if (this.bridge.isWebViewHost) {
        void this.bridge
          .invoke<{ ok: boolean; message?: string }>('data:clear-all')
          .then((res) => {
            if (res && res.ok === false) {
              closeModal();
              this.showToast(res.message || this.l('Gagal menghapus data aplikasi.', 'Failed to clear application data.'));
              return;
            }
            finishAndCountdown(res?.message);
          });
        return;
      }
      finishAndCountdown();
    });
  });
  // Hotkey rebind logic
  let activeRecordingActionId: string | null = null;
  let recordingCleanUp: (() => void) | null = null;

  const cancelRecording = () => {
    if (recordingCleanUp) {
      recordingCleanUp();
      recordingCleanUp = null;
    }
    activeRecordingActionId = null;
  };

  container.querySelectorAll<HTMLButtonElement>('[data-rebind-action]').forEach((btn) => {
    btn.addEventListener('click', (ev) => {
      ev.stopPropagation();
      const actionId = btn.dataset.rebindAction;
      if (!actionId) return;

      if (activeRecordingActionId === actionId) {
        cancelRecording();
        this.renderSettingsView(container);
        return;
      }

      cancelRecording();
      activeRecordingActionId = actionId;

      const targetDef = HOTKEY_DEFINITIONS.find((d) => d.id === actionId);
      btn.classList.add('recording');
      btn.innerHTML = `<span class="v1-hotkey-recording-label">${this.l('Tekan tombol baru... (Esc untuk batal)', 'Press new key... (Esc to cancel)')}</span>`;

      const onKeyDown = (keyEv: KeyboardEvent) => {
        keyEv.preventDefault();
        keyEv.stopPropagation();

        if (keyEv.key === 'Escape') {
          cancelRecording();
          this.renderSettingsView(container);
          this.showToast(this.l('Perekaman tombol dibatalkan.', 'Key recording cancelled.'));
          return;
        }

        const serialized = this.serializeKeyboardEvent(keyEv);
        if (!serialized) {
          // Lone modifier key, keep waiting
          return;
        }

        // Check for conflict
        const conflict = this.findConflictingAction(serialized, actionId);
        if (conflict) {
          const oldTargetKey = this.getEffectiveHotkey(actionId);
          this.setCustomHotkey(conflict.id, oldTargetKey);
          this.setCustomHotkey(actionId, serialized);
          this.showToast(this.l(`Tombol "${serialized}" ditukar dengan "${conflict.label}".`, `Key "${serialized}" swapped with "${conflict.label}".`));
        } else {
          this.setCustomHotkey(actionId, serialized);
          this.showToast(this.l(`Pintasan "${targetDef?.label ?? actionId}" diatur ke: ${serialized}`, `Shortcut "${targetDef?.label ?? actionId}" set to: ${serialized}`));
        }

        cancelRecording();
        this.renderSettingsView(container);
      };

      const onDocClick = (clickEv: MouseEvent) => {
        if (!btn.contains(clickEv.target as Node)) {
          cancelRecording();
          if (this.currentTab === 'settings') {
            this.renderSettingsView(container);
          }
        }
      };

      window.addEventListener('keydown', onKeyDown, { capture: true });
      window.addEventListener('click', onDocClick);

      recordingCleanUp = () => {
        window.removeEventListener('keydown', onKeyDown, { capture: true });
        window.removeEventListener('click', onDocClick);
        btn.classList.remove('recording');
      };
    });
  });

  // Individual reset buttons
  container.querySelectorAll<HTMLButtonElement>('[data-reset-hotkey]').forEach((btn) => {
    btn.addEventListener('click', (ev) => {
      ev.stopPropagation();
      const actionId = btn.dataset.resetHotkey;
      if (!actionId) return;
      const def = HOTKEY_DEFINITIONS.find((d) => d.id === actionId);
      this.resetCustomHotkey(actionId);
      this.showToast(this.l(`Pintasan "${def?.label ?? actionId}" dikembalikan ke bawaan (${def?.defaultKey ?? ''}).`, `Shortcut "${def?.label ?? actionId}" reset to default (${def?.defaultKey ?? ''}).`));
      this.renderSettingsView(container);
    });
  });

  // Reset all hotkeys button with confirmation modal
  document.getElementById('btnResetAllHotkeys')?.addEventListener('click', () => {
    const existingOverlay = document.getElementById('resetHotkeysModalOverlay');
    if (existingOverlay) existingOverlay.remove();

    const overlay = document.createElement('div');
    overlay.id = 'resetHotkeysModalOverlay';
    overlay.style.cssText =
      'position:fixed;inset:0;background:rgba(15,23,42,0.55);backdrop-filter:blur(4px);z-index:99999;display:flex;align-items:center;justify-content:center;padding:16px;';
    overlay.innerHTML = `
      <div role="dialog" aria-modal="true" style="width:420px;max-width:92vw;background:var(--bg-surface,#ffffff);border:1px solid var(--border-subtle);border-radius:16px;padding:24px;box-shadow:0 20px 45px rgba(0,0,0,0.28);color:var(--ink-primary,#0f172a);font-family:inherit;">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;">
          <span style="display:inline-flex;align-items:center;justify-content:center;width:36px;height:36px;border-radius:10px;background:rgba(59,130,246,0.12);color:var(--ocean-primary,#3b82f6);flex-shrink:0;">
            ${getIconSvg('restart-linear', { size: 20 })}
          </span>
          <h3 style="margin:0;font-size:18px;font-weight:700;color:var(--ink-primary);">${this.l('Atur Ulang Semua Pintasan?', 'Reset All Shortcuts?')}</h3>
        </div>
        <p style="margin:0 0 22px 0;font-size:13.5px;line-height:1.55;color:var(--ink-secondary);">
          ${this.l('Apakah Anda yakin ingin mengembalikan semua pintasan tombol keyboard ke setelan awal bawaan aplikasi?', 'Are you sure you want to reset all keyboard shortcuts to application defaults?')}
        </p>
        <div style="display:flex;justify-content:flex-end;gap:10px;">
          <button id="btnCancelResetHotkeys" type="button" style="height:36px;padding:0 18px;border-radius:8px;border:1px solid var(--border-subtle);background:transparent;color:var(--ink-primary);font-size:13px;font-weight:600;cursor:pointer;">
            ${this.t('modal.cancel')}
          </button>
          <button id="btnConfirmResetHotkeys" type="button" style="height:36px;padding:0 18px;border-radius:8px;border:none;background:var(--ocean-primary,#0066CC);color:#ffffff;font-size:13px;font-weight:600;cursor:pointer;display:inline-flex;align-items:center;gap:6px;">
            ${getIconSvg('restart-linear', { size: 15 })}
            <span>${this.l('Kembalikan Bawaan', 'Reset Defaults')}</span>
          </button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    const closeResetModal = () => overlay.remove();
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeResetModal();
    });
    document.getElementById('btnCancelResetHotkeys')?.addEventListener('click', closeResetModal);
    document.getElementById('btnConfirmResetHotkeys')?.addEventListener('click', () => {
      closeResetModal();
      this.resetAllHotkeys();
      this.showToast(this.l('Semua tombol pintas berhasil dikembalikan ke bawaan pabrik.', 'All keyboard shortcuts reset to factory defaults.'));
      this.renderSettingsView(container);
    });
  });

  document.getElementById('btnAboutWebsite')?.addEventListener('click', () => {
    this.bridge.openExternalUrl('https://github.com/ArisaAkiyama/Yomic');
  });
  document.getElementById('btnAboutCheckUpdate')?.addEventListener('click', () => {
    const btn = document.getElementById('btnAboutCheckUpdate') as HTMLButtonElement | null;
    if (this.bridge.isWebViewHost) {
      if (btn && btn.dataset.updateUrl) {
        const dlUrl = btn.dataset.updateUrl;
        btn.disabled = true;
        btn.textContent = this.l('Mengunduh Pembaruan...', 'Downloading Update...');
        this.showToast(this.l('Mengunduh dan memasang pembaruan aplikasi Yomic...', 'Downloading and installing Yomic update...'));
        void this.bridge.invoke<{ ok?: boolean }>('app:install-update', { downloadUrl: dlUrl }, 120000).then((res) => {
          if (!res?.ok && btn) {
            btn.disabled = false;
            btn.textContent = this.l('Pasang Pembaruan', 'Install Update');
          }
        });
        return;
      }
      if (btn) {
        btn.disabled = true;
        btn.innerHTML = `${getIconSvg('refresh', { size: 14 })}<span>${this.l('Memeriksa...', 'Checking...')}</span>`;
      }
      void this.bridge
        .invoke<{
          isUpdateAvailable?: boolean;
          currentVersion?: string;
          latestVersion?: string;
          downloadUrl?: string;
        }>('app:check-update', undefined, 15000)
        .then((info) => {
          if (info?.isUpdateAvailable) {
            this.showToast(this.l(`Pembaruan tersedia: ${info.latestVersion}! Klik tombol lagi untuk memasang.`, `Update available: ${info.latestVersion}! Click the button again to install.`));
            if (btn) {
              btn.disabled = false;
              btn.dataset.updateUrl = info.downloadUrl || '';
              btn.innerHTML = `${getIconSvg('download', { size: 14 })}<span>${this.l(`Perbarui ke ${info.latestVersion}`, `Update to ${info.latestVersion}`)}</span>`;
            }
          } else {
            if (btn) {
              btn.disabled = false;
              btn.innerHTML = `${getIconSvg('refresh', { size: 14 })}<span>${this.l('Periksa Pembaruan', 'Check for Updates')}</span>`;
            }
            this.showToast(this.l(`Anda sudah menggunakan Yomic versi terbaru (v${info?.currentVersion || '2.0.0'}).`, `You are already using the latest version of Yomic (v${info?.currentVersion || '2.0.0'}).`));
          }
        })
        .catch(() => {
          if (btn) {
            btn.disabled = false;
            btn.innerHTML = `${getIconSvg('refresh', { size: 14 })}<span>${this.l('Periksa Pembaruan', 'Check for Updates')}</span>`;
          }
          this.showToast(this.l('Anda sudah menggunakan Yomic versi terbaru (v2.0.0).', 'You are already using the latest version of Yomic (v2.0.0).'));
        });
      return;
    }
    this.showToast(this.l('Anda sudah menggunakan Yomic versi terbaru (v2.0.0).', 'You are already using the latest version of Yomic (v2.0.0).'));
  });
  document.getElementById('btnAboutTrakteer')?.addEventListener('click', () => {
    this.bridge.openExternalUrl('https://trakteer.id/Arisa-Akiyama');
  });
  document.getElementById('btnAboutLicense')?.addEventListener('click', () => {
    this.bridge.openExternalUrl('https://github.com/ArisaAkiyama/Yomic/blob/master/LICENSE');
  });
  container.querySelectorAll<HTMLButtonElement>('[data-social-url]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const url = btn.dataset.socialUrl;
      if (url) this.bridge.openExternalUrl(url);
    });
  });

  if (isReRender) {
    if (savedContainerScroll > 0) container.scrollTop = savedContainerScroll;
    if (savedParentScroll > 0 && container.parentElement) container.parentElement.scrollTop = savedParentScroll;
  }
}
