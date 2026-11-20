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

  const activeSub = !this.activeSettingsTab || this.activeSettingsTab === 'all' ? 'hub' : this.activeSettingsTab;
  const subTitleMap: Record<string, string> = {
    appearance: this.l('Tampilan & Pembaca', 'Appearance & Reader'),
    library: this.l('Pustaka & Pembaruan', 'Library & Updates'),
    downloads: this.l('Unduhan', 'Downloads'),
    storage: this.l('Data & Penyimpanan', 'Data & Storage'),
    network: this.l('Jaringan & Sumber', 'Network & Sources'),
    tracker: this.l('Pelacak', 'Tracking'),
    hotkeys: this.l('Pintasan Keyboard', 'Keyboard Shortcuts'),
    about: this.l('Tentang', 'About')
  };

  const hubHtml = `
    <div class="v1-settings-hub">
      <!-- Quick Toggles Section (Ala Mobile Top Toggles) -->
      <div class="v1-settings-hub-list">
        <div class="v1-settings-hub-row is-toggle" data-toggle-setting="isDarkMode" role="switch" aria-checked="${this.settings.isDarkMode}">
          <div class="v1-settings-hub-icon">${getIconSvg('moon-linear', { size: 20 })}</div>
          <div class="v1-settings-hub-info">
            <span class="v1-settings-hub-title">${this.l('Mode Gelap', 'Dark Mode')}</span>
            <span class="v1-settings-hub-desc">${this.l('Tema gelap Carbon Dark untuk kenyamanan membaca di malam hari', 'Carbon Dark theme for comfortable night reading')}</span>
          </div>
          <div class="toggle-switch ${this.settings.isDarkMode ? 'on' : ''}">
            <div class="toggle-thumb"></div>
          </div>
        </div>
        <div class="v1-settings-hub-row is-toggle" data-toggle-setting="isOfflineMode" role="switch" aria-checked="${this.settings.isOfflineMode}">
          <div class="v1-settings-hub-icon">${getIconSvg('wifi-off', { size: 20 })}</div>
          <div class="v1-settings-hub-info">
            <span class="v1-settings-hub-title">${this.l('Mode Luring', 'Offline Mode')}</span>
            <span class="v1-settings-hub-desc">${this.l('Hanya tampilkan dan baca komik yang telah diunduh', 'Only display and read downloaded comics')}</span>
          </div>
          <div class="toggle-switch ${this.settings.isOfflineMode ? 'on' : ''}">
            <div class="toggle-thumb"></div>
          </div>
        </div>
      </div>

      <div class="v1-settings-hub-divider"></div>

      <!-- Category Navigation List (Ala Mobile Menu) -->
      <div class="v1-settings-hub-list">
        <button type="button" class="v1-settings-hub-row" data-open-settings-sub="appearance">
          <div class="v1-settings-hub-icon">${getIconSvg('palette-linear', { size: 20 })}</div>
          <div class="v1-settings-hub-info">
            <span class="v1-settings-hub-title">${this.l('Tampilan & Pembaca', 'Appearance & Reader')}</span>
            <span class="v1-settings-hub-desc">${this.l('Tema, bahasa, mode baca, arah halaman & kualitas gambar', 'Theme, language, reader mode, direction & image quality')}</span>
          </div>
          <span class="v1-settings-hub-chevron">${getIconSvg('arrow-right-s-line', { size: 18 })}</span>
        </button>

        <button type="button" class="v1-settings-hub-row" data-open-settings-sub="library">
          <div class="v1-settings-hub-icon">${getIconSvg('book-open-line', { size: 20 })}</div>
          <div class="v1-settings-hub-info">
            <span class="v1-settings-hub-title">${this.l('Pustaka & Pembaruan', 'Library & Updates')}</span>
            <span class="v1-settings-hub-desc">${this.l('Sinkronisasi otomatis, pembaruan cerdas & jadwal latar belakang', 'Auto-sync, smart updates & background schedule')}</span>
          </div>
          <span class="v1-settings-hub-chevron">${getIconSvg('arrow-right-s-line', { size: 18 })}</span>
        </button>

        <button type="button" class="v1-settings-hub-row" data-open-settings-sub="downloads">
          <div class="v1-settings-hub-icon">${getIconSvg('download-2-line', { size: 20 })}</div>
          <div class="v1-settings-hub-info">
            <span class="v1-settings-hub-title">${this.l('Unduhan', 'Downloads')}</span>
            <span class="v1-settings-hub-desc">${this.l('Lokasi folder, arsip CBZ, hapus otomatis & otomatisasi bab', 'Folder location, CBZ archives, auto-delete & chapter automation')}</span>
          </div>
          <span class="v1-settings-hub-chevron">${getIconSvg('arrow-right-s-line', { size: 18 })}</span>
        </button>

        <button type="button" class="v1-settings-hub-row" data-open-settings-sub="storage">
          <div class="v1-settings-hub-icon">${getIconSvg('database-2-line', { size: 20 })}</div>
          <div class="v1-settings-hub-info">
            <span class="v1-settings-hub-title">${this.l('Data & Penyimpanan', 'Data & Storage')}</span>
            <span class="v1-settings-hub-desc">${escapeXml(this.settings.dbSizeText || '0 MB')} · ${this.l('Cadangan, cache, riwayat & folder unduhan', 'Backup, cache, history & downloads folder')}</span>
          </div>
          <span class="v1-settings-hub-chevron">${getIconSvg('arrow-right-s-line', { size: 18 })}</span>
        </button>

        <button type="button" class="v1-settings-hub-row" data-open-settings-sub="network">
          <div class="v1-settings-hub-icon">${getIconSvg('global-linear', { size: 20 })}</div>
          <div class="v1-settings-hub-info">
            <span class="v1-settings-hub-title">${this.l('Jaringan & Sumber', 'Network & Sources')}</span>
            <span class="v1-settings-hub-desc">${this.l('DNS-over-HTTPS, mode luring & pemeriksaan status server', 'DNS-over-HTTPS, offline mode & server status checks')}</span>
          </div>
          <span class="v1-settings-hub-chevron">${getIconSvg('arrow-right-s-line', { size: 18 })}</span>
        </button>

        <button type="button" class="v1-settings-hub-row" data-open-settings-sub="tracker">
          <div class="v1-settings-hub-icon">${getIconSvg('link', { size: 20 })}</div>
          <div class="v1-settings-hub-info">
            <span class="v1-settings-hub-title">${this.l('Pelacak', 'Tracking')}</span>
            <span class="v1-settings-hub-desc">${
              this.settings.isMalConnected
                ? this.l(`Terhubung ke MyAnimeList (${escapeXml(this.settings.malConnectedUser)})`, `Connected to MyAnimeList (${escapeXml(this.settings.malConnectedUser)})`)
                : this.l('Sinkronisasi otomatis progres baca dengan MyAnimeList', 'Auto-sync reading progress with MyAnimeList')
            }</span>
          </div>
          <span class="v1-settings-hub-chevron">${getIconSvg('arrow-right-s-line', { size: 18 })}</span>
        </button>

        <button type="button" class="v1-settings-hub-row" data-open-settings-sub="hotkeys">
          <div class="v1-settings-hub-icon">${getIconSvg('command-linear', { size: 20 })}</div>
          <div class="v1-settings-hub-info">
            <span class="v1-settings-hub-title">${this.l('Pintasan Keyboard', 'Keyboard Shortcuts')}</span>
            <span class="v1-settings-hub-desc">${this.l('Atur tombol pintas pembaca komik & navigasi aplikasi', 'Configure reader & application navigation shortcuts')}</span>
          </div>
          <span class="v1-settings-hub-chevron">${getIconSvg('arrow-right-s-line', { size: 18 })}</span>
        </button>

        <button type="button" class="v1-settings-hub-row" data-open-settings-sub="about">
          <div class="v1-settings-hub-icon">${getIconSvg('info-circle-linear', { size: 20 })}</div>
          <div class="v1-settings-hub-info">
            <span class="v1-settings-hub-title">${this.l('Tentang', 'About')}</span>
            <span class="v1-settings-hub-desc">${this.l('Informasi versi, pembaruan sistem, catatan rilis & reset aplikasi', 'Version info, system updates, release notes & app reset')}</span>
          </div>
          <span class="v1-settings-hub-chevron">${getIconSvg('arrow-right-s-line', { size: 18 })}</span>
        </button>
      </div>
    </div>
  `;

  container.innerHTML = `
    <div class="v1-settings-page">
      <!-- Header: Settings Icon + Title (or Sub-Page Back Button) -->
      <div class="v1-lib-top" style="margin-bottom:4px;">
        <div class="v1-lib-title-row">
          ${
            activeSub === 'hub'
              ? `${getIconSvg('settings-3-line', { size: 24 })}
                 <span class="v1-lib-title-text">${this.t('settings.title')}</span>`
              : `<button type="button" id="btnBackToSettingsHub" class="v1-settings-back-btn" title="${escapeXml(this.l('Kembali ke Pengaturan', 'Back to Settings'))}" aria-label="${escapeXml(this.l('Kembali ke Pengaturan', 'Back to Settings'))}">
                   ${getIconSvg('arrow-left-line', { size: 22 })}
                 </button>
                 <span class="v1-lib-title-text">${escapeXml(subTitleMap[activeSub] || this.t('settings.title'))}</span>`
          }
        </div>
      </div>
      ${activeSub === 'hub' ? hubHtml : ''}
      <!-- 1A. TEMA (Ala Mobile Gambar 1) -->
      <section class="v1-settings-section" style="${activeSub === 'appearance' ? '' : 'display:none;'}">
        <div class="v1-settings-sec-head">
          <h2 class="v1-settings-sec-title">${this.l('Tema', 'Theme')}</h2>
        </div>
        <div class="v1-settings-group">
          <div class="v1-setting-row">
            <div class="v1-setting-info">
              <div class="v1-setting-title-row">
                <span class="v1-setting-title">${this.l('Mode Gelap', 'Dark Mode')}</span>
              </div>
              <span class="v1-setting-desc">${this.l('Beralih antara Carbon Dark dan Oceanic Light', 'Switch between Carbon Dark and Oceanic Light')}</span>
            </div>
            <div class="toggle-switch ${this.settings.isDarkMode ? 'on' : ''}" data-toggle-setting="isDarkMode" role="switch" aria-checked="${this.settings.isDarkMode}">
              <div class="toggle-thumb"></div>
            </div>
          </div>
        </div>
      </section>
      <!-- 1B. TAMPILAN & BAHASA (Ala Mobile Gambar 1) -->
      <section class="v1-settings-section has-top-divider" style="${activeSub === 'appearance' ? '' : 'display:none;'}">
        <div class="v1-settings-sec-head">
          <h2 class="v1-settings-sec-title">${this.l('Tampilan &amp; Bahasa', 'Display &amp; Language')}</h2>
        </div>
        <div class="v1-settings-group">
          <div class="v1-setting-row is-select-row">
            <div class="v1-setting-info">
              <div class="v1-setting-title-row">
                <span class="v1-setting-title">${this.l('Bahasa Antarmuka', 'Interface Language')}</span>
              </div>
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
                <span class="v1-setting-title">${this.l('Lencana bab belum dibaca', 'Unread chapter badges')}</span>
              </div>
              <span class="v1-setting-desc">${this.l('Tampilkan jumlah bab baru pada sampul pustaka', 'Show unread chapter count on library covers')}</span>
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
      <!-- 1C. PEMBACA -->
      <section class="v1-settings-section has-top-divider" style="${activeSub === 'appearance' ? '' : 'display:none;'}">
        <div class="v1-settings-sec-head">
          <h2 class="v1-settings-sec-title">${this.l('Pembaca', 'Reader')}</h2>
        </div>
        <div class="v1-settings-group">
          <div class="v1-setting-row is-select-row">
            <div class="v1-setting-info">
              <div class="v1-setting-title-row">
                <span class="v1-setting-title">${this.t('settings.appearance.readerModeTitle')}</span>
              </div>
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
          <div class="v1-setting-row is-select-row">
            <div class="v1-setting-info">
              <div class="v1-setting-title-row">
                <span class="v1-setting-title">${this.t('settings.appearance.directionTitle')}</span>
              </div>
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
          <div class="v1-setting-row is-select-row">
            <div class="v1-setting-info">
              <div class="v1-setting-title-row">
                <span class="v1-setting-title">${this.t('settings.appearance.fitModeTitle')}</span>
              </div>
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
        </div>
      </section>
      <!-- 1D. UNDUHAN — PERILAKU UNDUHAN (Ala Mobile Gambar 1) -->
      <section class="v1-settings-section" style="${activeSub === 'downloads' ? '' : 'display:none;'}">
        <div class="v1-settings-sec-head">
          <h2 class="v1-settings-sec-title">${this.l('Perilaku unduhan', 'Download behavior')}</h2>
        </div>
        <div class="v1-settings-group">
          <button type="button" id="btnOpenDownloadsFolderFromDl" class="v1-setting-row is-action-row">
            <div class="v1-setting-info">
              <div class="v1-setting-title-row">
                <span class="v1-setting-title">${this.l('Folder Penyimpanan Unduhan', 'Downloads Storage Folder')}</span>
              </div>
              <span class="v1-setting-desc">${escapeXml(this.settings.downloadsFolder)}</span>
            </div>
          </button>
          <div class="v1-setting-row">
            <div class="v1-setting-info">
              <div class="v1-setting-title-row">
                <span class="v1-setting-title">${this.l('Simpan bab sebagai arsip CBZ', 'Save chapters as CBZ archives')}</span>
              </div>
              <span class="v1-setting-desc">${this.l('Gabungkan halaman unduhan menjadi satu file .cbz', 'Combine downloaded pages into a single .cbz file')}</span>
            </div>
            <div class="toggle-switch ${this.settings.saveDownloadsAsCbz ? 'on' : ''}" data-toggle-setting="saveDownloadsAsCbz" role="switch" aria-checked="${this.settings.saveDownloadsAsCbz}">
              <div class="toggle-thumb"></div>
            </div>
          </div>
        </div>
      </section>
      <!-- 1E. UNDUHAN — OTOMATISASI (Ala Mobile Gambar 1) -->
      <section class="v1-settings-section has-top-divider" style="${activeSub === 'downloads' ? '' : 'display:none;'}">
        <div class="v1-settings-sec-head">
          <h2 class="v1-settings-sec-title">${this.l('Otomatisasi', 'Automation')}</h2>
        </div>
        <div class="v1-settings-group">
          <div class="v1-setting-row">
            <div class="v1-setting-info">
              <div class="v1-setting-title-row">
                <span class="v1-setting-title">${this.l('Hapus otomatis setelah dibaca', 'Auto-delete after reading')}</span>
              </div>
              <span class="v1-setting-desc">${this.l('Hapus file bab unduhan otomatis setelah selesai dibaca', 'Automatically delete downloaded chapter files after reading')}</span>
            </div>
            <div class="toggle-switch ${this.settings.autoDeleteAfterRead ? 'on' : ''}" data-toggle-setting="autoDeleteAfterRead" role="switch" aria-checked="${this.settings.autoDeleteAfterRead}">
              <div class="toggle-thumb"></div>
            </div>
          </div>
          <div class="v1-setting-row">
            <div class="v1-setting-info">
              <div class="v1-setting-title-row">
                <span class="v1-setting-title">${this.l('Unduh otomatis bab berikutnya', 'Auto-download next chapter')}</span>
              </div>
              <span class="v1-setting-desc">${this.l('Otomatis antrekan bab berikutnya saat membaca', 'Automatically queue the next chapter while reading')}</span>
            </div>
            <div class="toggle-switch ${this.settings.autoDownloadNextChapter ? 'on' : ''}" data-toggle-setting="autoDownloadNextChapter" role="switch" aria-checked="${this.settings.autoDownloadNextChapter}">
              <div class="toggle-thumb"></div>
            </div>
          </div>
          <div class="v1-setting-row">
            <div class="v1-setting-info">
              <div class="v1-setting-title-row">
                <span class="v1-setting-title">${this.l('Pra-muat bab berikutnya', 'Preload next chapter')}</span>
              </div>
              <span class="v1-setting-desc">${this.l('Muat halaman berikutnya lebih awal agar gulir mulus', 'Preload upcoming pages early for smooth scrolling')}</span>
            </div>
            <div class="toggle-switch ${this.settings.preloadNextChapter ? 'on' : ''}" data-toggle-setting="preloadNextChapter" role="switch" aria-checked="${this.settings.preloadNextChapter}">
              <div class="toggle-thumb"></div>
            </div>
          </div>
          <div class="v1-setting-row">
            <div class="v1-setting-info">
              <div class="v1-setting-title-row">
                <span class="v1-setting-title">${this.l('Lewati bab yang difilter', 'Skip filtered chapters')}</span>
              </div>
              <span class="v1-setting-desc">${this.l('Lewati bab terfilter saat berpindah bab', 'Skip filtered chapters when navigating between chapters')}</span>
            </div>
            <div class="toggle-switch ${this.settings.skipFilteredChapters ? 'on' : ''}" data-toggle-setting="skipFilteredChapters" role="switch" aria-checked="${this.settings.skipFilteredChapters}">
              <div class="toggle-thumb"></div>
            </div>
          </div>
        </div>
      </section>
      <!-- 2. PEMROSESAN & KUALITAS GAMBAR (SKIASHARP) -->
      <section class="v1-settings-section has-top-divider" style="${activeSub === 'appearance' ? '' : 'display:none;'}">
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
      <section class="v1-settings-section" style="${activeSub === 'hotkeys' ? '' : 'display:none;'}">
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
      <section class="v1-settings-section" style="${activeSub === 'library' ? '' : 'display:none;'}">
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
      <section class="v1-settings-section" style="${activeSub === 'network' ? '' : 'display:none;'}">
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
      <!-- 4A. CADANGAN DAN PEMULIHAN (Ala Mobile Gambar 2) -->
      <section class="v1-settings-section" style="${activeSub === 'storage' ? '' : 'display:none;'}">
        <div class="v1-settings-sec-head">
          <h2 class="v1-settings-sec-title">${this.l('Cadangan dan pemulihan', 'Backup and restore')}</h2>
        </div>
        <div class="v1-settings-group">
          <button type="button" id="btnCreateBackup" class="v1-setting-row is-action-row">
            <div class="v1-setting-info">
              <div class="v1-setting-title-row">
                <span class="v1-setting-title">${this.l('Buat Cadangan', 'Create Backup')}</span>
              </div>
              <span id="createBackupDesc" class="v1-setting-desc">${escapeXml(this.settings.lastBackupText || this.l('Siap dicadangkan (.yomicbackup)', 'Ready to back up (.yomicbackup)'))}</span>
            </div>
          </button>
          <button type="button" id="btnRestoreBackup" class="v1-setting-row is-action-row">
            <div class="v1-setting-info">
              <div class="v1-setting-title-row">
                <span class="v1-setting-title">${this.l('Pulihkan Cadangan', 'Restore Backup')}</span>
              </div>
              <span id="restoreBackupDesc" class="v1-setting-desc">${this.l('Impor pustaka, kategori, dan progres baca dari file', 'Import library, categories, and reading progress from file')}</span>
            </div>
          </button>
        </div>
      </section>
      <!-- 4B. PENYIMPANAN & CACHE (Ala Mobile Gambar 2) -->
      <section class="v1-settings-section has-top-divider" style="${activeSub === 'storage' ? '' : 'display:none;'}">
        <div class="v1-settings-sec-head">
          <h2 class="v1-settings-sec-title">${this.l('Penyimpanan &amp; Cache', 'Storage &amp; Cache')}</h2>
        </div>
        <div class="v1-settings-group">
          <div class="v1-setting-row is-select-row">
            <div class="v1-setting-info">
              <div class="v1-setting-title-row">
                <span class="v1-setting-title">${this.l('Kapasitas cache pembaca', 'Reader cache capacity')}</span>
              </div>
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
              this.l('Kapasitas cache pembaca', 'Reader cache capacity')
            )}
          </div>
          <button type="button" id="btnDangerClearCache" class="v1-setting-row is-action-row">
            <div class="v1-setting-info">
              <div class="v1-setting-title-row">
                <span class="v1-setting-title">${this.l('Bersihkan Cache', 'Clear Cache')}</span>
              </div>
              <span id="clearCacheDesc" class="v1-setting-desc">${this.l('Terpakai:', 'Used:')} ${escapeXml(this.settings.dbSizeText)}</span>
            </div>
          </button>
          <button type="button" id="btnClearNonLibraryCache" class="v1-setting-row is-action-row">
            <div class="v1-setting-info">
              <div class="v1-setting-title-row">
                <span class="v1-setting-title">${this.l('Hapus Cache Non-Pustaka', 'Clear Non-Library Cache')}</span>
              </div>
              <span id="clearNonLibDesc" class="v1-setting-desc">${this.l('Hapus berkas gambar dan metadata komik yang tidak tersimpan di pustaka', 'Delete image files and comic metadata not saved in library')}</span>
            </div>
          </button>
          <button type="button" id="btnOpenDownloadsFolder" class="v1-setting-row is-action-row">
            <div class="v1-setting-info">
              <div class="v1-setting-title-row">
                <span class="v1-setting-title">${this.l('Folder Penyimpanan Unduhan', 'Downloads Storage Folder')}</span>
              </div>
              <span class="v1-setting-desc">${escapeXml(this.settings.downloadsFolder)}</span>
            </div>
          </button>
          <button type="button" id="btnExportAppLogs" class="v1-setting-row is-action-row">
            <div class="v1-setting-info">
              <div class="v1-setting-title-row">
                <span class="v1-setting-title">${this.l('Ekspor Log Aplikasi', 'Export App Logs')}</span>
              </div>
              <span class="v1-setting-desc">${this.l('Simpan berkas catatan aktivitas dan diagnostik aplikasi (.log)', 'Save application activity and diagnostic log files (.log)')}</span>
            </div>
          </button>
          <button type="button" id="btnDangerClearHistory" class="v1-setting-row is-action-row is-danger-row">
            <div class="v1-setting-info">
              <div class="v1-setting-title-row">
                <span class="v1-setting-title">${this.l('Kosongkan riwayat baca', 'Clear reading history')}</span>
              </div>
              <span id="clearHistoryDesc" class="v1-setting-desc">${this.l('Hapus daftar riwayat tanpa menghapus komik dari pustaka', 'Clear history list without removing comics from library')}</span>
            </div>
          </button>
        </div>
      </section>
      <!-- 5. PELACAKAN (TRACKER) -->
      <section id="settingsTrackerSection" class="v1-settings-section" style="${activeSub === 'tracker' ? '' : 'display:none;'}">
        <div class="v1-settings-sec-head">
          <h2 class="v1-settings-sec-title">${this.l('Layanan Pelacak', 'Tracking Services')}</h2>
        </div>
        <div class="v1-settings-group">
          <button type="button" id="btnToggleMalConnect" class="v1-setting-row is-action-row">
            <div class="v1-setting-info">
              <div class="v1-setting-title-row">
                <span class="v1-setting-title">MyAnimeList</span>
              </div>
              <span id="malConnectDesc" class="v1-setting-desc">
                ${
                  this.settings.isMalConnected
                    ? this.t('settings.tracker.malConnectedAs', { user: escapeXml(this.settings.malConnectedUser) })
                    : this.t('settings.tracker.malNotConnected')
                }
              </span>
            </div>
          </button>
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
      <!-- 5. TENTANG (Ala Mobile Gambar 1) -->
      <section class="v1-settings-section" style="${activeSub === 'about' ? '' : 'display:none;'}">
        <div class="v1-about-mobile-hero">
          <img src="assets/app-logo.png" class="v1-about-mobile-logo" alt="Yomic Logo" onerror="this.src='app-logo.png'" />
          <span class="v1-about-mobile-title">Yomic</span>
        </div>

        <div class="v1-settings-hub-divider" style="margin: 12px 0;"></div>

        <div class="v1-settings-group">
          <div class="v1-setting-row">
            <div class="v1-setting-info">
              <div class="v1-setting-title-row">
                <span class="v1-setting-title">${this.l('Versi', 'Version')}</span>
              </div>
              <span class="v1-setting-desc">Stable 2.1.0 (Windows Desktop)</span>
            </div>
          </div>

          <button type="button" id="btnAboutCheckUpdate" class="v1-setting-row is-action-row">
            <div class="v1-setting-info">
              <div class="v1-setting-title-row">
                <span id="aboutCheckUpdateTitle" class="v1-setting-title">${this.l('Periksa Pembaruan', 'Check for Updates')}</span>
              </div>
              <span id="aboutCheckUpdateDesc" class="v1-setting-desc">${this.l('Periksa versi rilis terbaru dari server', 'Check latest release version from server')}</span>
            </div>
          </button>

          <button type="button" id="btnToggleReleaseNotes" class="v1-setting-row is-action-row" aria-expanded="false">
            <div class="v1-setting-info">
              <div class="v1-setting-title-row">
                <span class="v1-setting-title">${this.l('Catatan rilis', 'Release notes')}</span>
              </div>
              <span class="v1-setting-desc">v2.1.0</span>
            </div>
            <span id="aboutReleaseNotesChevron" class="v1-about-release-chevron">
              ${getIconSvg('alt-arrow-down-linear', { size: 18 })}
            </span>
          </button>
          <div id="aboutReleaseNotesPanel" class="v1-about-release-notes" style="display:none;">
            <div class="v1-about-release-head">[2.1.0] - Update</div>
            <div class="v1-about-release-subhead">Update Details:</div>
            <ul class="v1-about-release-list">
              <li>Add smart WebView2 chapter page extractor window (WebViewPageExtractorWindow) that runs off-screen silently during an 8-second grace period to resolve automatic security checks without popups, and automatically reveals itself centered on screen only when interactive verification (Cloudflare Turnstile / CAPTCHA) is required.</li>
              <li>Add custom per-source WebView page extraction hooks (chapterReadySelector &amp; pageWebViewExtractScript) and verification status reporting (GetPageListWithStatusAsync &amp; RequiresVerification) in JsMangaSource.</li>
              <li>Add automatic &amp; manual WebView verification fallback flow in BackendIpcController (reader:pages with manualVerify &amp; requiresVerification flags) to seamlessly recover chapter image lists when HTTP scraping is gated by dynamic client-side challenges.</li>
              <li>Add "Verify in WebView" (Verifikasi di WebView) interactive recovery button and dedicated "Security Verification Required" state in Reader view (reader.ts) when a chapter requires user verification.</li>
              <li>Add dynamic Next.js Server Action ID resolver (resolveUnlockActionId) in VoraToon extension (voratoon.js v1.2.1) to automatically extract the active unlockChapterPages action hash from Next.js series chunks instead of relying on a static hardcoded hash.</li>
              <li>Add automatic Next-Action cache invalidation and 404 retry logic in VoraToon extension when unlocking pagesTicket chapter images, plus automatic Turnstile/pagesTicket verification detection.</li>
              <li>Add standard multi-resolution Windows application icon (Assets/app.ico) containing 16x16, 24x24, 32x32, 48x48, and 64x64 32-bit ARGB BMP DIB frames alongside a 256x256 high-DPI PNG frame for crisp rendering across Windows 11 Taskbar, Desktop shortcuts, and Start Menu.</li>
              <li>Improve RSC (React Server Components) JSON chunk parser performance in voratoon.js using compiled regular expression token scanning instead of character-by-character loops.</li>
              <li>Improve MSBuild output packaging in YomicDesktop.csproj and Inno Setup script (Installer/Yomic.iss) to deploy app.ico to both {app}\app.ico and {app}\Assets\app.ico while keeping Assets/app.ico embedded as a WPF resource.</li>
              <li>Fix blank white document icon on Windows 11 Taskbar, Desktop shortcut, and Start Menu shortcut after installation by ensuring {app}\app.ico is always packaged and deployed by the installer.</li>
              <li>Fix startup XamlParseException / DirectoryNotFoundException crash on MainWindow initialization by keeping Assets/app.ico as an embedded WPF Resource instead of an external AssemblyAssociatedContentFile.</li>
              <li>Fix VoraToon chapter images failing to load when Next.js deployment updates rotate the unlockChapterPages Server Action ID or require client-side ticket verification.</li>
            </ul>
          </div>
        </div>

        <div class="v1-settings-hub-divider" style="margin: 12px 0;"></div>

        <div class="v1-settings-group">
          <button type="button" id="btnDangerResetAll" class="v1-setting-row is-action-row is-danger-row">
            <div class="v1-setting-info">
              <div class="v1-setting-title-row">
                <span class="v1-setting-title">${this.l('Reset Aplikasi', 'Reset Application')}</span>
              </div>
              <span class="v1-setting-desc">${this.l('Kembalikan seluruh pengaturan dan data ke bawaan', 'Restore all settings and data to factory defaults')}</span>
            </div>
          </button>
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

  // Hub Category Navigation & Sub-Page Back Button
  container.querySelectorAll<HTMLElement>('[data-open-settings-sub]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const sub = btn.dataset.openSettingsSub;
      if (sub) {
        this.activeSettingsTab = sub;
        container.scrollTop = 0;
        if (container.parentElement) container.parentElement.scrollTop = 0;
        this.renderSettingsView(container);
      }
    });
  });

  document.getElementById('btnBackToSettingsHub')?.addEventListener('click', () => {
    this.activeSettingsTab = 'hub';
    container.scrollTop = 0;
    if (container.parentElement) container.parentElement.scrollTop = 0;
    this.renderSettingsView(container);
  });

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
        } else if (key === 'saveDownloadsAsCbz') {
          this.showToast(
            this.settings.saveDownloadsAsCbz
              ? this.l('Unduhan baru akan disimpan sebagai arsip .cbz.', 'New downloads will be saved as .cbz archives.')
              : this.l('Unduhan baru akan disimpan sebagai folder gambar biasa.', 'New downloads will be saved as regular image folders.')
          );
        } else if (key === 'autoDeleteAfterRead') {
          this.showToast(
            this.settings.autoDeleteAfterRead
              ? this.l('Hapus otomatis bab unduhan setelah selesai dibaca diaktifkan.', 'Auto-delete downloaded chapters after reading enabled.')
              : this.l('Hapus otomatis bab unduhan setelah selesai dibaca dinonaktifkan.', 'Auto-delete downloaded chapters after reading disabled.')
          );
        }
        this.renderSettingsView(container);
      }
    });
  });

  // Mobile-Style Centered Selection Pop-Up Modal for all Settings Select Rows
  const openSettingSelectModal = (
    titleText: string,
    options: { value: string; label: string }[],
    currentValue: string,
    onSelect: (val: string, label: string) => void
  ) => {
    document.getElementById('settingSelectModalOverlay')?.remove();
    const checkIcon = getIconSvg('check', { size: 16, strokeWidth: 2.4 });
    const overlay = document.createElement('div');
    overlay.id = 'settingSelectModalOverlay';
    overlay.className = 'v1-setting-select-modal-overlay';
    overlay.innerHTML = `
      <div class="v1-setting-select-modal" role="dialog" aria-modal="true" aria-label="${escapeXml(titleText)}">
        <h3 class="v1-setting-select-title">${escapeXml(titleText)}</h3>
        <div class="v1-setting-select-list" role="listbox">
          ${options
            .map((opt) => {
              const isSelected = opt.value === currentValue;
              return `
                <button type="button" class="v1-setting-select-option ${isSelected ? 'selected' : ''}" data-select-value="${escapeXml(opt.value)}" role="option" aria-selected="${isSelected ? 'true' : 'false'}">
                  <span class="v1-setting-select-check">${isSelected ? checkIcon : ''}</span>
                  <span class="v1-setting-select-label">${escapeXml(opt.label)}</span>
                </button>
              `;
            })
            .join('')}
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    const closeModal = () => {
      window.removeEventListener('keydown', onEscKey);
      overlay.remove();
    };
    const onEscKey = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') {
        closeModal();
      }
    };
    window.addEventListener('keydown', onEscKey);

    overlay.addEventListener('click', (ev) => {
      if (ev.target === overlay) {
        closeModal();
      }
    });

    overlay.querySelectorAll<HTMLButtonElement>('.v1-setting-select-option').forEach((btn) => {
      btn.addEventListener('click', (ev) => {
        ev.stopPropagation();
        const val = btn.dataset.selectValue ?? '';
        const label = btn.querySelector('.v1-setting-select-label')?.textContent ?? '';
        closeModal();
        onSelect(val, label);
      });
    });
  };

  container.querySelectorAll<HTMLElement>('.v1-setting-dropdown').forEach((dropdown) => {
    const trigger = dropdown.querySelector<HTMLButtonElement>('.v1-mal-dropdown-trigger');
    const optionBtns = Array.from(dropdown.querySelectorAll<HTMLButtonElement>('.v1-mal-dropdown-option'));
    const targetId = dropdown.dataset.dropdownFor;
    const row = dropdown.closest<HTMLElement>('.v1-setting-row');

    const handleOpenPopup = (ev: Event) => {
      ev.stopPropagation();
      const input = targetId ? (document.getElementById(targetId) as HTMLInputElement | null) : null;
      const currentVal = input?.value ?? '';
      const rowTitle =
        row?.querySelector('.v1-setting-title')?.textContent?.trim() ||
        trigger?.getAttribute('aria-label') ||
        '';
      const opts = optionBtns.map((btn) => ({
        value: btn.dataset.value ?? '',
        label: btn.querySelector('span')?.textContent ?? ''
      }));

      openSettingSelectModal(rowTitle, opts, currentVal, (val, labelText) => {
        const valueSpan = dropdown.querySelector<HTMLElement>('.v1-mal-dropdown-value');
        if (valueSpan) valueSpan.textContent = labelText;

        optionBtns.forEach((opt) => {
          const selected = (opt.dataset.value ?? '') === val;
          opt.classList.toggle('selected', selected);
          opt.setAttribute('aria-selected', selected ? 'true' : 'false');
        });

        if (input && input.value !== val) {
          input.value = val;
          input.dispatchEvent(new Event('change', { bubbles: true }));
        }
      });
    };

    if (row) {
      row.classList.add('is-select-row');
      row.addEventListener('click', handleOpenPopup);
    }
    trigger?.addEventListener('click', handleOpenPopup);
  });

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
    const descEl = document.getElementById('clearNonLibDesc');
    if (btn) btn.disabled = true;
    if (descEl) descEl.textContent = this.l('Menghapus berkas cache non-pustaka...', 'Clearing non-library cache files...');
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
          if (btn) btn.disabled = false;
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
  const openDownloadsFolderAction = () => {
    this.bridge.openFolder();
    this.showToast(this.l('Membuka folder unduhan di File Explorer...', 'Opening downloads folder in File Explorer...'));
  };
  document.getElementById('btnOpenDownloadsFolder')?.addEventListener('click', openDownloadsFolderAction);
  document.getElementById('btnOpenDownloadsFolderFromDl')?.addEventListener('click', openDownloadsFolderAction);
  document.getElementById('btnDangerClearCache')?.addEventListener('click', () => {
    const btn = document.getElementById('btnDangerClearCache') as HTMLButtonElement | null;
    const descEl = document.getElementById('clearCacheDesc');
    if (btn) btn.disabled = true;
    if (descEl) descEl.textContent = this.l('Membersihkan cache...', 'Clearing cache...');
    if (this.bridge.isWebViewHost) {
      void this.bridge
        .invoke<{ dbSizeText?: string }>('settings:clear-cache', undefined, 60000)
        .then((res) => {
          this.settings.dbSizeText = res?.dbSizeText || '0.0 MB';
          this.renderSettingsView(container);
          this.showToast(this.l('Seluruh berkas cache gambar berhasil dibersihkan.', 'All image cache files cleared.'));
        })
        .finally(() => {
          if (btn) btn.disabled = false;
        });
      return;
    }
    this.settings.dbSizeText = '0.0 MB';
    this.renderSettingsView(container);
    this.showToast(this.l('Seluruh berkas cache gambar berhasil dibersihkan.', 'All image cache files cleared.'));
  });
  document.getElementById('btnDangerClearHistory')?.addEventListener('click', () => {
    const btn = document.getElementById('btnDangerClearHistory') as HTMLButtonElement | null;
    const descEl = document.getElementById('clearHistoryDesc');
    if (btn) btn.disabled = true;
    if (descEl) descEl.textContent = this.l('Menghapus riwayat baca...', 'Clearing reading history...');
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
          if (btn) btn.disabled = false;
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
    const descEl = document.getElementById('createBackupDesc');
    if (this.bridge.isWebViewHost) {
      if (btn) btn.disabled = true;
      if (descEl) descEl.textContent = this.l('Membuat berkas cadangan...', 'Creating backup file...');
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
          if (btn) btn.disabled = false;
          if (descEl) descEl.textContent = this.settings.lastBackupText || this.l('Siap dicadangkan (.yomicbackup)', 'Ready to back up (.yomicbackup)');
        });
      return;
    }
    this.settings.lastBackupText = this.l('Cadangan terakhir: Baru saja disimpan', 'Last backup: Just saved');
    this.renderSettingsView(container);
    this.showToast(this.l('Berkas cadangan (.yomicbackup) berhasil dibuat.', 'Backup file (.yomicbackup) created.'));
  });
  document.getElementById('btnRestoreBackup')?.addEventListener('click', () => {
    const btn = document.getElementById('btnRestoreBackup') as HTMLButtonElement | null;
    const descEl = document.getElementById('restoreBackupDesc');
    if (this.bridge.isWebViewHost) {
      if (btn) btn.disabled = true;
      if (descEl) descEl.textContent = this.l('Memulihkan cadangan...', 'Restoring backup...');
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
          if (btn) btn.disabled = false;
          if (descEl) descEl.textContent = this.l('Impor pustaka, kategori, dan progres baca dari file', 'Import library, categories, and reading progress from file');
        });
      return;
    }
    this.showToast(this.l('Memilih berkas cadangan (.yomicbackup) untuk dipulihkan...', 'Selecting backup file (.yomicbackup) to restore...'));
  });
  document.getElementById('btnToggleMalConnect')?.addEventListener('click', () => {
    const btn = document.getElementById('btnToggleMalConnect') as HTMLButtonElement | null;
    const descEl = document.getElementById('malConnectDesc');
    const wasConnected = this.settings.isMalConnected;

    const executeMalToggle = () => {
      if (this.bridge.isWebViewHost) {
        if (!wasConnected) {
          this.showToast(this.l('Membuka browser untuk login MyAnimeList...', 'Opening browser for MyAnimeList login...'));
          if (btn) btn.disabled = true;
          if (descEl) descEl.textContent = this.l('Menunggu login di browser...', 'Waiting for browser login...');
        } else if (btn) {
          btn.disabled = true;
          if (descEl) descEl.textContent = this.l('Memutuskan koneksi...', 'Disconnecting...');
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
            if (btn) btn.disabled = false;
            if (descEl) {
              descEl.textContent = this.settings.isMalConnected
                ? this.t('settings.tracker.malConnectedAs', { user: this.settings.malConnectedUser })
                : this.t('settings.tracker.malNotConnected');
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
    };

    if (wasConnected) {
      document.getElementById('malDisconnectModalOverlay')?.remove();
      const overlay = document.createElement('div');
      overlay.id = 'malDisconnectModalOverlay';
      overlay.style.cssText =
        'position:fixed;inset:0;background:rgba(0,0,0,0.65);z-index:99999;display:flex;align-items:center;justify-content:center;padding:16px;';
      overlay.innerHTML = `
        <div role="dialog" aria-modal="true" style="width:360px;max-width:92vw;background:var(--bg-surface,#18181b);border:none;border-radius:20px;padding:24px 24px 20px;box-shadow:0 24px 48px rgba(0,0,0,0.45);color:var(--ink-primary,#f4f4f5);font-family:inherit;">
          <h3 style="margin:0 0 10px 0;font-size:19px;font-weight:700;color:var(--ink-primary,#f4f4f5);letter-spacing:-0.01em;">
            ${this.l('Putuskan MyAnimeList', 'Disconnect MyAnimeList')}
          </h3>
          <p style="margin:0 0 22px 0;font-size:13.5px;line-height:1.5;color:var(--ink-secondary,#a1a1aa);">
            ${this.l(
              `Putuskan koneksi akun MyAnimeList (${escapeXml(this.settings.malConnectedUser)}) dari Yomic?`,
              `Disconnect MyAnimeList account (${escapeXml(this.settings.malConnectedUser)}) from Yomic?`
            )}
          </p>
          <div style="display:flex;justify-content:flex-end;align-items:center;gap:12px;">
            <button id="btnCancelMalDisconnect" type="button" style="height:38px;padding:0 14px;border-radius:10px;border:none;background:transparent;color:var(--ink-secondary,#a1a1aa);font-size:13.5px;font-weight:600;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;">
              ${this.t('modal.cancel')}
            </button>
            <button id="btnConfirmMalDisconnect" type="button" style="height:38px;padding:0 20px;border-radius:10px;border:none;background:#f43f5e;color:#ffffff;font-size:13.5px;font-weight:600;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;">
              <span>${this.l('Putuskan', 'Disconnect')}</span>
            </button>
          </div>
        </div>
      `;
      document.body.appendChild(overlay);
      const closeModal = () => {
        window.removeEventListener('keydown', onEsc);
        overlay.remove();
      };
      const onEsc = (ev: KeyboardEvent) => {
        if (ev.key === 'Escape') closeModal();
      };
      window.addEventListener('keydown', onEsc);
      overlay.addEventListener('click', (ev) => {
        if (ev.target === overlay) closeModal();
      });
      document.getElementById('btnCancelMalDisconnect')?.addEventListener('click', closeModal);
      document.getElementById('btnConfirmMalDisconnect')?.addEventListener('click', () => {
        closeModal();
        executeMalToggle();
      });
      return;
    }

    executeMalToggle();
  });
  document.getElementById('btnDangerResetAll')?.addEventListener('click', () => {
    const existingOverlay = document.getElementById('dangerClearDataModalOverlay');
    if (existingOverlay) {
      existingOverlay.remove();
    }
    const overlay = document.createElement('div');
    overlay.id = 'dangerClearDataModalOverlay';
    overlay.style.cssText =
      'position:fixed;inset:0;background:rgba(0,0,0,0.65);z-index:99999;display:flex;align-items:center;justify-content:center;padding:16px;';
    overlay.innerHTML = `
      <div role="dialog" aria-modal="true" style="width:360px;max-width:92vw;background:var(--bg-surface,#18181b);border:none;border-radius:20px;padding:24px 24px 20px;box-shadow:0 24px 48px rgba(0,0,0,0.45);color:var(--ink-primary,#f4f4f5);font-family:inherit;">
        <h3 style="margin:0 0 10px 0;font-size:19px;font-weight:700;color:var(--ink-primary,#f4f4f5);letter-spacing:-0.01em;">
          ${this.l('Reset Aplikasi', 'Reset Application')}
        </h3>
        <p id="dangerClearDataModalMsg" style="margin:0 0 22px 0;font-size:13.5px;line-height:1.5;color:var(--ink-secondary,#a1a1aa);">
          ${this.l(
            'Atur ulang seluruh data dan pengaturan aplikasi ke bawaan pabrik?',
            'Reset all application data and settings to factory defaults?'
          )}
        </p>
        <div id="dangerClearDataModalActions" style="display:flex;justify-content:flex-end;align-items:center;gap:12px;">
          <button id="btnCancelClearAllData" type="button" style="height:38px;padding:0 14px;border-radius:10px;border:none;background:transparent;color:var(--ink-secondary,#a1a1aa);font-size:13.5px;font-weight:600;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;">
            ${this.t('modal.cancel')}
          </button>
          <button id="btnConfirmClearAllData" type="button" style="height:38px;padding:0 20px;border-radius:10px;border:none;background:#f43f5e;color:#ffffff;font-size:13.5px;font-weight:600;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;">
            <span>${this.l('Atur Ulang', 'Reset')}</span>
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
          <span style="display:inline-flex;align-items:center;justify-content:center;width:36px;height:36px;border-radius:10px;background:var(--ocean-tint);color:var(--ink-primary);flex-shrink:0;">
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
          <button id="btnConfirmResetHotkeys" type="button" style="height:36px;padding:0 18px;border-radius:8px;border:none;background:var(--ocean-primary);color:var(--ink-on-ocean);font-size:13px;font-weight:600;cursor:pointer;display:inline-flex;align-items:center;gap:6px;">
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
  document.getElementById('btnToggleReleaseNotes')?.addEventListener('click', () => {
    const btn = document.getElementById('btnToggleReleaseNotes');
    const panel = document.getElementById('aboutReleaseNotesPanel');
    const chevron = document.getElementById('aboutReleaseNotesChevron');
    if (!panel || !btn) return;
    const isExpanded = panel.style.display !== 'none';
    panel.style.display = isExpanded ? 'none' : 'block';
    btn.setAttribute('aria-expanded', isExpanded ? 'false' : 'true');
    if (chevron) {
      chevron.classList.toggle('is-open', !isExpanded);
    }
  });
  document.getElementById('btnAboutCheckUpdate')?.addEventListener('click', () => {
    const btn = document.getElementById('btnAboutCheckUpdate') as HTMLButtonElement | null;
    const titleEl = document.getElementById('aboutCheckUpdateTitle');
    const descEl = document.getElementById('aboutCheckUpdateDesc');
    if (this.bridge.isWebViewHost) {
      if (btn && btn.dataset.updateUrl) {
        const dlUrl = btn.dataset.updateUrl;
        btn.disabled = true;
        if (descEl) descEl.textContent = this.l('Mengunduh dan memasang pembaruan...', 'Downloading and installing update...');
        this.showToast(this.l('Mengunduh dan memasang pembaruan aplikasi Yomic...', 'Downloading and installing Yomic update...'));
        void this.bridge.invoke<{ ok?: boolean }>('app:install-update', { downloadUrl: dlUrl }, 120000).then((res) => {
          if (!res?.ok && btn) {
            btn.disabled = false;
            if (titleEl) titleEl.textContent = this.l('Pasang Pembaruan', 'Install Update');
            if (descEl) descEl.textContent = this.l('Klik untuk mencoba memasang ulang pembaruan', 'Click to retry installing the update');
          }
        });
        return;
      }
      if (btn) {
        btn.disabled = true;
      }
      if (descEl) {
        descEl.textContent = this.l('Memeriksa versi rilis terbaru dari server...', 'Checking latest release version from server...');
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
            this.showToast(this.l(`Pembaruan tersedia: ${info.latestVersion}! Klik baris ini lagi untuk memasang.`, `Update available: ${info.latestVersion}! Click this row again to install.`));
            if (btn) {
              btn.disabled = false;
              btn.dataset.updateUrl = info.downloadUrl || '';
            }
            if (titleEl) {
              titleEl.textContent = this.l(`Perbarui ke ${info.latestVersion}`, `Update to ${info.latestVersion}`);
            }
            if (descEl) {
              descEl.textContent = this.l('Versi baru tersedia! Klik di sini untuk mengunduh & memasang', 'New version available! Click here to download & install');
            }
          } else {
            if (btn) {
              btn.disabled = false;
            }
            if (descEl) {
              descEl.textContent = this.l('Periksa versi rilis terbaru dari server', 'Check latest release version from server');
            }
            this.showToast(this.l(`Anda sudah menggunakan Yomic versi terbaru (v${info?.currentVersion || '2.1.0'}).`, `You are already using the latest version of Yomic (v${info?.currentVersion || '2.1.0'}).`));
          }
        })
        .catch(() => {
          if (btn) {
            btn.disabled = false;
          }
          if (descEl) {
            descEl.textContent = this.l('Periksa versi rilis terbaru dari server', 'Check latest release version from server');
          }
          this.showToast(this.l('Anda sudah menggunakan Yomic versi terbaru (v2.1.0).', 'You are already using the latest version of Yomic (v2.1.0).'));
        });
      return;
    }
    this.showToast(this.l('Anda sudah menggunakan Yomic versi terbaru (v2.1.0).', 'You are already using the latest version of Yomic (v2.1.0).'));
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
