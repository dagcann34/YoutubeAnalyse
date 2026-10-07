import type { VideoAnalytics } from '../types/youtube';
import { LOCALE, type Lang } from '../i18n';

const UNITS: Array<[number, string]> = [
  [1_000_000_000, 'B'],
  [1_000_000, 'M'],
  [1_000, 'K'],
];

/** 1234 -> "1.2K", 45000 -> "45K", 1200000 -> "1.2M" */
export function formatNumber(num: number): string {
  if (!Number.isFinite(num)) return '0';
  const abs = Math.abs(num);
  for (const [value, suffix] of UNITS) {
    if (abs >= value) {
      const scaled = num / value;
      const digits = Math.abs(scaled) >= 100 ? 0 : 1;
      return `${scaled.toFixed(digits).replace(/\.0$/, '')}${suffix}`;
    }
  }
  return String(Math.round(num));
}

/** (likes + comments) / views as a percentage with two decimals. */
export function calculateEngagement(views: number, likes: number, comments: number): number {
  if (!views || views <= 0) return 0;
  return Math.round(((likes + comments) / views) * 10_000) / 100;
}

/** Returns the video id for /watch?v=ID and /shorts/ID URLs, otherwise null. */
export function getVideoIdFromUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (!parsed.hostname.endsWith('youtube.com')) return null;
    if (parsed.pathname === '/watch') return parsed.searchParams.get('v');
    const shorts = parsed.pathname.match(/^\/shorts\/([\w-]{6,})/);
    return shorts ? shorts[1] : null;
  } catch {
    return null;
  }
}

/** "1.234 yorum" / "1,234 likes" -> 1234. Returns null when no digits are present. */
export function parseCount(text: string | null | undefined): number | null {
  if (!text) return null;
  const digits = text.replace(/[^\d]/g, '');
  return digits ? Number(digits) : null;
}

/** Simple 0-100 SEO health score from on-page signals. */
export function calculateSeoScore(input: {
  tagCount: number;
  titleLength: number;
  descriptionLength: number;
  views: number;
}): number {
  let score = 20;
  if (input.tagCount >= 5) score += 25;
  else if (input.tagCount > 0) score += 15;
  if (input.titleLength >= 30 && input.titleLength <= 70) score += 25;
  if (input.descriptionLength > 200) score += 20;
  if (input.views > 1000) score += 10;
  return Math.min(score, 100);
}

/**
 * Revenue per 1,000 views in USD. Long-form uses the global $1.20-$4.50 average;
 * Shorts pay far less per view, so they get their own range.
 */
export const RPM_RANGES = {
  long: { min: 1.2, max: 4.5 },
  short: { min: 0.03, max: 0.1 },
} as const;

export function estimateRevenue(views: number, isShort: boolean): { min: number; max: number } {
  const rpm = isShort ? RPM_RANGES.short : RPM_RANGES.long;
  const round = (n: number) => Math.round(n * 100) / 100;
  return { min: round((views / 1000) * rpm.min), max: round((views / 1000) * rpm.max) };
}

/** Hours since `publishedAt`, or null when the date can't be parsed. */
export function getVideoAgeHours(publishedAt: string, now = Date.now()): number | null {
  const published = new Date(publishedAt).getTime();
  if (Number.isNaN(published)) return null;
  return Math.max((now - published) / 3_600_000, 0);
}

/** $25.00 under $1,000, whole dollars above. */
export function formatUsd(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: amount < 1000 ? 2 : 0,
    maximumFractionDigits: amount < 1000 ? 2 : 0,
  }).format(amount);
}

/** Turkish puts the percent sign first: "%3.92" vs "3.92%". */
export function formatPercent(value: number, lang: Lang): string {
  return lang === 'tr' ? `%${value}` : `${value}%`;
}

export function formatDate(iso: string, lang: Lang): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso || '—';
  return date.toLocaleDateString(LOCALE[lang], { day: 'numeric', month: 'long', year: 'numeric' });
}

function videoFacts(video: VideoAnalytics, lang: Lang): string[] {
  const unknown = lang === 'tr' ? 'bilinmiyor' : 'unknown';
  if (lang === 'en') {
    return [
      `Title: ${video.title}`,
      `Channel: ${video.channelTitle}`,
      `URL: https://www.youtube.com/watch?v=${video.videoId}`,
      `Format: ${video.isShort ? 'Shorts' : 'Regular video'}`,
      `Published: ${video.publishedAt || unknown}`,
      `Views: ${video.viewCount}`,
      `Likes: ${video.likeCount ?? unknown}`,
      `Comments: ${video.commentCount ?? unknown}`,
      `Engagement rate: ${video.engagementRate != null ? formatPercent(video.engagementRate, lang) : unknown}`,
      `Tags (${video.tags.length}): ${video.tags.join(', ') || 'none'}`,
      `Description length: ${video.descriptionLength} characters`,
      `SEO health score: ${video.seoScore}/100`,
      `Age: ${video.daysOld} days · Average views per hour: ${video.viewsPerHour}`,
    ];
  }
  return [
    `Başlık: ${video.title}`,
    `Kanal: ${video.channelTitle}`,
    `URL: https://www.youtube.com/watch?v=${video.videoId}`,
    `Format: ${video.isShort ? 'Shorts' : 'Normal video'}`,
    `Yayın tarihi: ${video.publishedAt || unknown}`,
    `Görüntülenme: ${video.viewCount}`,
    `Beğeni: ${video.likeCount ?? unknown}`,
    `Yorum: ${video.commentCount ?? unknown}`,
    `Etkileşim oranı: ${video.engagementRate != null ? formatPercent(video.engagementRate, lang) : unknown}`,
    `Etiketler (${video.tags.length}): ${video.tags.join(', ') || 'yok'}`,
    `Açıklama uzunluğu: ${video.descriptionLength} karakter`,
    `SEO sağlık skoru: ${video.seoScore}/100`,
    `Video yaşı: ${video.daysOld} gün · Saatlik ortalama izlenme: ${video.viewsPerHour}`,
  ];
}

export function buildAiPrompt(video: VideoAnalytics, lang: Lang): string {
  const lines =
    lang === 'en'
      ? [
          'You are an experienced YouTube SEO expert. Analyze the video below.',
          '',
          ...videoFacts(video, lang),
          '',
          'Please:',
          '1. Rate the title\'s SEO strength out of 10 and suggest 5 alternative titles.',
          '2. Review the current tags; point out missing and unnecessary ones.',
          '3. Suggest 20 new tags (most to least relevant).',
          '4. Interpret the engagement rate and give concrete ways to raise it.',
          '5. Give content and thumbnail ideas for a similar video.',
        ]
      : [
          'Sen deneyimli bir YouTube SEO uzmanısın. Aşağıdaki videoyu analiz et.',
          '',
          ...videoFacts(video, lang),
          '',
          'Lütfen şunları yap:',
          '1. Başlığın SEO gücünü 10 üzerinden puanla ve 5 alternatif başlık öner.',
          '2. Mevcut etiketleri değerlendir; eksik ve gereksiz etiketleri belirt.',
          '3. 20 yeni etiket öner (en alakalıdan en az alakalıya).',
          '4. Etkileşim oranını yorumla ve artırmak için somut öneriler ver.',
          '5. Benzer bir video için içerik ve thumbnail fikirleri ver.',
        ];
  return lines.join('\n');
}

export function buildTranscriptPrompt(video: VideoAnalytics, transcript: string, lang: Lang): string {
  const lines =
    lang === 'en'
      ? [
          'You are an experienced YouTube content strategist. Below are the details and the transcript of a video.',
          '',
          ...videoFacts(video, lang),
          '',
          'Please:',
          '1. Summarize the video in 5 bullet points.',
          '2. Write YouTube chapters (00:00 format) based on the timestamps.',
          '3. Write an SEO-optimized description (first 2 lines should hook the viewer).',
          '4. List the 3 most quotable moments for Shorts clips, with timestamps.',
          '',
          'Transcript:',
          transcript,
        ]
      : [
          'Sen deneyimli bir YouTube içerik stratejistisin. Aşağıda bir videonun bilgileri ve transkripti var.',
          '',
          ...videoFacts(video, lang),
          '',
          'Lütfen şunları yap:',
          '1. Videoyu 5 maddede özetle.',
          '2. Zaman damgalarına göre YouTube bölümleri (00:00 formatında) yaz.',
          '3. SEO uyumlu bir açıklama yaz (ilk 2 satır izleyiciyi yakalamalı).',
          '4. Shorts klibi olabilecek en çarpıcı 3 anı zaman damgalarıyla listele.',
          '',
          'Transkript:',
          transcript,
        ];
  return lines.join('\n');
}
