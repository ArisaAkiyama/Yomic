/* =========================================================================
 * YOMIC V2 — SOURCE FAVICON, EXTENSION LOGO & MANGA COVER RESOLVERS
 * ========================================================================= */

import type { YomicApp } from '../app.js';
import { buildMangaCoverSvg, escapeXml } from '../mock-data.js';
import { ExtensionItem, MangaItem } from '../types.js';

const SOURCE_ICON_LOOKUP: Array<{ match: string[]; url: string }> = [
  { match: ['luvyaa'], url: 'https://raw.githubusercontent.com/ArisaAkiyama/extension-yomic/main/icons/luvyaa.png' },
  { match: ['mangafire'], url: 'https://raw.githubusercontent.com/ArisaAkiyama/extension-yomic/main/icons/mangafire.png' },
  { match: ['softkomik'], url: 'https://raw.githubusercontent.com/ArisaAkiyama/extension-yomic/main/icons/softkomik.png' },
  { match: ['voratoon'], url: 'https://v2.voratoon.com/icon.png?d25ad1050814f86f' },
  { match: ['komiku'], url: 'https://www.google.com/s2/favicons?domain=komiku.org&sz=128' },
  { match: ['kiryuu'], url: 'https://www.google.com/s2/favicons?domain=v7.kiryuu.to&sz=128' },
  { match: ['komikstation'], url: 'https://www.google.com/s2/favicons?domain=komikstation.org&sz=128' },
  { match: ['westmanga'], url: 'https://www.google.com/s2/favicons?domain=westmanga.info&sz=128' },
  { match: ['mangadex'], url: 'https://www.google.com/s2/favicons?domain=mangadex.org&sz=128' },
  { match: ['asura'], url: 'https://www.google.com/s2/favicons?domain=asuracomic.net&sz=128' },
  { match: ['flame'], url: 'https://www.google.com/s2/favicons?domain=flamecomics.xyz&sz=128' },
  { match: ['bato'], url: 'https://www.google.com/s2/favicons?domain=mangatoto.com&sz=128' },
  { match: ['shinigami'], url: 'https://www.google.com/s2/favicons?domain=shinigami01.com&sz=128' },
  { match: ['manhwaindo'], url: 'https://manhwaindo.id/favicon.svg' },
  { match: ['mangabat'], url: 'https://www.google.com/s2/favicons?domain=mangabat.com&sz=128' },
  { match: ['maidmanga', 'maid'], url: 'https://www.google.com/s2/favicons?domain=maid.my.id&sz=128' },
  { match: ['okyykomik'], url: 'https://www.google.com/s2/favicons?domain=okyykomik.my.id&sz=128' },
  { match: ['ryzukomik'], url: 'https://www.google.com/s2/favicons?domain=baca.ryzukomik.space&sz=128' },
  { match: ['shueisha', 'mangamillion'], url: 'https://www.google.com/s2/favicons?domain=shueisha.co.jp&sz=128' },
  { match: ['aarlas'], url: 'https://www.arlas.online/favicon.ico' },
  { match: ['weebcentral'], url: 'https://weebcentral.com/favicon.ico' }
];

export function resolveSourceIconUrl(key: string, baseUrl?: string, explicitIconUrl?: string): string {
  if (explicitIconUrl && explicitIconUrl.trim() !== '') {
    return explicitIconUrl;
  }
  const lowerKey = key.toLowerCase();
  for (const entry of SOURCE_ICON_LOOKUP) {
    if (entry.match.some((token) => lowerKey.includes(token))) {
      return entry.url;
    }
  }
  if (baseUrl && !baseUrl.startsWith('http://127.0.0.1')) {
    try {
      const u = new URL(baseUrl);
      return `https://www.google.com/s2/favicons?domain=${u.hostname}&sz=128`;
    } catch { }
  }
  return '';
}

export function getMangaCoverHtmlSrc(this: YomicApp, manga: MangaItem): string {
  if (manga.coverUrl && manga.coverUrl.trim() !== '') {
    return manga.coverUrl;
  }
  return buildMangaCoverSvg(manga);
}

export function buildSourceLogoHtml(this: YomicApp, src: ExtensionItem, sizePx?: number): string {
  const rawName = src.name.replace(/^Yomic:\s*/i, '').trim();
  const words = rawName.split(/[\s_-]+/);
  let initials = '';
  if (words.length >= 2 && words[0].length > 0 && words[1].length > 0) {
    initials = (words[0][0] + words[1][0]).toUpperCase();
  } else {
    initials = rawName.slice(0, 2).toUpperCase();
  }
  const size = sizePx || 36;
  const sizeStyle = `width:${size}px;height:${size}px;font-size:${Math.round(size * 0.35)}px;border-radius:8px;`;
  const key = `${src.pkg || ''} ${src.id || ''} ${src.name || ''}`;
  const iconUrl = resolveSourceIconUrl(key, src.baseUrl, src.iconUrl);

  if (iconUrl) {
    return `<div class="v1-source-logo" style="${sizeStyle}background:transparent;border:none;box-shadow:none;padding:0;overflow:hidden;display:inline-flex;align-items:center;justify-content:center;"><img src="${iconUrl}" alt="${escapeXml(src.name)}" style="width:100%;height:100%;object-fit:contain;border-radius:6px;display:block;" onerror="this.onerror=null;this.parentElement.style.background='${src.accentColor}';this.parentElement.style.color='#FFFFFF';this.parentElement.innerHTML='${initials}';" /></div>`;
  }
  return `<div class="v1-source-logo" style="${sizeStyle}background:${src.accentColor};color:#FFFFFF;">${initials}</div>`;
}

export function buildSourceFaviconHtml(
  this: YomicApp,
  sourceName: string,
  sourceId?: string | number,
  sizePx: number = 14
): string {
  const sName = sourceName || '';
  const ext = this.extensions.find(
    (e) =>
      (sourceId && String(e.sourceId) === String(sourceId)) ||
      (sourceId && e.id === String(sourceId)) ||
      (e.name && e.name.toLowerCase() === sName.toLowerCase()) ||
      (e.name && e.name.toLowerCase().includes(sName.toLowerCase()))
  );
  const key = `${ext?.pkg || ''} ${ext?.id || ''} ${ext?.name || ''} ${sName}`.toLowerCase();
  const iconUrl = resolveSourceIconUrl(key, ext?.baseUrl, ext?.iconUrl);

  if (iconUrl) {
    return `<img class="manga-card-favicon" src="${iconUrl}" alt="${escapeXml(sName)}" title="${escapeXml(sName)}" width="${sizePx}" height="${sizePx}" loading="lazy" onerror="this.style.display='none';" />`;
  }

  const initials = sName.slice(0, 2).toUpperCase() || '??';
  return `<span class="manga-card-favicon-fallback" title="${escapeXml(sName)}">${initials}</span>`;
}
