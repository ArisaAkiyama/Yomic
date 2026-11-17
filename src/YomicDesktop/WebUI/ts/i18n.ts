import { AppLanguage } from './types.js';

export type TranslationKey =
  // Sidebar & Navigation
  | 'nav.mainAria'
  | 'nav.toggleSidebarTitle'
  | 'nav.toggleSidebarAria'
  | 'nav.library'
  | 'nav.updates'
  | 'nav.history'
  | 'nav.downloads'
  | 'nav.browse'
  | 'nav.extensions'
  | 'nav.announcements'
  | 'nav.announcementsTitle'
  | 'nav.announcementUnread'
  | 'nav.feedback'
  | 'nav.feedbackTitle'
  | 'nav.tutorial'
  | 'nav.tutorialTitle'
  | 'nav.settings'

  // Reader HUD & Image Processing
  | 'reader.backTitle'
  | 'reader.backAria'
  | 'reader.selectChapterTitle'
  | 'reader.chapterListAria'
  | 'reader.refreshTitle'
  | 'reader.refreshAria'
  | 'reader.fullscreenTitle'
  | 'reader.fullscreenAria'
  | 'reader.modeFlyoutTitle'
  | 'reader.modeFlyoutAria'
  | 'reader.modeWebtoon'
  | 'reader.modeSingle'
  | 'reader.modeDual'
  | 'reader.zoomFlyoutTitle'
  | 'reader.zoomFlyoutAria'
  | 'reader.zoomTitle'
  | 'reader.zoomOutTitle'
  | 'reader.zoomOutAria'
  | 'reader.zoomSliderAria'
  | 'reader.zoomInTitle'
  | 'reader.zoomInAria'
  | 'reader.autoScroll'
  | 'reader.autoScrollTitle'
  | 'reader.autoScrollStop'
  | 'reader.imageFlyoutTitle'
  | 'reader.imageFlyoutAria'
  | 'reader.imageProcessingTitle'
  | 'reader.autoCropLabel'
  | 'reader.autoCropDesc'
  | 'reader.sharpenLabel'
  | 'reader.sharpenDesc'
  | 'reader.optimizeLabel'
  | 'reader.optimizeDesc'
  | 'reader.prevPageTitle'
  | 'reader.prevPageAria'
  | 'reader.nextPageTitle'
  | 'reader.nextPageAria'
  | 'reader.prevChapterTitle'
  | 'reader.prevChapterAria'
  | 'reader.nextChapterTitle'
  | 'reader.nextChapterAria'
  | 'reader.prevBtn'
  | 'reader.nextBtn'
  | 'reader.pageLabel'
  | 'reader.pageScrubberAria'
  | 'reader.pageOf'
  | 'reader.loadingPages'
  | 'reader.noPages'
  | 'reader.loadFailed'
  | 'reader.retryPage'
  | 'reader.endOfChapter'
  | 'reader.firstChapterToast'
  | 'reader.lastChapterToast'

  // Static Modals (Announcements, Feedback, Tutorial)
  | 'modal.close'
  | 'modal.cancel'
  | 'modal.confirm'
  | 'modal.save'
  | 'announcements.title'
  | 'announcements.empty'
  | 'feedback.title'
  | 'feedback.typeTitle'
  | 'feedback.typeBug'
  | 'feedback.typeFeature'
  | 'feedback.typeExtension'
  | 'feedback.typePerformance'
  | 'feedback.typeGeneral'
  | 'feedback.descTitle'
  | 'feedback.guideIntro'
  | 'feedback.guideBullet1'
  | 'feedback.guideBullet2'
  | 'feedback.guideBullet3'
  | 'feedback.placeholder'
  | 'feedback.attachScreenshot'
  | 'feedback.submit'
  | 'feedback.emptyWarning'
  | 'feedback.sentSuccess'
  | 'tutorial.aria'
  | 'tutorial.slide1Title'
  | 'tutorial.slide1Desc'
  | 'tutorial.slide2Title'
  | 'tutorial.slide2Desc'
  | 'tutorial.slide3Title'
  | 'tutorial.slide3Desc'
  | 'tutorial.skip'
  | 'tutorial.stepsAria'
  | 'tutorial.step1'
  | 'tutorial.step2'
  | 'tutorial.step3'
  | 'tutorial.prev'
  | 'tutorial.next'
  | 'tutorial.finish'

  // App & Global Toasts
  | 'app.offlineModeNotice'
  | 'app.fullscreenUnavailable'
  | 'app.sidebarCollapsed'
  | 'app.sidebarExpanded'
  | 'app.searchFocused'

  // Settings View
  | 'settings.title'
  | 'settings.subtitle'
  | 'settings.tab.appearance'
  | 'settings.tab.library'
  | 'settings.tab.tracker'
  | 'settings.tab.storage'
  | 'settings.tab.network'
  | 'settings.tab.hotkeys'
  | 'settings.tab.about'
  | 'settings.appearance.headerTitle'
  | 'settings.appearance.headerDesc'
  | 'settings.appearance.languageTitle'
  | 'settings.appearance.languageDesc'
  | 'settings.appearance.languageId'
  | 'settings.appearance.languageEn'
  | 'settings.appearance.languageChanged'
  | 'settings.appearance.readerModeTitle'
  | 'settings.appearance.readerModeDesc'
  | 'settings.appearance.readerModeWebtoon'
  | 'settings.appearance.readerModeSingle'
  | 'settings.appearance.readerModeDual'
  | 'settings.appearance.directionTitle'
  | 'settings.appearance.directionDesc'
  | 'settings.appearance.directionLtr'
  | 'settings.appearance.directionRtl'
  | 'settings.appearance.fitModeTitle'
  | 'settings.appearance.fitModeDesc'
  | 'settings.appearance.fitWidth'
  | 'settings.appearance.fitHeight'
  | 'settings.appearance.fitOriginal'
  | 'settings.appearance.darkModeTitle'
  | 'settings.appearance.darkModeDesc'
  | 'settings.appearance.preloadTitle'
  | 'settings.appearance.preloadDesc'
  | 'settings.appearance.autoDownloadTitle'
  | 'settings.appearance.autoDownloadDesc'
  | 'settings.appearance.imageHeaderTitle'
  | 'settings.appearance.imageHeaderDesc'
  | 'settings.appearance.autoCropTitle'
  | 'settings.appearance.autoCropDesc'
  | 'settings.appearance.sharpenTitle'
  | 'settings.appearance.sharpenDesc'
  | 'settings.appearance.smartOptTitle'
  | 'settings.appearance.smartOptDesc'
  | 'settings.appearance.maxResTitle'
  | 'settings.appearance.maxResDesc'
  | 'settings.appearance.maxRes1440'
  | 'settings.appearance.maxRes2160'
  | 'settings.appearance.maxRes2880'
  | 'settings.appearance.maxRes0'
  | 'settings.library.headerTitle'
  | 'settings.library.headerDesc'
  | 'settings.library.unreadBadgeTitle'
  | 'settings.library.unreadBadgeDesc'
  | 'settings.library.autoSyncStartupTitle'
  | 'settings.library.autoSyncStartupDesc'
  | 'settings.library.smartUpdateTitle'
  | 'settings.library.smartUpdateDesc'
  | 'settings.library.bgUpdateTitle'
  | 'settings.library.bgUpdateDesc'
  | 'settings.library.bgOff'
  | 'settings.library.bg6h'
  | 'settings.library.bg12h'
  | 'settings.library.bg24h'
  | 'settings.library.skipFilteredTitle'
  | 'settings.library.skipFilteredDesc'
  | 'settings.library.nsfwHeaderTitle'
  | 'settings.library.nsfwHeaderDesc'
  | 'settings.library.showNsfwTitle'
  | 'settings.library.showNsfwDesc'
  | 'settings.library.blurNsfwTitle'
  | 'settings.library.blurNsfwDesc'
  | 'settings.tracker.headerTitle'
  | 'settings.tracker.headerDesc'
  | 'settings.tracker.malConnectedAs'
  | 'settings.tracker.malNotConnected'
  | 'settings.tracker.malDisconnect'
  | 'settings.tracker.malConnect'
  | 'settings.tracker.autoSyncTitle'
  | 'settings.tracker.autoSyncDesc'
  | 'settings.tracker.alSoonTitle'
  | 'settings.tracker.alSoonDesc'
  | 'settings.tracker.comingSoon'
  | 'settings.storage.headerTitle'
  | 'settings.storage.headerDesc'
  | 'settings.storage.folderTitle'
  | 'settings.storage.folderChange'
  | 'settings.storage.maxCacheTitle'
  | 'settings.storage.maxCacheDesc'
  | 'settings.storage.clearCacheTitle'
  | 'settings.storage.clearCacheDesc'
  | 'settings.storage.clearCacheBtn'
  | 'settings.storage.backupHeaderTitle'
  | 'settings.storage.backupHeaderDesc'
  | 'settings.storage.backupStats'
  | 'settings.storage.restoreBtn'
  | 'settings.storage.backupBtn'
  | 'settings.network.headerTitle'
  | 'settings.network.headerDesc'
  | 'settings.network.offlineTitle'
  | 'settings.network.offlineDesc'
  | 'settings.network.dohTitle'
  | 'settings.network.dohDesc'
  | 'settings.network.dohSystem'
  | 'settings.network.sourceStatusTitle'
  | 'settings.network.sourceStatusDesc'
  | 'settings.network.interval15m'
  | 'settings.network.interval30m'
  | 'settings.network.interval1h'
  | 'settings.network.intervalOff'
  | 'settings.hotkeys.headerTitle'
  | 'settings.hotkeys.headerDesc'
  | 'settings.hotkeys.resetAll'
  | 'settings.hotkeys.groupReader'
  | 'settings.hotkeys.groupGlobal'
  | 'settings.hotkeys.pressKey'
  | 'settings.hotkeys.resetTooltip'
  | 'settings.hotkeys.conflictMsg'
  | 'settings.hotkeys.updatedToast'
  | 'settings.hotkeys.resetSingleToast'
  | 'settings.hotkeys.resetAllToast'
  | 'settings.about.desc'
  | 'settings.about.guideTitle'
  | 'settings.about.guideDesc'
  | 'settings.about.openTutorial'
  | 'settings.about.updateTitle'
  | 'settings.about.updateDesc'
  | 'settings.about.checkUpdate'
  | 'settings.about.feedbackTitle'
  | 'settings.about.feedbackDesc'
  | 'settings.about.openFeedback'
  | 'settings.about.resetTitle'
  | 'settings.about.resetDesc'
  | 'settings.about.resetBtn'
  | 'settings.toast.malDisconnected'
  | 'settings.toast.malConnecting'
  | 'settings.toast.choosingFolder'
  | 'settings.toast.cacheCleared'
  | 'settings.toast.creatingBackup'
  | 'settings.toast.restoringBackup'
  | 'settings.toast.checkingUpdate'
  | 'settings.confirm.resetTitle'
  | 'settings.confirm.resetMessage'
  | 'settings.confirm.resetConfirm'
  | 'settings.toast.resetSuccess'

  // Hotkey Definitions
  | 'hotkey.readerNextPage.label'
  | 'hotkey.readerNextPage.desc'
  | 'hotkey.readerPrevPage.label'
  | 'hotkey.readerPrevPage.desc'
  | 'hotkey.readerNextChapter.label'
  | 'hotkey.readerNextChapter.desc'
  | 'hotkey.readerPrevChapter.label'
  | 'hotkey.readerPrevChapter.desc'
  | 'hotkey.readerToggleHud.label'
  | 'hotkey.readerToggleHud.desc'
  | 'hotkey.readerClose.label'
  | 'hotkey.readerClose.desc'
  | 'hotkey.readerModeWebtoon.label'
  | 'hotkey.readerModeWebtoon.desc'
  | 'hotkey.readerModeSingle.label'
  | 'hotkey.readerModeSingle.desc'
  | 'hotkey.readerModeDual.label'
  | 'hotkey.readerModeDual.desc'
  | 'hotkey.readerZoomIn.label'
  | 'hotkey.readerZoomIn.desc'
  | 'hotkey.readerZoomOut.label'
  | 'hotkey.readerZoomOut.desc'
  | 'hotkey.readerResetZoom.label'
  | 'hotkey.readerResetZoom.desc'
  | 'hotkey.readerToggleAutoScroll.label'
  | 'hotkey.readerToggleAutoScroll.desc'
  | 'hotkey.readerToggleFullscreen.label'
  | 'hotkey.readerToggleFullscreen.desc'
  | 'hotkey.globalSearch.label'
  | 'hotkey.globalSearch.desc'
  | 'hotkey.globalToggleSidebar.label'
  | 'hotkey.globalToggleSidebar.desc'
  | 'hotkey.globalToggleFullscreen.label'
  | 'hotkey.globalToggleFullscreen.desc'
  | 'hotkey.navLibrary.label'
  | 'hotkey.navLibrary.desc'
  | 'hotkey.navUpdates.label'
  | 'hotkey.navUpdates.desc'
  | 'hotkey.navHistory.label'
  | 'hotkey.navHistory.desc'
  | 'hotkey.navDownloads.label'
  | 'hotkey.navDownloads.desc'
  | 'hotkey.navBrowse.label'
  | 'hotkey.navBrowse.desc'
  | 'hotkey.navExtensions.label'
  | 'hotkey.navExtensions.desc'
  | 'hotkey.navSettings.label'
  | 'hotkey.navSettings.desc'

  // Common & Views
  | 'common.searchPlaceholder'
  | 'common.all'
  | 'common.unknown'
  | 'common.chaptersCount'
  | 'common.unreadCount'
  | 'common.open'
  | 'common.read'
  | 'common.continueReading'
  | 'common.delete'
  | 'common.add'
  | 'common.refresh'
  | 'library.title'
  | 'library.searchPlaceholder'
  | 'library.syncBtn'
  | 'library.syncingBtn'
  | 'library.manageCategoriesBtn'
  | 'library.filterAll'
  | 'library.filterUnread'
  | 'library.filterDownloaded'
  | 'library.filterCompleted'
  | 'library.sortTitle'
  | 'library.sortRecent'
  | 'library.sortUnread'
  | 'library.sortAdded'
  | 'library.viewGrid'
  | 'library.viewList'
  | 'library.emptyTitle'
  | 'library.emptyDesc'
  | 'library.emptyFilteredTitle'
  | 'library.emptyFilteredDesc'
  | 'library.browseAction'
  | 'library.categoryModalTitle'
  | 'library.categoryInputPlaceholder'
  | 'library.categoryAddBtn'
  | 'library.categoryEmpty'
  | 'library.categoryDeleted'
  | 'library.categoryAdded'
  | 'library.syncStarted'
  | 'library.syncCompleted'
  | 'updates.title'
  | 'updates.subtitle'
  | 'updates.syncNow'
  | 'updates.emptyTitle'
  | 'updates.emptyDesc'
  | 'history.title'
  | 'history.subtitle'
  | 'history.clearBtn'
  | 'history.emptyTitle'
  | 'history.emptyDesc'
  | 'history.clearedToast'
  | 'history.pageProgress'
  | 'downloads.title'
  | 'downloads.subtitle'
  | 'downloads.clearCompleted'
  | 'downloads.emptyTitle'
  | 'downloads.emptyDesc'
  | 'downloads.statusQueued'
  | 'downloads.statusDownloading'
  | 'downloads.statusCompleted'
  | 'downloads.statusFailed'
  | 'downloads.statusPaused'
  | 'browse.title'
  | 'browse.subtitle'
  | 'browse.searchPlaceholder'
  | 'browse.allSources'
  | 'browse.popular'
  | 'browse.latest'
  | 'browse.emptyTitle'
  | 'browse.emptyDesc'
  | 'browse.noExtensionsTitle'
  | 'browse.noExtensionsDesc'
  | 'browse.goToExtensions'
  | 'browse.loading'
  | 'browse.loadMore'
  | 'extensions.title'
  | 'extensions.subtitle'
  | 'extensions.searchPlaceholder'
  | 'extensions.filterAll'
  | 'extensions.filterInstalled'
  | 'extensions.filterAvailable'
  | 'extensions.install'
  | 'extensions.uninstall'
  | 'extensions.installed'
  | 'extensions.update'
  | 'extensions.refreshRepo'
  | 'extensions.emptyTitle'
  | 'extensions.emptyDesc'
  | 'detail.backToLibrary'
  | 'detail.inLibrary'
  | 'detail.addToLibrary'
  | 'detail.removeFromLibrary'
  | 'detail.startReading'
  | 'detail.continueChapter'
  | 'detail.trackMal'
  | 'detail.trackedMal'
  | 'detail.categories'
  | 'detail.chaptersHeader'
  | 'detail.sortAsc'
  | 'detail.sortDesc'
  | 'detail.downloadAll'
  | 'detail.markRead'
  | 'detail.markUnread'
  | 'detail.noChapters'
  | 'detail.malModalTitle'
  | 'detail.malSearchPlaceholder'
  | 'detail.malSearchBtn'
  | 'detail.malSearching'
  | 'detail.malSelectBtn'
  | 'detail.malStatusLabel'
  | 'detail.malChapterLabel'
  | 'detail.malScoreLabel'
  | 'detail.malUnlinkBtn'
  | 'detail.malUpdateBtn';

const ID_DICT: Record<TranslationKey, string> = {
  'nav.mainAria': 'Navigasi Utama',
  'nav.toggleSidebarTitle': 'Buka / Tutup Menu Samping (Ctrl+B)',
  'nav.toggleSidebarAria': 'Buka atau tutup menu samping',
  'nav.library': 'Pustaka',
  'nav.updates': 'Pembaruan',
  'nav.history': 'Riwayat',
  'nav.downloads': 'Unduhan',
  'nav.browse': 'Jelajahi Sumber',
  'nav.extensions': 'Ekstensi',
  'nav.announcements': 'Pengumuman',
  'nav.announcementsTitle': 'Pengumuman & Info Developer',
  'nav.announcementUnread': 'Pengumuman Baru',
  'nav.feedback': 'Kirim Masukan',
  'nav.feedbackTitle': 'Kirim Masukan atau Lapor Bug',
  'nav.tutorial': 'Tutorial',
  'nav.tutorialTitle': 'Panduan Pemula (Tutorial)',
  'nav.settings': 'Pengaturan',

  'reader.backTitle': 'Kembali (Esc)',
  'reader.backAria': 'Kembali',
  'reader.selectChapterTitle': 'Pilih Chapter',
  'reader.chapterListAria': 'Daftar Chapter',
  'reader.refreshTitle': 'Muat Ulang Halaman',
  'reader.refreshAria': 'Muat Ulang Halaman',
  'reader.fullscreenTitle': 'Layar Penuh (F11)',
  'reader.fullscreenAria': 'Layar Penuh',
  'reader.modeFlyoutTitle': 'Mode Baca (Reading Mode)',
  'reader.modeFlyoutAria': 'Mode Baca',
  'reader.modeWebtoon': 'Webtoon',
  'reader.modeSingle': 'Halaman Tunggal',
  'reader.modeDual': 'Dua Halaman',
  'reader.zoomFlyoutTitle': 'Pengaturan Zoom',
  'reader.zoomFlyoutAria': 'Pengaturan Zoom',
  'reader.zoomTitle': 'Perbesaran',
  'reader.zoomOutTitle': 'Perkecil Zoom (−)',
  'reader.zoomOutAria': 'Perkecil Zoom',
  'reader.zoomSliderAria': 'Skala Zoom',
  'reader.zoomInTitle': 'Perbesar Zoom (+)',
  'reader.zoomInAria': 'Perbesar Zoom',
  'reader.autoScroll': 'Gulir Otomatis',
  'reader.autoScrollTitle': 'Mulai / Hentikan Gulir Otomatis',
  'reader.autoScrollStop': 'Hentikan Gulir',
  'reader.imageFlyoutTitle': 'Kualitas & Pemrosesan Gambar (SkiaSharp)',
  'reader.imageFlyoutAria': 'Kualitas Gambar',
  'reader.imageProcessingTitle': 'Pemrosesan Gambar',
  'reader.autoCropLabel': 'Potong Tepi Putih (Auto-Crop)',
  'reader.autoCropDesc': 'Pangkas margin kosong / letterbox',
  'reader.sharpenLabel': 'Penajaman Gambar (Sharpening)',
  'reader.sharpenDesc': 'Tingkatkan kejernihan teks & garis',
  'reader.optimizeLabel': 'Optimasi Gambar Cerdas',
  'reader.optimizeDesc': 'Hemat memori dan beban GPU',
  'reader.prevPageTitle': 'Halaman Sebelumnya (←)',
  'reader.prevPageAria': 'Halaman Sebelumnya',
  'reader.nextPageTitle': 'Halaman Selanjutnya (→)',
  'reader.nextPageAria': 'Halaman Selanjutnya',
  'reader.prevChapterTitle': 'Chapter Sebelumnya (Shift+←)',
  'reader.prevChapterAria': 'Chapter Sebelumnya',
  'reader.nextChapterTitle': 'Chapter Selanjutnya (Shift+→)',
  'reader.nextChapterAria': 'Chapter Selanjutnya',
  'reader.prevBtn': 'Sebelumnya',
  'reader.nextBtn': 'Berikutnya',
  'reader.pageLabel': 'Halaman',
  'reader.pageScrubberAria': 'Navigasi Halaman',
  'reader.pageOf': 'Halaman {current} / {total}',
  'reader.loadingPages': 'Memuat halaman bab...',
  'reader.noPages': 'Tidak ada halaman yang tersedia untuk bab ini.',
  'reader.loadFailed': 'Gagal memuat gambar.',
  'reader.retryPage': 'Coba Lagi',
  'reader.endOfChapter': 'Akhir dari bab ini',
  'reader.firstChapterToast': 'Ini adalah bab pertama.',
  'reader.lastChapterToast': 'Ini adalah bab terbaru.',

  'modal.close': 'Tutup',
  'modal.cancel': 'Batal',
  'modal.confirm': 'Konfirmasi',
  'modal.save': 'Simpan',
  'announcements.title': 'Pengumuman & Info Developer',
  'announcements.empty': 'Belum ada pengumuman terbaru.',
  'feedback.title': 'Kirim Masukan',
  'feedback.typeTitle': 'Jenis Masukan',
  'feedback.typeBug': 'Laporan Bug',
  'feedback.typeFeature': 'Permintaan Fitur',
  'feedback.typeExtension': 'Kendala Ekstensi & Sumber',
  'feedback.typePerformance': 'Performa & Jaringan',
  'feedback.typeGeneral': 'Saran Umum',
  'feedback.descTitle': 'Deskripsi',
  'feedback.guideIntro': 'Jelaskan kendala atau saran Anda secara rinci agar tim pengembang dapat menindaklanjutinya dengan cepat:',
  'feedback.guideBullet1': 'Langkah untuk mereproduksi kendala (jika bug)',
  'feedback.guideBullet2': 'Hasil yang diharapkan vs hasil yang terjadi',
  'feedback.guideBullet3': 'Nama sumber komik atau bab terkait',
  'feedback.placeholder': 'Jelaskan masukan atau kendala yang Anda temui...',
  'feedback.attachScreenshot': 'Lampirkan tangkapan layar (opsional)',
  'feedback.submit': 'Kirim Masukan',
  'feedback.emptyWarning': 'Mohon tuliskan deskripsi masukan terlebih dahulu.',
  'feedback.sentSuccess': 'Terima kasih! Masukan Anda telah dikirim.',
  'tutorial.aria': 'Panduan Penggunaan',
  'tutorial.slide1Title': 'Selamat Datang di Yomic',
  'tutorial.slide1Desc': 'Platform desktop untuk mengelola dan menikmati bacaan komik digital secara efisien. Panduan singkat ini akan membantu Anda mengonfigurasi sumber bacaan dan memulai penggunaan aplikasi.',
  'tutorial.slide2Title': 'Integrasi Ekstensi Sumber',
  'tutorial.slide2Desc': 'Yomic menggunakan arsitektur modular berbasis ekstensi. Buka menu <strong>Ekstensi</strong> pada bilah navigasi untuk memilih repositori sumber komik yang dibutuhkan, kemudian klik <strong>Pasang</strong>.',
  'tutorial.slide3Title': 'Eksplorasi Katalog & Pustaka',
  'tutorial.slide3Desc': 'Akses katalog melalui menu <strong>Jelajahi</strong> untuk menemukan berbagai judul komik. Simpan judul pilihan ke dalam <strong>Pustaka</strong> untuk memantau pembaruan bab secara berkala.',
  'tutorial.skip': 'Lewati',
  'tutorial.stepsAria': 'Indikator langkah',
  'tutorial.step1': 'Langkah 1',
  'tutorial.step2': 'Langkah 2',
  'tutorial.step3': 'Langkah 3',
  'tutorial.prev': 'Kembali',
  'tutorial.next': 'Lanjutkan',
  'tutorial.finish': 'Selesai',

  'app.offlineModeNotice': 'Mode Luring (Offline Mode) aktif. Hanya komik yang telah diunduh yang dapat dibuka.',
  'app.fullscreenUnavailable': 'Mode layar penuh tidak didukung pada jendela ini.',
  'app.sidebarCollapsed': 'Menu samping diciutkan.',
  'app.sidebarExpanded': 'Menu samping dibentangkan.',
  'app.searchFocused': 'Kolom pencarian aktif.',

  'settings.title': 'Pengaturan',
  'settings.subtitle': 'Konfigurasi preferensi aplikasi, pembaca komik, pelacak, dan penyimpanan lokal.',
  'settings.tab.appearance': 'Tampilan & Pembaca',
  'settings.tab.library': 'Pustaka & Keamanan',
  'settings.tab.tracker': 'Pelacak (Tracker)',
  'settings.tab.storage': 'Penyimpanan & Cadangan',
  'settings.tab.network': 'Jaringan & Sumber',
  'settings.tab.hotkeys': 'Tombol Pintas',
  'settings.tab.about': 'Tentang Aplikasi',
  'settings.appearance.headerTitle': 'Preferensi Pembaca Komik',
  'settings.appearance.headerDesc': 'Atur bahasa, tata letak membaca bawaan, tema antarmuka, dan perilaku pramuatan bab.',
  'settings.appearance.languageTitle': 'Bahasa Antarmuka (Language)',
  'settings.appearance.languageDesc': 'Pilih bahasa tampilan aplikasi Yomic Desktop.',
  'settings.appearance.languageId': 'Bahasa Indonesia (ID)',
  'settings.appearance.languageEn': 'English (EN)',
  'settings.appearance.languageChanged': 'Bahasa antarmuka diubah ke {lang}.',
  'settings.appearance.readerModeTitle': 'Mode Baca Bawaan',
  'settings.appearance.readerModeDesc': 'Pilihan tata letak tampilan saat pertama kali membuka bab komik.',
  'settings.appearance.readerModeWebtoon': 'Webtoon (Gulir Vertikal)',
  'settings.appearance.readerModeSingle': 'Halaman Tunggal',
  'settings.appearance.readerModeDual': 'Dua Halaman (Menyanding)',
  'settings.appearance.directionTitle': 'Arah Baca (Mode Halaman)',
  'settings.appearance.directionDesc': 'Tentukan arah perpindahan halaman untuk Manga (Kanan ke Kiri) atau Komik Barat (Kiri ke Kanan).',
  'settings.appearance.directionLtr': 'Kiri ke Kanan (LTR)',
  'settings.appearance.directionRtl': 'Kanan ke Kiri (RTL / Manga)',
  'settings.appearance.fitModeTitle': 'Skala Tampilan Gambar',
  'settings.appearance.fitModeDesc': 'Bagaimana gambar halaman disesuaikan terhadap jendela pembaca.',
  'settings.appearance.fitWidth': 'Sesuaikan Lebar (Fit Width)',
  'settings.appearance.fitHeight': 'Sesuaikan Tinggi (Fit Height)',
  'settings.appearance.fitOriginal': 'Ukuran Asli (Original)',
  'settings.appearance.darkModeTitle': 'Mode Gelap Aplikasi (Dark Theme)',
  'settings.appearance.darkModeDesc': 'Ubah seluruh palet warna antarmuka menjadi gelap untuk kenyamanan mata di malam hari.',
  'settings.appearance.preloadTitle': 'Pramuat Bab Berikutnya (Preload)',
  'settings.appearance.preloadDesc': 'Muat gambar bab selanjutnya di latar belakang saat mendekati akhir bab agar bacaan tanpa jeda.',
  'settings.appearance.autoDownloadTitle': 'Unduh Otomatis Bab Selanjutnya',
  'settings.appearance.autoDownloadDesc': 'Simpan bab berikutnya secara otomatis ke penyimpanan lokal saat mulai membaca.',
  'settings.appearance.imageHeaderTitle': 'Kualitas & Pemrosesan Gambar (SkiaSharp)',
  'settings.appearance.imageHeaderDesc': 'Tingkatkan kualitas visual dan efisiensi memori saat merender halaman komik.',
  'settings.appearance.autoCropTitle': 'Potong Tepi Putih (Auto-Crop Borders)',
  'settings.appearance.autoCropDesc': 'Pangkas otomatis area putih/hitam kosong (letterbox) di pinggir halaman komik.',
  'settings.appearance.sharpenTitle': 'Penajaman Gambar (Sharpening)',
  'settings.appearance.sharpenDesc': 'Terapkan filter penajaman ringan untuk memperjelas teks dialog dan garis ilustrasi.',
  'settings.appearance.smartOptTitle': 'Optimasi Gambar Cerdas',
  'settings.appearance.smartOptDesc': 'Kompres dan skalakan gambar beresolusi ekstra tinggi agar tidak membebani RAM & GPU.',
  'settings.appearance.maxResTitle': 'Resolusi Maksimal Gambar',
  'settings.appearance.maxResDesc': 'Batas dimensi sisi terpanjang gambar saat optimasi cerdas aktif.',
  'settings.appearance.maxRes1440': '1440px (Hemat Memori)',
  'settings.appearance.maxRes2160': '2160px (4K Seimbang)',
  'settings.appearance.maxRes2880': '2880px (Kualitas Tinggi)',
  'settings.appearance.maxRes0': 'Asli (Tanpa Batas)',
  'settings.library.headerTitle': 'Manajemen Pustaka & Pembaruan',
  'settings.library.headerDesc': 'Atur cara Yomic menampilkan indikator bab dan memeriksa pembaruan koleksi.',
  'settings.library.unreadBadgeTitle': 'Tampilkan Lencana Belum Dibaca',
  'settings.library.unreadBadgeDesc': 'Munculkan jumlah bab yang belum dibaca pada pojok kartu komik di Pustaka.',
  'settings.library.autoSyncStartupTitle': 'Sinkronisasi Otomatis Saat Aplikasi Dibuka',
  'settings.library.autoSyncStartupDesc': 'Periksa bab terbaru untuk seluruh koleksi Pustaka secara otomatis saat Yomic dijalankan.',
  'settings.library.smartUpdateTitle': 'Pembaruan Cerdas (Smart Update)',
  'settings.library.smartUpdateDesc': 'Lewati komik yang berstatus Tamat atau memiliki banyak bab belum dibaca untuk menghemat kuota.',
  'settings.library.bgUpdateTitle': 'Interval Pembaruan Latar Belakang',
  'settings.library.bgUpdateDesc': 'Seberapa sering Yomic mengecek pembaruan bab secara otomatis saat aplikasi berjalan.',
  'settings.library.bgOff': 'Nonaktif (Manual)',
  'settings.library.bg6h': 'Setiap 6 Jam',
  'settings.library.bg12h': 'Setiap 12 Jam',
  'settings.library.bg24h': 'Setiap 24 Jam',
  'settings.library.skipFilteredTitle': 'Lewati Bab yang Disaring Saat Membaca',
  'settings.library.skipFilteredDesc': 'Lompati bab duplikat atau bab yang disembunyikan oleh filter bahasa/grup.',
  'settings.library.nsfwHeaderTitle': 'Konten Dewasa & Privasi',
  'settings.library.nsfwHeaderDesc': 'Kontrol tampilan sumber dan sampul komik dengan rating dewasa (18+).',
  'settings.library.showNsfwTitle': 'Tampilkan Sumber & Komik 18+ (NSFW)',
  'settings.library.showNsfwDesc': 'Izinkan ekstensi dan katalog bertanda dewasa tampil di Jelajahi dan Pustaka.',
  'settings.library.blurNsfwTitle': 'Buramkan Sampul Konten Dewasa',
  'settings.library.blurNsfwDesc': 'Terapkan efek blur pada sampul komik dewasa hingga diarahkan oleh kursor.',
  'settings.tracker.headerTitle': 'Integrasi Pelacak (Trackers)',
  'settings.tracker.headerDesc': 'Sinkronkan progres bab yang Anda baca ke layanan katalog komik eksternal.',
  'settings.tracker.malConnectedAs': 'Terhubung sebagai <strong>{user}</strong>',
  'settings.tracker.malNotConnected': 'Belum terhubung ke akun MyAnimeList',
  'settings.tracker.malDisconnect': 'Putuskan',
  'settings.tracker.malConnect': 'Hubungkan Akun',
  'settings.tracker.autoSyncTitle': 'Sinkronisasi Otomatis Progres Baca',
  'settings.tracker.autoSyncDesc': 'Perbarui nomor bab di MyAnimeList secara otomatis setelah Anda selesai membaca bab.',
  'settings.tracker.alSoonTitle': 'AniList & MangaUpdates',
  'settings.tracker.alSoonDesc': 'Dukungan pelacak tambahan sedang dalam tahap pengembangan.',
  'settings.tracker.comingSoon': 'Segera Hadir',
  'settings.storage.headerTitle': 'Direktori & Cache Pembaca',
  'settings.storage.headerDesc': 'Kelola lokasi unduhan offline dan batas penyimpanan sementara halaman komik.',
  'settings.storage.folderTitle': 'Folder Unduhan Offline',
  'settings.storage.folderChange': 'Ubah Folder',
  'settings.storage.maxCacheTitle': 'Batas Maksimal Cache Gambar',
  'settings.storage.maxCacheDesc': 'Ukuran penyimpanan sementara halaman komik agar pemuatan ulang lebih instan.',
  'settings.storage.clearCacheTitle': 'Bersihkan Cache Gambar',
  'settings.storage.clearCacheDesc': 'Hapus file gambar sementara tanpa menghapus komik yang sudah diunduh permanen.',
  'settings.storage.clearCacheBtn': 'Bersihkan Cache',
  'settings.storage.backupHeaderTitle': 'Basis Data & Cadangan Lokal',
  'settings.storage.backupHeaderDesc': 'Ekspor atau pulihkan koleksi Pustaka, kategori, dan riwayat baca dalam file .yomicbackup.',
  'settings.storage.backupStats': '{manga} Komik · {chapters} Bab · {history} Riwayat · {size}',
  'settings.storage.restoreBtn': 'Pulihkan',
  'settings.storage.backupBtn': 'Cadangkan',
  'settings.network.headerTitle': 'Koneksi & DNS over HTTPS (DoH)',
  'settings.network.headerDesc': 'Atasi pemblokiran ISP atau mode luring saat mengakses repositori ekstensi dan sumber komik.',
  'settings.network.offlineTitle': 'Mode Luring (Offline Mode)',
  'settings.network.offlineDesc': 'Nonaktifkan seluruh permintaan jaringan dan hanya tampilkan koleksi komik yang sudah diunduh.',
  'settings.network.dohTitle': 'Penyedia DNS over HTTPS (DoH)',
  'settings.network.dohDesc': 'Enkripsi resolusi DNS aplikasi untuk menembus pembatasan jaringan lokal.',
  'settings.network.dohSystem': 'Bawaan Sistem (Nonaktif)',
  'settings.network.sourceStatusTitle': 'Interval Cek Status Sumber',
  'settings.network.sourceStatusDesc': 'Seberapa sering Yomic memeriksa kesehatan koneksi ke server sumber ekstensi.',
  'settings.network.interval15m': 'Setiap 15 Menit',
  'settings.network.interval30m': 'Setiap 30 Menit',
  'settings.network.interval1h': 'Setiap 1 Jam',
  'settings.network.intervalOff': 'Nonaktif',
  'settings.hotkeys.headerTitle': 'Kustomisasi Tombol Pintas (Hotkeys)',
  'settings.hotkeys.headerDesc': 'Klik tombol pintasan di sebelah kanan untuk merekam kombinasi tombol baru sesuai kenyamanan Anda.',
  'settings.hotkeys.resetAll': 'Reset Semua Default',
  'settings.hotkeys.groupReader': 'Pembaca Komik (Reader)',
  'settings.hotkeys.groupGlobal': 'Navigasi Global',
  'settings.hotkeys.pressKey': 'Tekan tombol...',
  'settings.hotkeys.resetTooltip': 'Kembalikan ke bawaan ({key})',
  'settings.hotkeys.conflictMsg': 'Tombol [{key}] sudah dipakai untuk "{label}". Pilih tombol lain.',
  'settings.hotkeys.updatedToast': 'Pintasan "{label}" diubah ke [{key}].',
  'settings.hotkeys.resetSingleToast': 'Pintasan "{label}" dikembalikan ke [{key}].',
  'settings.hotkeys.resetAllToast': 'Semua tombol pintas dikembalikan ke pengaturan awal.',
  'settings.about.desc': 'Pembaca komik dan manga desktop modern dengan arsitektur WebView2 + .NET 8.',
  'settings.about.guideTitle': 'Panduan Penggunaan (Tutorial)',
  'settings.about.guideDesc': 'Tampilkan kembali tur pengenalan fitur dasar Yomic.',
  'settings.about.openTutorial': 'Buka Panduan',
  'settings.about.updateTitle': 'Pembaruan Aplikasi',
  'settings.about.updateDesc': 'Periksa versi terbaru Yomic Desktop dari repositori resmi.',
  'settings.about.checkUpdate': 'Cek Pembaruan',
  'settings.about.feedbackTitle': 'Masukan & Laporan Bug',
  'settings.about.feedbackDesc': 'Bantu kami menyempurnakan Yomic dengan mengirimkan saran atau laporan kendala.',
  'settings.about.openFeedback': 'Kirim Masukan',
  'settings.about.resetTitle': 'Atur Ulang Semua Pengaturan',
  'settings.about.resetDesc': 'Kembalikan seluruh preferensi aplikasi ke konfigurasi bawaan pabrik.',
  'settings.about.resetBtn': 'Reset Pengaturan',
  'settings.toast.malDisconnected': 'Akun MyAnimeList telah diputuskan.',
  'settings.toast.malConnecting': 'Membuka jendela otentikasi MyAnimeList...',
  'settings.toast.choosingFolder': 'Membuka dialog pemilihan folder...',
  'settings.toast.cacheCleared': 'Cache gambar sementara berhasil dibersihkan.',
  'settings.toast.creatingBackup': 'Membuat file cadangan .yomicbackup...',
  'settings.toast.restoringBackup': 'Memilih file cadangan untuk dipulihkan...',
  'settings.toast.checkingUpdate': 'Memeriksa pembaruan aplikasi...',
  'settings.confirm.resetTitle': 'Reset Semua Pengaturan?',
  'settings.confirm.resetMessage': 'Seluruh preferensi tampilan, pembaca, jaringan, dan pintasan keyboard akan dikembalikan ke bawaan awal. Koleksi Pustaka Anda tetap aman.',
  'settings.confirm.resetConfirm': 'Ya, Reset Pengaturan',
  'settings.toast.resetSuccess': 'Seluruh pengaturan telah dikembalikan ke bawaan.',

  'hotkey.readerNextPage.label': 'Halaman / Bab Berikutnya',
  'hotkey.readerNextPage.desc': 'Pindah ke halaman komik berikutnya atau bab selanjutnya pada mode Webtoon',
  'hotkey.readerPrevPage.label': 'Halaman / Bab Sebelumnya',
  'hotkey.readerPrevPage.desc': 'Pindah ke halaman komik sebelumnya atau bab sebelumnya pada mode Webtoon',
  'hotkey.readerNextChapter.label': 'Bab Berikutnya',
  'hotkey.readerNextChapter.desc': 'Langsung melompat ke bab berikutnya',
  'hotkey.readerPrevChapter.label': 'Bab Sebelumnya',
  'hotkey.readerPrevChapter.desc': 'Langsung melompat ke bab sebelumnya',
  'hotkey.readerToggleHud.label': 'Tampilkan / Sembunyikan Menu HUD',
  'hotkey.readerToggleHud.desc': 'Alihkan visibilitas bilah atas dan bawah saat membaca',
  'hotkey.readerClose.label': 'Tutup Pembaca',
  'hotkey.readerClose.desc': 'Keluar dari mode membaca kembali ke tampilan sebelumnya',
  'hotkey.readerModeWebtoon.label': 'Ubah ke Mode Webtoon',
  'hotkey.readerModeWebtoon.desc': 'Ganti tata letak ke gulir vertikal tak terbatas',
  'hotkey.readerModeSingle.label': 'Ubah ke Mode Halaman Tunggal',
  'hotkey.readerModeSingle.desc': 'Ganti tata letak ke tampilan satu halaman per layar',
  'hotkey.readerModeDual.label': 'Ubah ke Mode Dua Halaman',
  'hotkey.readerModeDual.desc': 'Ganti tata letak ke tampilan dua halaman menyanding',
  'hotkey.readerZoomIn.label': 'Perbesar Tampilan (Zoom In)',
  'hotkey.readerZoomIn.desc': 'Tingkatkan skala halaman komik sebesar 10%',
  'hotkey.readerZoomOut.label': 'Perkecil Tampilan (Zoom Out)',
  'hotkey.readerZoomOut.desc': 'Kurangi skala halaman komik sebesar 10%',
  'hotkey.readerResetZoom.label': 'Atur Ulang Zoom (100%)',
  'hotkey.readerResetZoom.desc': 'Kembalikan ukuran skala tampilan gambar ke 100%',
  'hotkey.readerToggleAutoScroll.label': 'Mulai / Berhenti Gulir Otomatis',
  'hotkey.readerToggleAutoScroll.desc': 'Nyalakan atau matikan gulir halaman otomatis Webtoon',
  'hotkey.readerToggleFullscreen.label': 'Layar Penuh Pembaca',
  'hotkey.readerToggleFullscreen.desc': 'Alihkan mode layar penuh (fullscreen) saat membaca',
  'hotkey.globalSearch.label': 'Fokus Kolom Pencarian',
  'hotkey.globalSearch.desc': 'Buka dan fokuskan kursor ke kolom pencarian aktif',
  'hotkey.globalToggleSidebar.label': 'Buka / Tutup Sidebar',
  'hotkey.globalToggleSidebar.desc': 'Ciutkan atau rentangkan bilah navigasi samping',
  'hotkey.globalToggleFullscreen.label': 'Layar Penuh Aplikasi',
  'hotkey.globalToggleFullscreen.desc': 'Alihkan mode jendela layar penuh untuk seluruh aplikasi',
  'hotkey.navLibrary.label': 'Buka Tab Pustaka',
  'hotkey.navLibrary.desc': 'Pindah ke tampilan koleksi komik di Pustaka',
  'hotkey.navUpdates.label': 'Buka Tab Pembaruan',
  'hotkey.navUpdates.desc': 'Pindah ke tampilan riwayat pembaruan bab terbaru',
  'hotkey.navHistory.label': 'Buka Tab Riwayat',
  'hotkey.navHistory.desc': 'Pindah ke tampilan riwayat komik yang terakhir dibaca',
  'hotkey.navDownloads.label': 'Buka Tab Unduhan',
  'hotkey.navDownloads.desc': 'Pindah ke antrean dan status unduhan offline',
  'hotkey.navBrowse.label': 'Buka Tab Jelajahi Sumber',
  'hotkey.navBrowse.desc': 'Pindah ke katalog sumber ekstensi online',
  'hotkey.navExtensions.label': 'Buka Tab Ekstensi',
  'hotkey.navExtensions.desc': 'Pindah ke manajemen repositori dan ekstensi komik',
  'hotkey.navSettings.label': 'Buka Tab Pengaturan',
  'hotkey.navSettings.desc': 'Buka halaman preferensi dan konfigurasi aplikasi',

  'common.searchPlaceholder': 'Cari...',
  'common.all': 'Semua',
  'common.unknown': 'Tidak diketahui',
  'common.chaptersCount': '{count} Bab',
  'common.unreadCount': '{count} Belum Dibaca',
  'common.open': 'Buka',
  'common.read': 'Baca',
  'common.continueReading': 'Lanjut Baca',
  'common.delete': 'Hapus',
  'common.add': 'Tambah',
  'common.refresh': 'Segarkan',
  'library.title': 'Pustaka',
  'library.searchPlaceholder': 'Cari judul di Pustaka...',
  'library.syncBtn': 'Perbarui',
  'library.syncingBtn': 'Memperbarui...',
  'library.manageCategoriesBtn': 'Kelola Kategori',
  'library.filterAll': 'Semua',
  'library.filterUnread': 'Belum Dibaca',
  'library.filterDownloaded': 'Terunduh',
  'library.filterCompleted': 'Tamat',
  'library.sortTitle': 'Judul (A-Z)',
  'library.sortRecent': 'Pembaruan Terbaru',
  'library.sortUnread': 'Belum Dibaca Terbanyak',
  'library.sortAdded': 'Terakhir Ditambahkan',
  'library.viewGrid': 'Tampilan Grid',
  'library.viewList': 'Tampilan Daftar',
  'library.emptyTitle': 'Pustaka Masih Kosong',
  'library.emptyDesc': 'Jelajahi sumber ekstensi untuk menambahkan komik favorit ke koleksi Anda.',
  'library.emptyFilteredTitle': 'Tidak Ada Komik yang Cocok',
  'library.emptyFilteredDesc': 'Coba ubah kata kunci pencarian atau filter kategori yang aktif.',
  'library.browseAction': 'Jelajahi Sumber',
  'library.categoryModalTitle': 'Kelola Kategori Pustaka',
  'library.categoryInputPlaceholder': 'Nama kategori baru...',
  'library.categoryAddBtn': 'Tambah',
  'library.categoryEmpty': 'Belum ada kategori kustom.',
  'library.categoryDeleted': 'Kategori "{name}" dihapus.',
  'library.categoryAdded': 'Kategori "{name}" ditambahkan.',
  'library.syncStarted': 'Memeriksa pembaruan koleksi Pustaka...',
  'library.syncCompleted': 'Pembaruan Pustaka selesai.',
  'updates.title': 'Pembaruan',
  'updates.subtitle': 'Bab terbaru yang dirilis dari komik di Pustaka Anda.',
  'updates.syncNow': 'Periksa Sekarang',
  'updates.emptyTitle': 'Belum Ada Pembaruan Bab',
  'updates.emptyDesc': 'Perbarui Pustaka untuk melihat rilis bab terbaru dari sumber Anda.',
  'history.title': 'Riwayat Baca',
  'history.subtitle': 'Daftar komik dan bab yang terakhir Anda buka.',
  'history.clearBtn': 'Bersihkan Riwayat',
  'history.emptyTitle': 'Riwayat Baca Kosong',
  'history.emptyDesc': 'Mulai baca komik dari Pustaka atau Jelajahi untuk mencatat riwayat.',
  'history.clearedToast': 'Riwayat baca telah dibersihkan.',
  'history.pageProgress': 'Halaman {page}',
  'downloads.title': 'Unduhan',
  'downloads.subtitle': 'Antrean bab yang sedang dan telah diunduh untuk dibaca luring.',
  'downloads.clearCompleted': 'Bersihkan Selesai',
  'downloads.emptyTitle': 'Antrean Unduhan Kosong',
  'downloads.emptyDesc': 'Unduh bab dari halaman detail komik untuk membacanya tanpa koneksi internet.',
  'downloads.statusQueued': 'Menunggu',
  'downloads.statusDownloading': 'Mengunduh',
  'downloads.statusCompleted': 'Selesai',
  'downloads.statusFailed': 'Gagal',
  'downloads.statusPaused': 'Dijeda',
  'browse.title': 'Jelajahi Sumber',
  'browse.subtitle': 'Temukan komik dari ekstensi sumber yang terpasang.',
  'browse.searchPlaceholder': 'Cari judul komik di sumber...',
  'browse.allSources': 'Semua Sumber',
  'browse.popular': 'Populer',
  'browse.latest': 'Terbaru',
  'browse.emptyTitle': 'Tidak Ada Hasil',
  'browse.emptyDesc': 'Coba kata kunci lain atau pilih sumber yang berbeda.',
  'browse.noExtensionsTitle': 'Belum Ada Ekstensi Terpasang',
  'browse.noExtensionsDesc': 'Pasang minimal satu ekstensi sumber terlebih dahulu untuk menjelajahi katalog komik.',
  'browse.goToExtensions': 'Buka Menu Ekstensi',
  'browse.loading': 'Memuat katalog dari sumber...',
  'browse.loadMore': 'Muat Lebih Banyak',
  'extensions.title': 'Ekstensi Sumber',
  'extensions.subtitle': 'Pasang atau kelola sumber katalog komik untuk Yomic.',
  'extensions.searchPlaceholder': 'Cari nama ekstensi atau bahasa...',
  'extensions.filterAll': 'Semua',
  'extensions.filterInstalled': 'Terpasang',
  'extensions.filterAvailable': 'Tersedia',
  'extensions.install': 'Pasang',
  'extensions.uninstall': 'Copot',
  'extensions.installed': 'Terpasang',
  'extensions.update': 'Perbarui',
  'extensions.refreshRepo': 'Segarkan Repositori',
  'extensions.emptyTitle': 'Ekstensi Tidak Ditemukan',
  'extensions.emptyDesc': 'Tidak ada ekstensi yang sesuai dengan kata kunci pencarian Anda.',
  'detail.backToLibrary': 'Kembali',
  'detail.inLibrary': 'Di Pustaka',
  'detail.addToLibrary': 'Tambah ke Pustaka',
  'detail.removeFromLibrary': 'Hapus dari Pustaka',
  'detail.startReading': 'Mulai Baca',
  'detail.continueChapter': 'Lanjut Bab {num}',
  'detail.trackMal': 'Lacak di MAL',
  'detail.trackedMal': 'MAL: {title}',
  'detail.categories': 'Kategori',
  'detail.chaptersHeader': 'Daftar Bab ({count})',
  'detail.sortAsc': 'Terlama',
  'detail.sortDesc': 'Terbaru',
  'detail.downloadAll': 'Unduh Semua',
  'detail.markRead': 'Tandai Sudah Dibaca',
  'detail.markUnread': 'Tandai Belum Dibaca',
  'detail.noChapters': 'Belum ada bab yang tersedia.',
  'detail.malModalTitle': 'Hubungkan Pelacak MyAnimeList',
  'detail.malSearchPlaceholder': 'Cari judul manga di MyAnimeList...',
  'detail.malSearchBtn': 'Cari',
  'detail.malSearching': 'Mencari di MyAnimeList...',
  'detail.malSelectBtn': 'Pilih',
  'detail.malStatusLabel': 'Status Baca',
  'detail.malChapterLabel': 'Bab Terakhir Dibaca',
  'detail.malScoreLabel': 'Skor (0-10)',
  'detail.malUnlinkBtn': 'Putuskan Tautan',
  'detail.malUpdateBtn': 'Perbarui Pelacak',
};

const EN_DICT: Record<TranslationKey, string> = {
  'nav.mainAria': 'Main Navigation',
  'nav.toggleSidebarTitle': 'Toggle Sidebar (Ctrl+B)',
  'nav.toggleSidebarAria': 'Toggle sidebar',
  'nav.library': 'Library',
  'nav.updates': 'Updates',
  'nav.history': 'History',
  'nav.downloads': 'Downloads',
  'nav.browse': 'Browse Sources',
  'nav.extensions': 'Extensions',
  'nav.announcements': 'Announcements',
  'nav.announcementsTitle': 'Announcements & Developer Info',
  'nav.announcementUnread': 'New Announcement',
  'nav.feedback': 'Send Feedback',
  'nav.feedbackTitle': 'Send Feedback or Report Bug',
  'nav.tutorial': 'Tutorial',
  'nav.tutorialTitle': 'Beginner Guide (Tutorial)',
  'nav.settings': 'Settings',

  'reader.backTitle': 'Back (Esc)',
  'reader.backAria': 'Back',
  'reader.selectChapterTitle': 'Select Chapter',
  'reader.chapterListAria': 'Chapter List',
  'reader.refreshTitle': 'Reload Pages',
  'reader.refreshAria': 'Reload Pages',
  'reader.fullscreenTitle': 'Fullscreen (F11)',
  'reader.fullscreenAria': 'Fullscreen',
  'reader.modeFlyoutTitle': 'Reading Mode',
  'reader.modeFlyoutAria': 'Reading Mode',
  'reader.modeWebtoon': 'Webtoon',
  'reader.modeSingle': 'Single Page',
  'reader.modeDual': 'Dual Page',
  'reader.zoomFlyoutTitle': 'Zoom Settings',
  'reader.zoomFlyoutAria': 'Zoom Settings',
  'reader.zoomTitle': 'Zoom',
  'reader.zoomOutTitle': 'Zoom Out (−)',
  'reader.zoomOutAria': 'Zoom Out',
  'reader.zoomSliderAria': 'Zoom Scale',
  'reader.zoomInTitle': 'Zoom In (+)',
  'reader.zoomInAria': 'Zoom In',
  'reader.autoScroll': 'Auto-Scroll',
  'reader.autoScrollTitle': 'Start / Stop Auto-Scroll',
  'reader.autoScrollStop': 'Stop Scroll',
  'reader.imageFlyoutTitle': 'Image Quality & Processing (SkiaSharp)',
  'reader.imageFlyoutAria': 'Image Quality',
  'reader.imageProcessingTitle': 'Image Processing',
  'reader.autoCropLabel': 'Auto-Crop White Borders',
  'reader.autoCropDesc': 'Trim empty margins / letterbox',
  'reader.sharpenLabel': 'Image Sharpening',
  'reader.sharpenDesc': 'Enhance text & line clarity',
  'reader.optimizeLabel': 'Smart Image Optimization',
  'reader.optimizeDesc': 'Save memory and GPU load',
  'reader.prevPageTitle': 'Previous Page (←)',
  'reader.prevPageAria': 'Previous Page',
  'reader.nextPageTitle': 'Next Page (→)',
  'reader.nextPageAria': 'Next Page',
  'reader.prevChapterTitle': 'Previous Chapter (Shift+←)',
  'reader.prevChapterAria': 'Previous Chapter',
  'reader.nextChapterTitle': 'Next Chapter (Shift+→)',
  'reader.nextChapterAria': 'Next Chapter',
  'reader.prevBtn': 'Prev',
  'reader.nextBtn': 'Next',
  'reader.pageLabel': 'Page',
  'reader.pageScrubberAria': 'Page Navigation',
  'reader.pageOf': 'Page {current} / {total}',
  'reader.loadingPages': 'Loading chapter pages...',
  'reader.noPages': 'No pages available for this chapter.',
  'reader.loadFailed': 'Failed to load image.',
  'reader.retryPage': 'Retry',
  'reader.endOfChapter': 'End of this chapter',
  'reader.firstChapterToast': 'This is the first chapter.',
  'reader.lastChapterToast': 'This is the latest chapter.',

  'modal.close': 'Close',
  'modal.cancel': 'Cancel',
  'modal.confirm': 'Confirm',
  'modal.save': 'Save',
  'announcements.title': 'Announcements & Developer Info',
  'announcements.empty': 'No announcements available yet.',
  'feedback.title': 'Send Feedback',
  'feedback.typeTitle': 'Feedback Type',
  'feedback.typeBug': 'Bug Report',
  'feedback.typeFeature': 'Feature Request',
  'feedback.typeExtension': 'Extension & Source Issue',
  'feedback.typePerformance': 'Performance & Network',
  'feedback.typeGeneral': 'General Suggestion',
  'feedback.descTitle': 'Description',
  'feedback.guideIntro': 'Please describe your issue or suggestion in detail so our team can follow up quickly:',
  'feedback.guideBullet1': 'Steps to reproduce the issue (if bug)',
  'feedback.guideBullet2': 'Expected result vs actual result',
  'feedback.guideBullet3': 'Related comic source name or chapter',
  'feedback.placeholder': 'Describe the feedback or issue you encountered...',
  'feedback.attachScreenshot': 'Attach a screenshot (optional)',
  'feedback.submit': 'Send Feedback',
  'feedback.emptyWarning': 'Please enter a feedback description first.',
  'feedback.sentSuccess': 'Thank you! Your feedback has been sent.',
  'tutorial.aria': 'User Guide',
  'tutorial.slide1Title': 'Welcome to Yomic',
  'tutorial.slide1Desc': 'A modern desktop platform to organize and enjoy digital comics efficiently. This quick guide will help you configure reading sources and get started.',
  'tutorial.slide2Title': 'Source Extension Integration',
  'tutorial.slide2Desc': 'Yomic uses a modular extension-based architecture. Open the <strong>Extensions</strong> menu on the navigation rail to choose comic source repositories, then click <strong>Install</strong>.',
  'tutorial.slide3Title': 'Catalog & Library Exploration',
  'tutorial.slide3Desc': 'Explore the catalog via <strong>Browse Sources</strong> to discover new titles. Save your favorites to the <strong>Library</strong> to track new chapter updates automatically.',
  'tutorial.skip': 'Skip',
  'tutorial.stepsAria': 'Step indicator',
  'tutorial.step1': 'Step 1',
  'tutorial.step2': 'Step 2',
  'tutorial.step3': 'Step 3',
  'tutorial.prev': 'Back',
  'tutorial.next': 'Continue',
  'tutorial.finish': 'Finish',

  'app.offlineModeNotice': 'Offline Mode is active. Only downloaded comics can be opened.',
  'app.fullscreenUnavailable': 'Fullscreen mode is not supported in this window.',
  'app.sidebarCollapsed': 'Sidebar collapsed.',
  'app.sidebarExpanded': 'Sidebar expanded.',
  'app.searchFocused': 'Search input focused.',

  'settings.title': 'Settings',
  'settings.subtitle': 'Configure application preferences, comic reader, trackers, and local storage.',
  'settings.tab.appearance': 'Appearance & Reader',
  'settings.tab.library': 'Library & Safety',
  'settings.tab.tracker': 'Trackers',
  'settings.tab.storage': 'Storage & Backup',
  'settings.tab.network': 'Network & Sources',
  'settings.tab.hotkeys': 'Hotkeys',
  'settings.tab.about': 'About',
  'settings.appearance.headerTitle': 'Reader Preferences',
  'settings.appearance.headerDesc': 'Configure interface language, default reader layout, theme, and chapter preloading.',
  'settings.appearance.languageTitle': 'Interface Language',
  'settings.appearance.languageDesc': 'Choose the display language for Yomic Desktop.',
  'settings.appearance.languageId': 'Bahasa Indonesia (ID)',
  'settings.appearance.languageEn': 'English (EN)',
  'settings.appearance.languageChanged': 'Interface language switched to {lang}.',
  'settings.appearance.readerModeTitle': 'Default Reading Mode',
  'settings.appearance.readerModeDesc': 'Default layout view when opening a comic chapter for the first time.',
  'settings.appearance.readerModeWebtoon': 'Webtoon (Vertical Scroll)',
  'settings.appearance.readerModeSingle': 'Single Page',
  'settings.appearance.readerModeDual': 'Dual Page (Side-by-Side)',
  'settings.appearance.directionTitle': 'Reading Direction (Page Mode)',
  'settings.appearance.directionDesc': 'Set page turn direction for Manga (Right-to-Left) or Western Comics (Left-to-Right).',
  'settings.appearance.directionLtr': 'Left to Right (LTR)',
  'settings.appearance.directionRtl': 'Right to Left (RTL / Manga)',
  'settings.appearance.fitModeTitle': 'Image Display Scale',
  'settings.appearance.fitModeDesc': 'How comic pages are fitted inside the reader viewport.',
  'settings.appearance.fitWidth': 'Fit Width',
  'settings.appearance.fitHeight': 'Fit Height',
  'settings.appearance.fitOriginal': 'Original Size',
  'settings.appearance.darkModeTitle': 'Application Dark Mode',
  'settings.appearance.darkModeDesc': 'Switch the entire interface color palette to dark for comfortable night reading.',
  'settings.appearance.preloadTitle': 'Preload Next Chapter',
  'settings.appearance.preloadDesc': 'Load next chapter images in the background when nearing the end for seamless reading.',
  'settings.appearance.autoDownloadTitle': 'Auto-Download Next Chapter',
  'settings.appearance.autoDownloadDesc': 'Automatically save the next chapter to local storage when you start reading.',
  'settings.appearance.imageHeaderTitle': 'Image Quality & Processing (SkiaSharp)',
  'settings.appearance.imageHeaderDesc': 'Enhance visual clarity and memory efficiency when rendering comic pages.',
  'settings.appearance.autoCropTitle': 'Auto-Crop White Borders',
  'settings.appearance.autoCropDesc': 'Automatically trim empty white/black margins (letterbox) around comic pages.',
  'settings.appearance.sharpenTitle': 'Image Sharpening',
  'settings.appearance.sharpenDesc': 'Apply a subtle sharpening filter to make dialogue text and artwork lines crisper.',
  'settings.appearance.smartOptTitle': 'Smart Image Optimization',
  'settings.appearance.smartOptDesc': 'Downscale ultra-high-resolution images to reduce RAM & GPU usage.',
  'settings.appearance.maxResTitle': 'Maximum Image Resolution',
  'settings.appearance.maxResDesc': 'Maximum longest-side dimension when smart optimization is enabled.',
  'settings.appearance.maxRes1440': '1440px (Memory Saver)',
  'settings.appearance.maxRes2160': '2160px (4K Balanced)',
  'settings.appearance.maxRes2880': '2880px (High Quality)',
  'settings.appearance.maxRes0': 'Original (Unlimited)',
  'settings.library.headerTitle': 'Library & Update Management',
  'settings.library.headerDesc': 'Control how Yomic displays unread indicators and checks for collection updates.',
  'settings.library.unreadBadgeTitle': 'Show Unread Badges',
  'settings.library.unreadBadgeDesc': 'Display the number of unread chapters on the corner of Library comic cards.',
  'settings.library.autoSyncStartupTitle': 'Auto-Sync on Startup',
  'settings.library.autoSyncStartupDesc': 'Automatically check for new chapters across your Library when Yomic starts.',
  'settings.library.smartUpdateTitle': 'Smart Update',
  'settings.library.smartUpdateDesc': 'Skip completed comics or titles with many unread chapters to save bandwidth.',
  'settings.library.bgUpdateTitle': 'Background Update Interval',
  'settings.library.bgUpdateDesc': 'How often Yomic checks for chapter updates automatically while running.',
  'settings.library.bgOff': 'Disabled (Manual)',
  'settings.library.bg6h': 'Every 6 Hours',
  'settings.library.bg12h': 'Every 12 Hours',
  'settings.library.bg24h': 'Every 24 Hours',
  'settings.library.skipFilteredTitle': 'Skip Filtered Chapters While Reading',
  'settings.library.skipFilteredDesc': 'Skip duplicate chapters or chapters hidden by language/scanlator filters.',
  'settings.library.nsfwHeaderTitle': 'Adult Content & Privacy',
  'settings.library.nsfwHeaderDesc': 'Control visibility of sources and comic covers rated for mature audiences (18+).',
  'settings.library.showNsfwTitle': 'Show 18+ (NSFW) Sources & Comics',
  'settings.library.showNsfwDesc': 'Allow adult-tagged extensions and catalog entries to appear in Browse and Library.',
  'settings.library.blurNsfwTitle': 'Blur Adult Content Covers',
  'settings.library.blurNsfwDesc': 'Apply a blur filter on mature comic covers until hovered with the cursor.',
  'settings.tracker.headerTitle': 'Tracker Integrations',
  'settings.tracker.headerDesc': 'Sync your reading progress to external comic catalog services.',
  'settings.tracker.malConnectedAs': 'Connected as <strong>{user}</strong>',
  'settings.tracker.malNotConnected': 'Not connected to a MyAnimeList account',
  'settings.tracker.malDisconnect': 'Disconnect',
  'settings.tracker.malConnect': 'Connect Account',
  'settings.tracker.autoSyncTitle': 'Auto-Sync Reading Progress',
  'settings.tracker.autoSyncDesc': 'Automatically update chapter count on MyAnimeList after finishing a chapter.',
  'settings.tracker.alSoonTitle': 'AniList & MangaUpdates',
  'settings.tracker.alSoonDesc': 'Support for additional trackers is currently in development.',
  'settings.tracker.comingSoon': 'Coming Soon',
  'settings.storage.headerTitle': 'Directory & Reader Cache',
  'settings.storage.headerDesc': 'Manage offline download location and temporary comic page cache limits.',
  'settings.storage.folderTitle': 'Offline Downloads Folder',
  'settings.storage.folderChange': 'Change Folder',
  'settings.storage.maxCacheTitle': 'Maximum Image Cache Size',
  'settings.storage.maxCacheDesc': 'Temporary storage limit for comic pages to make reloading instant.',
  'settings.storage.clearCacheTitle': 'Clear Image Cache',
  'settings.storage.clearCacheDesc': 'Remove temporary cached images without deleting permanently downloaded comics.',
  'settings.storage.clearCacheBtn': 'Clear Cache',
  'settings.storage.backupHeaderTitle': 'Database & Local Backup',
  'settings.storage.backupHeaderDesc': 'Export or restore your Library collection, categories, and reading history in a .yomicbackup file.',
  'settings.storage.backupStats': '{manga} Comics · {chapters} Chapters · {history} History · {size}',
  'settings.storage.restoreBtn': 'Restore',
  'settings.storage.backupBtn': 'Backup',
  'settings.network.headerTitle': 'Connection & DNS over HTTPS (DoH)',
  'settings.network.headerDesc': 'Bypass ISP blocks or enable offline mode when accessing extension repositories and comic sources.',
  'settings.network.offlineTitle': 'Offline Mode',
  'settings.network.offlineDesc': 'Disable all network requests and show only downloaded comic collections.',
  'settings.network.dohTitle': 'DNS over HTTPS (DoH) Provider',
  'settings.network.dohDesc': 'Encrypt application DNS resolution to bypass local network restrictions.',
  'settings.network.dohSystem': 'System Default (Disabled)',
  'settings.network.sourceStatusTitle': 'Source Health Check Interval',
  'settings.network.sourceStatusDesc': 'How often Yomic checks connection health to extension source servers.',
  'settings.network.interval15m': 'Every 15 Minutes',
  'settings.network.interval30m': 'Every 30 Minutes',
  'settings.network.interval1h': 'Every 1 Hour',
  'settings.network.intervalOff': 'Disabled',
  'settings.hotkeys.headerTitle': 'Customize Hotkeys',
  'settings.hotkeys.headerDesc': 'Click any shortcut button on the right to record a new key combination.',
  'settings.hotkeys.resetAll': 'Reset All Defaults',
  'settings.hotkeys.groupReader': 'Comic Reader',
  'settings.hotkeys.groupGlobal': 'Global Navigation',
  'settings.hotkeys.pressKey': 'Press a key...',
  'settings.hotkeys.resetTooltip': 'Reset to default ({key})',
  'settings.hotkeys.conflictMsg': 'Key [{key}] is already assigned to "{label}". Choose another key.',
  'settings.hotkeys.updatedToast': 'Shortcut "{label}" changed to [{key}].',
  'settings.hotkeys.resetSingleToast': 'Shortcut "{label}" reset to [{key}].',
  'settings.hotkeys.resetAllToast': 'All hotkeys have been reset to defaults.',
  'settings.about.desc': 'Modern desktop comic and manga reader built with WebView2 + .NET 8 architecture.',
  'settings.about.guideTitle': 'User Guide (Tutorial)',
  'settings.about.guideDesc': 'Replay the introductory tour of Yomic core features.',
  'settings.about.openTutorial': 'Open Guide',
  'settings.about.updateTitle': 'Application Updates',
  'settings.about.updateDesc': 'Check for the latest version of Yomic Desktop from the official repository.',
  'settings.about.checkUpdate': 'Check Updates',
  'settings.about.feedbackTitle': 'Feedback & Bug Reports',
  'settings.about.feedbackDesc': 'Help us improve Yomic by sending suggestions or reporting issues.',
  'settings.about.openFeedback': 'Send Feedback',
  'settings.about.resetTitle': 'Reset All Settings',
  'settings.about.resetDesc': 'Restore all application preferences to factory defaults.',
  'settings.about.resetBtn': 'Reset Settings',
  'settings.toast.malDisconnected': 'MyAnimeList account disconnected.',
  'settings.toast.malConnecting': 'Opening MyAnimeList authentication window...',
  'settings.toast.choosingFolder': 'Opening folder selection dialog...',
  'settings.toast.cacheCleared': 'Temporary image cache cleared successfully.',
  'settings.toast.creatingBackup': 'Creating .yomicbackup file...',
  'settings.toast.restoringBackup': 'Selecting backup file to restore...',
  'settings.toast.checkingUpdate': 'Checking for application updates...',
  'settings.confirm.resetTitle': 'Reset All Settings?',
  'settings.confirm.resetMessage': 'All appearance, reader, network, and keyboard shortcut preferences will be restored to defaults. Your Library collection remains safe.',
  'settings.confirm.resetConfirm': 'Yes, Reset Settings',
  'settings.toast.resetSuccess': 'All settings have been reset to defaults.',

  'hotkey.readerNextPage.label': 'Next Page / Chapter',
  'hotkey.readerNextPage.desc': 'Move to the next comic page or next chapter in Webtoon mode',
  'hotkey.readerPrevPage.label': 'Previous Page / Chapter',
  'hotkey.readerPrevPage.desc': 'Move to the previous comic page or previous chapter in Webtoon mode',
  'hotkey.readerNextChapter.label': 'Next Chapter',
  'hotkey.readerNextChapter.desc': 'Jump directly to the next chapter',
  'hotkey.readerPrevChapter.label': 'Previous Chapter',
  'hotkey.readerPrevChapter.desc': 'Jump directly to the previous chapter',
  'hotkey.readerToggleHud.label': 'Show / Hide HUD Menu',
  'hotkey.readerToggleHud.desc': 'Toggle visibility of top and bottom bars while reading',
  'hotkey.readerClose.label': 'Close Reader',
  'hotkey.readerClose.desc': 'Exit reading mode and return to the previous view',
  'hotkey.readerModeWebtoon.label': 'Switch to Webtoon Mode',
  'hotkey.readerModeWebtoon.desc': 'Change layout to infinite vertical scroll',
  'hotkey.readerModeSingle.label': 'Switch to Single Page Mode',
  'hotkey.readerModeSingle.desc': 'Change layout to one page per screen',
  'hotkey.readerModeDual.label': 'Switch to Dual Page Mode',
  'hotkey.readerModeDual.desc': 'Change layout to two pages side-by-side',
  'hotkey.readerZoomIn.label': 'Zoom In',
  'hotkey.readerZoomIn.desc': 'Increase comic page scale by 10%',
  'hotkey.readerZoomOut.label': 'Zoom Out',
  'hotkey.readerZoomOut.desc': 'Decrease comic page scale by 10%',
  'hotkey.readerResetZoom.label': 'Reset Zoom (100%)',
  'hotkey.readerResetZoom.desc': 'Restore image display scale to 100%',
  'hotkey.readerToggleAutoScroll.label': 'Start / Stop Auto-Scroll',
  'hotkey.readerToggleAutoScroll.desc': 'Toggle automatic page scrolling in Webtoon mode',
  'hotkey.readerToggleFullscreen.label': 'Reader Fullscreen',
  'hotkey.readerToggleFullscreen.desc': 'Toggle fullscreen mode while reading',
  'hotkey.globalSearch.label': 'Focus Search Bar',
  'hotkey.globalSearch.desc': 'Open and focus cursor on the active search bar',
  'hotkey.globalToggleSidebar.label': 'Toggle Sidebar',
  'hotkey.globalToggleSidebar.desc': 'Collapse or expand the left navigation sidebar',
  'hotkey.globalToggleFullscreen.label': 'App Fullscreen',
  'hotkey.globalToggleFullscreen.desc': 'Toggle fullscreen window mode for the entire app',
  'hotkey.navLibrary.label': 'Open Library Tab',
  'hotkey.navLibrary.desc': 'Switch to comic collection in Library',
  'hotkey.navUpdates.label': 'Open Updates Tab',
  'hotkey.navUpdates.desc': 'Switch to latest chapter updates feed',
  'hotkey.navHistory.label': 'Open History Tab',
  'hotkey.navHistory.desc': 'Switch to recently read comics history',
  'hotkey.navDownloads.label': 'Open Downloads Tab',
  'hotkey.navDownloads.desc': 'Switch to offline download queue and status',
  'hotkey.navBrowse.label': 'Open Browse Sources Tab',
  'hotkey.navBrowse.desc': 'Switch to online extension catalog',
  'hotkey.navExtensions.label': 'Open Extensions Tab',
  'hotkey.navExtensions.desc': 'Switch to source repository and extension manager',
  'hotkey.navSettings.label': 'Open Settings Tab',
  'hotkey.navSettings.desc': 'Open application preferences and configuration',

  'common.searchPlaceholder': 'Search...',
  'common.all': 'All',
  'common.unknown': 'Unknown',
  'common.chaptersCount': '{count} Chapters',
  'common.unreadCount': '{count} Unread',
  'common.open': 'Open',
  'common.read': 'Read',
  'common.continueReading': 'Continue',
  'common.delete': 'Delete',
  'common.add': 'Add',
  'common.refresh': 'Refresh',
  'library.title': 'Library',
  'library.searchPlaceholder': 'Search titles in Library...',
  'library.syncBtn': 'Update',
  'library.syncingBtn': 'Updating...',
  'library.manageCategoriesBtn': 'Manage Categories',
  'library.filterAll': 'All',
  'library.filterUnread': 'Unread',
  'library.filterDownloaded': 'Downloaded',
  'library.filterCompleted': 'Completed',
  'library.sortTitle': 'Title (A-Z)',
  'library.sortRecent': 'Latest Update',
  'library.sortUnread': 'Most Unread',
  'library.sortAdded': 'Recently Added',
  'library.viewGrid': 'Grid View',
  'library.viewList': 'List View',
  'library.emptyTitle': 'Library is Empty',
  'library.emptyDesc': 'Browse source extensions to add your favorite comics to your collection.',
  'library.emptyFilteredTitle': 'No Matching Comics',
  'library.emptyFilteredDesc': 'Try changing your search keyword or active category filter.',
  'library.browseAction': 'Browse Sources',
  'library.categoryModalTitle': 'Manage Library Categories',
  'library.categoryInputPlaceholder': 'New category name...',
  'library.categoryAddBtn': 'Add',
  'library.categoryEmpty': 'No custom categories yet.',
  'library.categoryDeleted': 'Category "{name}" deleted.',
  'library.categoryAdded': 'Category "{name}" added.',
  'library.syncStarted': 'Checking Library collection for updates...',
  'library.syncCompleted': 'Library update completed.',
  'updates.title': 'Updates',
  'updates.subtitle': 'Latest chapters released from comics in your Library.',
  'updates.syncNow': 'Check Now',
  'updates.emptyTitle': 'No Chapter Updates Yet',
  'updates.emptyDesc': 'Update your Library to see the latest chapter releases from your sources.',
  'history.title': 'Reading History',
  'history.subtitle': 'Comics and chapters you have opened recently.',
  'history.clearBtn': 'Clear History',
  'history.emptyTitle': 'Reading History is Empty',
  'history.emptyDesc': 'Start reading a comic from Library or Browse to record history.',
  'history.clearedToast': 'Reading history cleared.',
  'history.pageProgress': 'Page {page}',
  'downloads.title': 'Downloads',
  'downloads.subtitle': 'Queue of chapters currently downloading or saved for offline reading.',
  'downloads.clearCompleted': 'Clear Completed',
  'downloads.emptyTitle': 'Download Queue is Empty',
  'downloads.emptyDesc': 'Download chapters from a comic detail page to read them offline.',
  'downloads.statusQueued': 'Queued',
  'downloads.statusDownloading': 'Downloading',
  'downloads.statusCompleted': 'Completed',
  'downloads.statusFailed': 'Failed',
  'downloads.statusPaused': 'Paused',
  'browse.title': 'Browse Sources',
  'browse.subtitle': 'Discover comics from your installed source extensions.',
  'browse.searchPlaceholder': 'Search comic titles in source...',
  'browse.allSources': 'All Sources',
  'browse.popular': 'Popular',
  'browse.latest': 'Latest',
  'browse.emptyTitle': 'No Results Found',
  'browse.emptyDesc': 'Try a different keyword or select another source.',
  'browse.noExtensionsTitle': 'No Extensions Installed',
  'browse.noExtensionsDesc': 'Install at least one source extension first to browse comic catalogs.',
  'browse.goToExtensions': 'Open Extensions',
  'browse.loading': 'Loading catalog from source...',
  'browse.loadMore': 'Load More',
  'extensions.title': 'Source Extensions',
  'extensions.subtitle': 'Install or manage comic catalog sources for Yomic.',
  'extensions.searchPlaceholder': 'Search extension name or language...',
  'extensions.filterAll': 'All',
  'extensions.filterInstalled': 'Installed',
  'extensions.filterAvailable': 'Available',
  'extensions.install': 'Install',
  'extensions.uninstall': 'Uninstall',
  'extensions.installed': 'Installed',
  'extensions.update': 'Update',
  'extensions.refreshRepo': 'Refresh Repository',
  'extensions.emptyTitle': 'No Extensions Found',
  'extensions.emptyDesc': 'No extensions match your search query.',
  'detail.backToLibrary': 'Back',
  'detail.inLibrary': 'In Library',
  'detail.addToLibrary': 'Add to Library',
  'detail.removeFromLibrary': 'Remove from Library',
  'detail.startReading': 'Start Reading',
  'detail.continueChapter': 'Continue Ch. {num}',
  'detail.trackMal': 'Track on MAL',
  'detail.trackedMal': 'MAL: {title}',
  'detail.categories': 'Categories',
  'detail.chaptersHeader': 'Chapters ({count})',
  'detail.sortAsc': 'Oldest',
  'detail.sortDesc': 'Newest',
  'detail.downloadAll': 'Download All',
  'detail.markRead': 'Mark as Read',
  'detail.markUnread': 'Mark as Unread',
  'detail.noChapters': 'No chapters available yet.',
  'detail.malModalTitle': 'Link MyAnimeList Tracker',
  'detail.malSearchPlaceholder': 'Search manga title on MyAnimeList...',
  'detail.malSearchBtn': 'Search',
  'detail.malSearching': 'Searching MyAnimeList...',
  'detail.malSelectBtn': 'Select',
  'detail.malStatusLabel': 'Reading Status',
  'detail.malChapterLabel': 'Last Chapter Read',
  'detail.malScoreLabel': 'Score (0-10)',
  'detail.malUnlinkBtn': 'Unlink',
  'detail.malUpdateBtn': 'Update Tracker',
};

export const TRANSLATIONS: Record<AppLanguage, Record<TranslationKey, string>> = {
  id: ID_DICT,
  en: EN_DICT,
};

export function translate(
  lang: AppLanguage | string | undefined,
  key: TranslationKey,
  params?: Record<string, string | number>
): string {
  const safeLang: AppLanguage = lang === 'en' ? 'en' : 'id';
  let text = TRANSLATIONS[safeLang][key] ?? TRANSLATIONS.id[key] ?? key;
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      text = text.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
    }
  }
  return text;
}

export function applyStaticDomTranslations(lang: AppLanguage | string | undefined): void {
  const safeLang: AppLanguage = lang === 'en' ? 'en' : 'id';
  document.documentElement.lang = safeLang;

  document.querySelectorAll<HTMLElement>('[data-i18n]').forEach((el) => {
    const key = el.getAttribute('data-i18n') as TranslationKey | null;
    if (key) {
      el.textContent = translate(safeLang, key);
    }
  });

  document.querySelectorAll<HTMLElement>('[data-i18n-html]').forEach((el) => {
    const key = el.getAttribute('data-i18n-html') as TranslationKey | null;
    if (key) {
      el.innerHTML = translate(safeLang, key);
    }
  });

  document.querySelectorAll<HTMLElement>('[data-i18n-title]').forEach((el) => {
    const key = el.getAttribute('data-i18n-title') as TranslationKey | null;
    if (key) {
      el.setAttribute('title', translate(safeLang, key));
    }
  });

  document.querySelectorAll<HTMLElement>('[data-i18n-aria]').forEach((el) => {
    const key = el.getAttribute('data-i18n-aria') as TranslationKey | null;
    if (key) {
      el.setAttribute('aria-label', translate(safeLang, key));
    }
  });

  document.querySelectorAll<HTMLElement>('[data-i18n-placeholder]').forEach((el) => {
    const key = el.getAttribute('data-i18n-placeholder') as TranslationKey | null;
    if (key) {
      el.setAttribute('placeholder', translate(safeLang, key));
    }
  });
}
