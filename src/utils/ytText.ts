/**
 * Parsers for the localized, abbreviated text YouTube shows on video cards,
 * e.g. "103 B" + "3 ay önce" (Turkish) or "103K views" + "3 months ago" (English).
 * Only Turkish and English are supported; other UI languages return null.
 */

export type PageLang = 'tr' | 'en';

export function pageLang(): PageLang | null {
  const lang = document.documentElement.lang.toLowerCase();
  if (lang.startsWith('tr')) return 'tr';
  if (lang.startsWith('en')) return 'en';
  return null;
}

const MULTIPLIERS: Record<PageLang, Record<string, number>> = {
  // Turkish "B" is "bin" (thousand), not billion.
  tr: { b: 1e3, bin: 1e3, mn: 1e6, mr: 1e9 },
  en: { k: 1e3, m: 1e6, b: 1e9 },
};

const LIVE_WORDS = /izliyor|izleyici|watching|waiting|bekliyor/i;

/** "103 B" -> 103000, "1,2 Mn görüntüleme" -> 1200000, "1.2M views" -> 1200000, "1,234 views" -> 1234 */
export function parseCompactCount(text: string, lang: PageLang): number | null {
  const clean = text.replace(/\u00a0/g, ' ').trim();
  if (!clean || /\d:\d/.test(clean) || LIVE_WORDS.test(clean)) return null;
  if (/^(no views|görüntüleme yok)/i.test(clean)) return 0;

  const match = /(\d[\d.,]*)\s*([a-zA-ZçğıöşüÇĞİÖŞÜ]*)/.exec(clean);
  if (!match) return null;
  const [, digits, word] = match;
  const multiplier = MULTIPLIERS[lang][word.toLowerCase().replace(/\.$/, '')];

  if (multiplier) {
    const decimal = lang === 'tr' ? digits.replace(/\./g, '').replace(',', '.') : digits.replace(/,/g, '');
    const value = Number.parseFloat(decimal);
    return Number.isFinite(value) ? Math.round(value * multiplier) : null;
  }
  const whole = Number(digits.replace(/[.,]/g, ''));
  return Number.isFinite(whole) ? whole : null;
}

const AGE_PATTERNS: Record<PageLang, { regex: RegExp; units: Record<string, number> }> = {
  tr: {
    regex: /(\d+)\s*(saniye|sn|dakika|dk|saat|sa|gün|hafta|ay|yıl)\.?\s.*önce/i,
    units: { saniye: 1 / 86400, sn: 1 / 86400, dakika: 1 / 1440, dk: 1 / 1440, saat: 1 / 24, sa: 1 / 24, gün: 1, hafta: 7, ay: 30.44, yıl: 365 },
  },
  en: {
    regex: /(\d+)\s*(second|minute|hour|day|week|month|year)s?\s+ago/i,
    units: { second: 1 / 86400, minute: 1 / 1440, hour: 1 / 24, day: 1, week: 7, month: 30.44, year: 365 },
  },
};

/** "3 ay önce" -> 91.3, "19 hours ago" -> 0.79. Returns null when the text isn't a relative date. */
export function parseRelativeAgeDays(text: string, lang: PageLang): number | null {
  const { regex, units } = AGE_PATTERNS[lang];
  const match = regex.exec(text.replace(/\u00a0/g, ' '));
  if (!match) return null;
  const unit = units[match[2].toLowerCase()];
  return unit == null ? null : Number(match[1]) * unit;
}

/** Picks views and age out of a metadata row like ["103 B", "3 ay önce"]. */
export function parseMetadataParts(parts: string[], lang: PageLang): { views: number; ageDays: number } | null {
  const ageIndex = parts.findIndex((part) => parseRelativeAgeDays(part, lang) != null);
  if (ageIndex < 0) return null;
  const ageDays = parseRelativeAgeDays(parts[ageIndex], lang)!;
  for (let i = 0; i < parts.length; i++) {
    if (i === ageIndex) continue;
    const views = parseCompactCount(parts[i], lang);
    if (views != null) return { views, ageDays };
  }
  return null;
}

export function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}
