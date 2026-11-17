/* =========================================================================
 * YOMIC V2 — ANNOUNCEMENTS & FEEDBACK MODALS CONTROLLER
 * ========================================================================= */

import type { YomicApp } from '../app.js';
import { escapeXml } from '../mock-data.js';
import { AnnouncementItem } from '../types.js';

export const DEFAULT_ANNOUNCEMENTS: AnnouncementItem[] = [
  {
    id: 'ann-v2-release',
    title: 'Pembaruan Antarmuka Yomic v2 Minimalis',
    date: '02 Nov 2026 · Developer Yomic',
    content:
      'Selamat datang di Yomic!\n\nNavigasi bilah samping kini disesuaikan dengan struktur Yomic yang ringkas, bersih, dan langsung menuju Pustaka, Pembaruan, Riwayat, Unduhan, Jelajahi Sumber, dan Ekstensi.\n\nGunakan pintasan Ctrl+B untuk menciutkan atau memperlebar bilah navigasi kapan saja, serta Ctrl+K untuk pencarian cepat koleksi komik.'
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

function formatAnnouncementContentHtml(rawContent: string): string {
  const normalized = String(rawContent || '').replace(/\r\n/g, '\n').trim();
  if (!normalized) return '';
  return normalized
    .split(/\n{2,}/)
    .map((paragraph) => `<p>${escapeXml(paragraph.trim()).replace(/\n/g, '<br/>')}</p>`)
    .join('');
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
  listCol.innerHTML = this.announcements
    .map(
      (item) => `
      <button class="announcement-item-btn ${item.id === selected.id ? 'active' : ''}" data-ann-id="${escapeXml(item.id)}">
        <span class="announcement-item-title">${escapeXml(item.title)}</span>
        <span class="announcement-item-date">${escapeXml(item.date)}</span>
      </button>
    `
    )
    .join('');
  const badgeHtml = selected.typeDisplay
    ? `<span class="announcement-type-text">${escapeXml(selected.typeDisplay)}</span><span class="announcement-meta-sep" aria-hidden="true">·</span>`
    : '';
  const linkBtnHtml =
    selected.url && selected.url.trim() !== ''
      ? `<div class="announcement-link-row"><button id="btnOpenAnnouncementUrl" class="btn-secondary" style="font-size:12px;padding:6px 12px;" data-url="${escapeXml(selected.url)}">${this.l('Buka Tautan Informasi', 'Open Information Link')}</button></div>`
      : '';
  detailCol.innerHTML = `
      <div class="announcement-detail-title">${escapeXml(selected.title)}</div>
      <div class="announcement-detail-date">${badgeHtml}<span>${escapeXml(selected.date)}</span></div>
      <div class="announcement-detail-content">${formatAnnouncementContentHtml(selected.content)}</div>
      ${linkBtnHtml}
    `;
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
