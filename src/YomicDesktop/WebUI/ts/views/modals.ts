/* =========================================================================
 * YOMIC V2 — ANNOUNCEMENTS & FEEDBACK MODALS CONTROLLER
 * ========================================================================= */

import type { YomicApp } from '../app.js';
import { escapeXml } from '../mock-data.js';
import { AnnouncementItem } from '../types.js';

export const DEFAULT_ANNOUNCEMENTS: AnnouncementItem[] = [
  {
    id: '2026-11-20-yomic-v2-release',
    title: 'Rilis Resmi Yomic v2: Arsitektur Baru & Pengalaman Membaca Lebih Cepat',
    date: '2026-11-20',
    type: 'update',
    typeDisplay: 'Pembaruan',
    badgeBackground: '#10B981',
    content:
      'Kepada seluruh pengguna Yomic,\n\nKami dengan bangga mengumumkan perilisan resmi Yomic v2. Pembaruan besar ini menghadirkan perombakan menyeluruh pada arsitektur aplikasi menggunakan fondasi hibrida (.NET 8, WebView2, dan TypeScript modular) demi menghadirkan performa yang lebih ringan, responsif, dan stabil untuk penggunaan jangka panjang.\n\nPembaruan Utama:\n• Antarmuka baru yang lebih bersih dan modern dengan dukungan penuh Mode Gelap serta Mode Terang, tata letak pustaka yang rapi, dan navigasi bilah samping yang lebih intuitif.\n• Mesin pemrosesan gambar berbasis SkiaSharp untuk pemuatan halaman komik yang lebih cepat, tajam, serta hemat penggunaan memori.\n• Dasbor Statistik Membaca yang menampilkan aktivitas baca 14 hari terakhir, genre terpopuler, persentase penyelesaian, dan catatan konsistensi harian (Daily Streak).\n• Arsitektur ekstensi modular dengan katalog sumber yang lebih luas, pengaturan bahasa per sumber, serta mekanisme verifikasi otomatis untuk sumber yang dilindungi pemeriksaan keamanan.\n• Peningkatan keamanan dan keandalan data, meliputi enkripsi token pelacakan MyAnimeList, perlindungan single-instance, serta sistem pencadangan dan pemulihan (.yomicbackup) yang lebih aman.\n\nCatatan untuk Pengguna:\n• Pengguna baru kini dapat memilih dan memasang ekstensi sumber komik secara mandiri melalui menu Ekstensi sesuai kebutuhan.\n• Apabila Anda menemukan kendala atau memiliki saran pengembangan, silakan sampaikan langsung melalui menu Kirim Masukan.\n\nTerima kasih atas kepercayaan dan dukungan Anda terhadap pengembangan Yomic.\n\nHormat kami,\nTim Pengembang Yomic'
  },
  {
    id: '2026-08-15-komikcast-shutdown-v2',
    title: 'Pemberitahuan Penutupan Resmi Server Komikcast',
    date: '15 Agu 2026 · Tim Yomic',
    content:
      'Halo pembaca setia Yomic,\n\nKami ingin menyampaikan informasi bahwa sumber komik Komikcast telah resmi menghentikan operasional server dan situs web mereka secara permanen karena kendala kritis yang tidak dapat dipulihkan.\n\nInformasi Penting:\n• Ekstensi dan chapter dari sumber Komikcast tidak lagi dapat diakses melalui aplikasi.\n• Proyek terjemahan yang belum selesai dikabarkan akan dilanjutkan melalui Voratoon.\n• Silakan gunakan menu Jelajahi Sumber / Ekstensi untuk menemukan sumber alternatif lainnya yang tersedia di Yomic.\n\nTerima kasih atas pengertian dan kesetiaan Anda menggunakan Yomic.'
  },
  {
    id: 'ann-dns-doh',
    title: 'Dukungan DNS-over-HTTPS & Bypass Cloudflare',
    date: '28 Okt 2026 · Infrastruktur Sumber',
    content:
      'Seluruh permintaan gambar dan katalog komik kini dilengkapi resolver DNS-over-HTTPS (Cloudflare 1.1.1.1 & Google 8.8.8.8) untuk memastikan akses sumber tetap lancar dan stabil.'
  },
  {
    id: 'ann-mal-sync',
    title: 'Integrasi Pelacakan MyAnimeList (MAL)',
    date: '15 Okt 2026 · Fitur Pustaka',
    content:
      'Anda dapat menyinkronkan progres bab yang telah dibaca beserta skor penilaian langsung dari halaman Detail Komik melalui tombol Track.'
  }
];

export function applyBackendAnnouncements(this: YomicApp, rawItems?: any[], hasUnread?: boolean): void {
  if (Array.isArray(rawItems) && rawItems.length > 0) {
    const mapped: AnnouncementItem[] = rawItems.map((it) => ({
      id: String(it.id || it.title || ''),
      title: String(it.title || 'Pengumuman'),
      date: String(it.date || 'Terbaru'),
      content: String(it.body || it.content || ''),
      type: String(it.type || 'info'),
      url: String(it.url || ''),
      hasUrl: Boolean(it.hasUrl || (it.url && String(it.url).trim() !== '')),
      typeDisplay: String(it.typeDisplay || 'Info'),
      badgeBackground: String(it.badgeBackground || '#0078D4')
    }));
    this.announcements = mapped;
    if (!this.announcements.some((a) => a.id === this.selectedAnnouncementId)) {
      this.selectedAnnouncementId = this.announcements[0].id;
    }
    const backdrop = document.getElementById('announcementModalBackdrop');
    if (backdrop?.classList.contains('open')) {
      this.renderAnnouncementModalBody();
    }
  }
  const dot = document.getElementById('announcementUnreadDot');
  if (dot && typeof hasUnread === 'boolean') {
    dot.classList.toggle('hidden', !hasUnread);
  }
}

export function closeModalWithAnimation(
  this: YomicApp,
  backdropId: string,
  triggerBtnId?: string,
  onComplete?: () => void
): void {
  const backdrop = document.getElementById(backdropId);
  if (!backdrop || !backdrop.classList.contains('open')) return;
  if (triggerBtnId) {
    document.getElementById(triggerBtnId)?.classList.remove('active');
  }
  if (backdrop.classList.contains('closing')) return;
  backdrop.classList.add('closing');
  window.setTimeout(() => {
    backdrop.classList.remove('open', 'closing');
    if (onComplete) onComplete();
  }, 150);
}

export function openAnnouncementsModal(this: YomicApp): void {
  const backdrop = document.getElementById('announcementModalBackdrop');
  if (!backdrop) return;
  backdrop.classList.remove('closing');
  document.getElementById('announcementUnreadDot')?.classList.add('hidden');
  document.getElementById('btnOpenAnnouncements')?.classList.add('active');
  if (this.announcements.length > 0) {
    this.selectedAnnouncementId = this.announcements[0].id;
  }
  this.renderAnnouncementModalBody();
  backdrop.classList.add('open');
  if (this.bridge.isWebViewHost) {
    const latestId = this.announcements[0]?.id || '';
    if (latestId) {
      void this.bridge.invoke('announcements:mark-read', { id: latestId });
    }
    void this.bridge
      .invoke<{ announcements?: any[]; hasUnread?: boolean }>('announcements:get-list', { force: false })
      .then((res) => {
        if (res && Array.isArray(res.announcements) && res.announcements.length > 0) {
          this.applyBackendAnnouncements(res.announcements, false);
          const topId = this.announcements[0]?.id || '';
          if (topId) {
            void this.bridge.invoke('announcements:mark-read', { id: topId });
          }
        }
      })
      .catch(() => {});
  }
}

export function closeAnnouncementsModal(this: YomicApp): void {
  this.closeModalWithAnimation('announcementModalBackdrop', 'btnOpenAnnouncements');
}

const READ_ANNOUNCEMENTS_KEY = 'yomic_read_announcements';

function getReadAnnouncementIds(): Set<string> {
  try {
    const raw = localStorage.getItem(READ_ANNOUNCEMENTS_KEY);
    if (!raw) return new Set<string>();
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return new Set<string>(parsed.map((v) => String(v)));
    }
  } catch {
    // ignore storage errors
  }
  return new Set<string>();
}

function markAnnouncementReadLocal(id: string): void {
  if (!id) return;
  try {
    const set = getReadAnnouncementIds();
    if (!set.has(id)) {
      set.add(id);
      localStorage.setItem(READ_ANNOUNCEMENTS_KEY, JSON.stringify(Array.from(set)));
    }
  } catch {
    // ignore storage errors
  }
}

function formatAnnouncementDate(rawDate: string, lang: 'id' | 'en'): string {
  const trimmed = String(rawDate || '').trim();
  const isoMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (!isoMatch) return trimmed;
  const year = Number(isoMatch[1]);
  const monthIdx = Number(isoMatch[2]) - 1;
  const day = Number(isoMatch[3]);
  const monthsId = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  const monthsEn = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  if (monthIdx < 0 || monthIdx > 11 || day < 1 || day > 31) return trimmed;
  return lang === 'en'
    ? `${monthsEn[monthIdx]} ${day}, ${year}`
    : `${day} ${monthsId[monthIdx]} ${year}`;
}

function getAnnouncementBadgeTone(type?: string): 'info' | 'update' | 'warning' | 'danger' {
  const norm = String(type || 'info').toLowerCase().trim();
  if (norm === 'danger' || norm === 'urgent' || norm === 'error' || norm === 'critical' || norm === 'shutdown') {
    return 'danger';
  }
  if (norm === 'warning' || norm === 'warn' || norm === 'maintenance') {
    return 'warning';
  }
  if (norm === 'update' || norm === 'release' || norm === 'feature' || norm === 'success') {
    return 'update';
  }
  return 'info';
}

function getAnnouncementBadgeLabel(tone: 'info' | 'update' | 'warning' | 'danger', lang: 'id' | 'en'): string {
  if (tone === 'update') return lang === 'en' ? 'Update' : 'Pembaruan';
  if (tone === 'warning') return lang === 'en' ? 'Warning' : 'Peringatan';
  if (tone === 'danger') return lang === 'en' ? 'Important' : 'Penting';
  return 'Info';
}

function isBulletLine(line: string): boolean {
  return /^(?:•|-|\*)\s+/.test(line.trim());
}

function stripBulletPrefix(line: string): string {
  return line.trim().replace(/^(?:•|-|\*)\s+/, '');
}

function isQuotedLine(line: string): boolean {
  const t = line.trim();
  return (
    t.startsWith('>') ||
    (t.length >= 2 && ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith('“') && t.endsWith('”'))))
  );
}

function stripQuoteWrapper(line: string): string {
  let t = line.trim();
  if (t.startsWith('>')) {
    t = t.replace(/^>\s*/, '');
  }
  if (t.length >= 2 && ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith('“') && t.endsWith('”')))) {
    t = t.slice(1, -1).trim();
  }
  return t;
}

function formatAnnouncementContentHtml(rawContent: string): string {
  const normalized = String(rawContent || '').replace(/\r\n/g, '\n').trim();
  if (!normalized) return '';

  const blocks = normalized.split(/\n{2,}/);
  const htmlParts: string[] = [];

  for (const rawBlock of blocks) {
    const lines = rawBlock
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0);
    if (lines.length === 0) continue;

    // Case 1: Block starts with a short section label ending with ":" followed by bullets or a quote
    let startIdx = 0;
    if (lines.length >= 2 && lines[0].endsWith(':') && lines[0].length <= 64) {
      const rest = lines.slice(1);
      if (rest.every(isBulletLine) || rest.every(isQuotedLine)) {
        htmlParts.push(`<div class="announcement-section-label">${escapeXml(lines[0].slice(0, -1))}</div>`);
        startIdx = 1;
      }
    }

    const activeLines = lines.slice(startIdx);
    if (activeLines.length === 0) continue;

    // Case 2: All remaining lines are bullets
    if (activeLines.every(isBulletLine)) {
      const itemsHtml = activeLines
        .map((line) => `<li>${escapeXml(stripBulletPrefix(line))}</li>`)
        .join('');
      htmlParts.push(`<ul class="announcement-list">${itemsHtml}</ul>`);
      continue;
    }

    // Case 3: All remaining lines are quoted text
    if (activeLines.every(isQuotedLine)) {
      const quoteHtml = activeLines.map((line) => escapeXml(stripQuoteWrapper(line))).join('<br/>');
      htmlParts.push(`<blockquote class="announcement-quote">${quoteHtml}</blockquote>`);
      continue;
    }

    // Case 4: Standard paragraph (still handle inline bullet mix if present)
    const renderedParagraph = activeLines.map((line) => escapeXml(line)).join('<br/>');
    htmlParts.push(`<p>${renderedParagraph}</p>`);
  }

  return htmlParts.join('');
}

export function renderAnnouncementModalBody(this: YomicApp): void {
  const listCol = document.getElementById('announcementListCol');
  const detailCol = document.getElementById('announcementDetailCol');
  if (!listCol || !detailCol) return;
  const selected =
    this.announcements.find((a) => a.id === this.selectedAnnouncementId) ?? this.announcements[0];
  if (!selected) {
    listCol.innerHTML = '';
    detailCol.innerHTML = `<div class="announcement-empty">${this.l('Belum ada pengumuman saat ini.', 'No announcements yet.')}</div>`;
    return;
  }

  markAnnouncementReadLocal(selected.id);
  const readIds = getReadAnnouncementIds();
  const lang = this.settings.appLanguage === 'en' ? 'en' : 'id';

  listCol.innerHTML = this.announcements
    .map((item) => {
      const isSelected = item.id === selected.id;
      const isUnread = !isSelected && !readIds.has(item.id);
      const formattedDate = formatAnnouncementDate(item.date, lang);
      return `
      <button class="announcement-item-btn ${isSelected ? 'active' : ''} ${isUnread ? 'unread' : ''}" data-ann-id="${escapeXml(item.id)}">
        <div class="announcement-item-top">
          <span class="announcement-item-title">${escapeXml(item.title)}</span>
          ${isUnread ? '<span class="announcement-item-unread-dot" aria-label="Belum dibaca"></span>' : ''}
        </div>
        <div class="announcement-item-meta">
          <span class="announcement-item-date">${escapeXml(formattedDate)}</span>
        </div>
      </button>
    `;
    })
    .join('');

  const selectedTone = getAnnouncementBadgeTone(selected.type);
  const badgeLabel = getAnnouncementBadgeLabel(selectedTone, lang);
  const badgeHtml = `<span class="announcement-type-badge tone-${selectedTone}">${escapeXml(badgeLabel)}</span>`;
  const formattedSelectedDate = formatAnnouncementDate(selected.date, lang);
  const linkBtnHtml =
    selected.url && selected.url.trim() !== ''
      ? `<div class="announcement-link-row"><button id="btnOpenAnnouncementUrl" class="btn-secondary announcement-ext-link-btn" data-url="${escapeXml(selected.url)}"><span>${this.l('Buka Tautan Informasi', 'Open Information Link')}</span><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg></button></div>`
      : '';

  detailCol.innerHTML = `
      <div class="announcement-detail-header">
        <div class="announcement-detail-meta-row">
          ${badgeHtml}
          <span class="announcement-detail-date-text">${escapeXml(formattedSelectedDate)}</span>
        </div>
        <h3 class="announcement-detail-title">${escapeXml(selected.title)}</h3>
      </div>
      <div class="announcement-detail-content">${formatAnnouncementContentHtml(selected.content)}</div>
      ${linkBtnHtml}
    `;
  detailCol.scrollTop = 0;

  document.getElementById('btnOpenAnnouncementUrl')?.addEventListener('click', (ev) => {
    const target = ev.currentTarget as HTMLElement;
    const url = target?.dataset?.url;
    if (url) {
      this.bridge.openExternalUrl(url);
    }
  });
  listCol.querySelectorAll<HTMLButtonElement>('[data-ann-id]').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (btn.dataset.annId) {
        this.selectedAnnouncementId = btn.dataset.annId;
        markAnnouncementReadLocal(btn.dataset.annId);
        this.renderAnnouncementModalBody();
      }
    });
  });
}

interface FeedbackScreenshotAttachment {
  base64: string;
  name: string;
  mimeType: string;
}

let pendingFeedbackScreenshot: FeedbackScreenshotAttachment | null = null;

function formatAttachmentBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

const MAX_FEEDBACK_INPUT_BYTES = 10 * 1024 * 1024;
const TARGET_FEEDBACK_MAX_BYTES = 900 * 1024;

function estimateDataUrlBytes(dataUrl: string): number {
  const commaIdx = dataUrl.indexOf(',');
  const base64 = commaIdx >= 0 ? dataUrl.slice(commaIdx + 1) : dataUrl;
  const padding = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0;
  return Math.max(0, Math.floor((base64.length * 3) / 4) - padding);
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string' && reader.result) {
        resolve(reader.result);
      } else {
        reject(new Error('Empty file data'));
      }
    };
    reader.onerror = () => reject(reader.error ?? new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

function loadImageFromDataUrl(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to decode image'));
    img.src = dataUrl;
  });
}

async function prepareFeedbackScreenshot(
  file: File
): Promise<FeedbackScreenshotAttachment & { sizeBytes: number }> {
  const originalDataUrl = await readFileAsDataUrl(file);
  if (file.size <= TARGET_FEEDBACK_MAX_BYTES) {
    return {
      base64: originalDataUrl,
      name: file.name,
      mimeType: file.type,
      sizeBytes: file.size
    };
  }

  const img = await loadImageFromDataUrl(originalDataUrl);
  const maxDimension = 1920;
  let scale = Math.min(1, maxDimension / Math.max(img.naturalWidth || 1, img.naturalHeight || 1));

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return {
      base64: originalDataUrl,
      name: file.name,
      mimeType: file.type,
      sizeBytes: file.size
    };
  }

  let bestDataUrl = '';
  let bestBytes = Number.MAX_SAFE_INTEGER;

  for (let pass = 0; pass < 4; pass++) {
    const width = Math.max(1, Math.round((img.naturalWidth || 1) * scale));
    const height = Math.max(1, Math.round((img.naturalHeight || 1) * scale));
    canvas.width = width;
    canvas.height = height;
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(img, 0, 0, width, height);

    for (const quality of [0.85, 0.72, 0.58, 0.45]) {
      const candidate = canvas.toDataURL('image/jpeg', quality);
      const bytes = estimateDataUrlBytes(candidate);
      if (bytes < bestBytes) {
        bestDataUrl = candidate;
        bestBytes = bytes;
      }
      if (bytes <= TARGET_FEEDBACK_MAX_BYTES) {
        const baseName = file.name.replace(/\.[^.]+$/, '') || 'screenshot';
        return {
          base64: candidate,
          name: `${baseName}.jpg`,
          mimeType: 'image/jpeg',
          sizeBytes: bytes
        };
      }
    }

    scale *= 0.75;
  }

  const baseName = file.name.replace(/\.[^.]+$/, '') || 'screenshot';
  return {
    base64: bestDataUrl || originalDataUrl,
    name: bestDataUrl ? `${baseName}.jpg` : file.name,
    mimeType: bestDataUrl ? 'image/jpeg' : file.type,
    sizeBytes: bestDataUrl ? bestBytes : file.size
  };
}

function clearFeedbackAttachment(): void {
  pendingFeedbackScreenshot = null;
  const fileInput = document.getElementById('feedbackScreenshotInput') as HTMLInputElement | null;
  if (fileInput) fileInput.value = '';
  const attachBtn = document.getElementById('btnAttachFeedbackScreenshot');
  if (attachBtn) attachBtn.style.display = 'inline-flex';
  const preview = document.getElementById('feedbackAttachmentPreview');
  if (preview) preview.style.display = 'none';
  const thumb = document.getElementById('feedbackAttachmentThumb') as HTMLImageElement | null;
  if (thumb) thumb.removeAttribute('src');
}

export function openFeedbackModal(this: YomicApp): void {
  const backdrop = document.getElementById('feedbackModalBackdrop');
  if (!backdrop) return;
  const bugRadio = document.querySelector<HTMLInputElement>('input[name="feedbackType"][value="bug"]');
  if (bugRadio) bugRadio.checked = true;
  const msgEl = document.getElementById('feedbackMessageInput') as HTMLTextAreaElement | null;
  if (msgEl) {
    msgEl.value = '';
    msgEl.placeholder = this.t('feedback.placeholder');
  }
  clearFeedbackAttachment();
  const submitBtn = document.getElementById('btnSubmitFeedback') as HTMLButtonElement | null;
  if (submitBtn) {
    submitBtn.disabled = false;
    submitBtn.textContent = this.t('feedback.submit');
  }
  backdrop.classList.remove('closing');
  document.getElementById('btnOpenFeedback')?.classList.add('active');
  backdrop.classList.add('open');
}

export function closeFeedbackModal(this: YomicApp): void {
  this.closeModalWithAnimation('feedbackModalBackdrop', 'btnOpenFeedback');
}

export function bindModalShellEvents(this: YomicApp): void {
  // Announcements Modal (Sidebar Bottom)
  const annBackdrop = document.getElementById('announcementModalBackdrop');
  document.getElementById('btnOpenAnnouncements')?.addEventListener('click', () => {
    this.openAnnouncementsModal();
  });
  document.getElementById('btnCloseAnnouncements')?.addEventListener('click', () => {
    this.closeAnnouncementsModal();
  });
  document.getElementById('btnRefreshAnnouncements')?.addEventListener('click', () => {
    const btn = document.getElementById('btnRefreshAnnouncements') as HTMLButtonElement | null;
    if (!btn || btn.classList.contains('spinning')) return;
    btn.classList.add('spinning');
    if (this.bridge.isWebViewHost) {
      void this.bridge
        .invoke<{ announcements?: any[]; hasUnread?: boolean }>('announcements:get-list', { force: true })
        .then((res) => {
          if (res && Array.isArray(res.announcements) && res.announcements.length > 0) {
            this.applyBackendAnnouncements(res.announcements, false);
          }
          this.showToast(this.l('Pengumuman berhasil diperbarui.', 'Announcements refreshed.'));
        })
        .catch(() => {
          this.showToast(this.l('Gagal memuat ulang pengumuman.', 'Failed to refresh announcements.'));
        })
        .finally(() => {
          window.setTimeout(() => btn.classList.remove('spinning'), 300);
        });
    } else {
      this.renderAnnouncementModalBody();
      window.setTimeout(() => btn.classList.remove('spinning'), 350);
    }
  });
  annBackdrop?.addEventListener('click', (ev) => {
    if (ev.target === annBackdrop) {
      this.closeAnnouncementsModal();
    }
  });

  // Feedback Modal (Give Feedback)
  const fbBackdrop = document.getElementById('feedbackModalBackdrop');
  document.getElementById('btnOpenFeedback')?.addEventListener('click', () => {
    this.openFeedbackModal();
  });
  document.getElementById('btnCloseFeedback')?.addEventListener('click', () => {
    this.closeFeedbackModal();
  });
  document.getElementById('btnCancelFeedback')?.addEventListener('click', () => {
    this.closeFeedbackModal();
  });
  const screenshotInput = document.getElementById('feedbackScreenshotInput') as HTMLInputElement | null;
  document.getElementById('btnAttachFeedbackScreenshot')?.addEventListener('click', () => {
    screenshotInput?.click();
  });
  document.getElementById('btnRemoveFeedbackAttachment')?.addEventListener('click', () => {
    clearFeedbackAttachment();
  });
  screenshotInput?.addEventListener('change', async () => {
    const file = screenshotInput.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      this.showToast(this.l('Hanya file gambar yang didukung sebagai tangkapan layar.', 'Only image files are supported as screenshots.'));
      clearFeedbackAttachment();
      return;
    }
    if (file.size > MAX_FEEDBACK_INPUT_BYTES) {
      this.showToast(this.l('Ukuran gambar maksimal 10 MB.', 'Maximum image size is 10 MB.'));
      clearFeedbackAttachment();
      return;
    }
    try {
      const prepared = await prepareFeedbackScreenshot(file);
      if (prepared.sizeBytes > 1024 * 1024) {
        this.showToast(this.l('Gambar gagal dikompresi di bawah 1 MB. Gunakan gambar lain.', 'Failed to compress image under 1 MB. Please use another image.'));
        clearFeedbackAttachment();
        return;
      }
      pendingFeedbackScreenshot = {
        base64: prepared.base64,
        name: prepared.name,
        mimeType: prepared.mimeType
      };
      const thumb = document.getElementById('feedbackAttachmentThumb') as HTMLImageElement | null;
      const nameEl = document.getElementById('feedbackAttachmentName');
      const sizeEl = document.getElementById('feedbackAttachmentSize');
      const attachBtn = document.getElementById('btnAttachFeedbackScreenshot');
      const preview = document.getElementById('feedbackAttachmentPreview');
      if (thumb) thumb.src = prepared.base64;
      if (nameEl) nameEl.textContent = prepared.name;
      if (sizeEl) sizeEl.textContent = formatAttachmentBytes(prepared.sizeBytes);
      if (attachBtn) attachBtn.style.display = 'none';
      if (preview) preview.style.display = 'flex';
    } catch {
      this.showToast(this.l('Gagal memproses gambar tangkapan layar.', 'Failed to process screenshot image.'));
      clearFeedbackAttachment();
    }
  });
  const fbPlaceholders: Record<string, { id: string; en: string }> = {
    bug: { id: 'Jelaskan langkah-langkah kendala atau bug yang Anda temui...', en: 'Describe the steps to reproduce the bug you encountered...' },
    feature: { id: 'Jelaskan ide atau fitur yang ingin Anda tambahkan ke Yomic...', en: 'Describe the idea or feature you would like to add to Yomic...' },
    extension: { id: 'Sebutkan ekstensi/sumber, bab komik, dan kendala pemuatan...', en: 'Specify the extension/source, comic chapter, and loading issue...' },
    performance: { id: 'Jelaskan masalah kelambatan, memori, atau jaringan yang Anda alami...', en: 'Describe the lag, memory, or network issues you experienced...' },
    general: { id: 'Bagikan pengalaman atau saran Anda untuk pengembangan Yomic...', en: 'Share your experience or suggestions for Yomic development...' }
  };
  document.querySelectorAll<HTMLInputElement>('input[name="feedbackType"]').forEach((radio) => {
    radio.addEventListener('change', () => {
      if (radio.checked) {
        const msgEl = document.getElementById('feedbackMessageInput') as HTMLTextAreaElement | null;
        if (msgEl) {
          const entry = fbPlaceholders[radio.value];
          msgEl.placeholder = entry ? this.l(entry.id, entry.en) : this.t('feedback.placeholder');
        }
      }
    });
  });
  document.getElementById('btnSubmitFeedback')?.addEventListener('click', () => {
    const submitBtn = document.getElementById('btnSubmitFeedback') as HTMLButtonElement | null;
    if (submitBtn?.disabled) return;
    const msgEl = document.getElementById('feedbackMessageInput') as HTMLTextAreaElement | null;
    const text = msgEl?.value.trim() ?? '';
    if (!text) {
      this.showToast(this.t('feedback.emptyWarning'));
      return;
    }
    const checkedRadio = document.querySelector<HTMLInputElement>('input[name="feedbackType"]:checked');
    const category = checkedRadio?.value || 'bug';
    const categoryLabels: Record<string, string> = {
      bug: 'Laporan Bug',
      feature: 'Permintaan Fitur',
      extension: 'Kendala Ekstensi & Sumber',
      performance: 'Performa & Jaringan',
      general: 'Saran Umum'
    };
    const categoryLabel = categoryLabels[category] || 'Laporan Bug';
    const screenshotPayload = pendingFeedbackScreenshot
      ? { ...pendingFeedbackScreenshot }
      : null;

    if (msgEl) msgEl.value = '';
    clearFeedbackAttachment();
    this.closeFeedbackModal();
    this.showToast(this.l('Mengirim masukan...', 'Sending feedback...'));

    void (async () => {
      try {
        const res = await this.bridge.invoke<{ ok: boolean; error?: string }>('feedback:submit', {
          category,
          categoryLabel,
          message: text,
          screenshotBase64: screenshotPayload?.base64 ?? '',
          screenshotName: screenshotPayload?.name ?? '',
          screenshotMimeType: screenshotPayload?.mimeType ?? ''
        });
        if (res && res.ok) {
          this.showToast(this.t('feedback.sentSuccess'));
        } else {
          this.showToast(res?.error || this.l('Gagal mengirim masukan. Silakan coba lagi nanti.', 'Failed to send feedback. Please try again later.'));
        }
      } catch {
        this.showToast(this.l('Terjadi kesalahan saat mengirim masukan.', 'An error occurred while sending feedback.'));
      }
    })();
  });
  fbBackdrop?.addEventListener('click', (ev) => {
    if (ev.target === fbBackdrop) {
      this.closeFeedbackModal();
    }
  });
}
