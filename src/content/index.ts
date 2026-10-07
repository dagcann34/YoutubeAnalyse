import type {
  ChannelStatsResponse,
  RuntimeMessage,
  TranscriptResponse,
  TranscriptSegment,
  VideoAnalytics,
  VideoDataResponse,
  VideoDataUpdatedMessage,
} from '../types/youtube';
import { recordSnapshot } from '../utils/watchlist';
import { median, pageLang, parseCompactCount, parseMetadataParts, type PageLang } from '../utils/ytText';
import {
  calculateEngagement,
  calculateSeoScore,
  estimateRevenue,
  getVideoAgeHours,
  getVideoIdFromUrl,
  parseCount,
} from '../utils/youtube';
import { startBadges } from './badges';

interface PlayerResponse {
  videoDetails?: {
    videoId?: string;
    title?: string;
    author?: string;
    channelId?: string;
    viewCount?: string;
    keywords?: string[];
    shortDescription?: string;
  };
  microformat?: {
    playerMicroformatRenderer?: {
      publishDate?: string;
      uploadDate?: string;
      ownerChannelName?: string;
      externalChannelId?: string;
      viewCount?: string;
      likeCount?: string;
    };
  };
}

interface PageSource {
  player: PlayerResponse;
  /** Raw text that contains ytInitialData, searched for like counts. */
  rawText: string;
}

let cache: VideoAnalytics | null = null;

/**
 * Finds `<name> = {` in a script/HTML string and returns the parsed object.
 * Walks the braces manually so trailing JS after the object doesn't break JSON.parse.
 */
function extractJsonObject<T>(source: string, name: string): T | null {
  const match = new RegExp(`${name}\\s*=\\s*\\{`).exec(source);
  if (!match) return null;

  const start = match.index + match[0].length - 1;
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < source.length; i++) {
    const ch = source[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) {
        try {
          return JSON.parse(source.slice(start, i + 1)) as T;
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}

/**
 * The inline <script> tags only describe the video the tab was first loaded with.
 * After in-app navigation they're stale, so fall back to fetching the watch page.
 */
async function loadPageSource(videoId: string): Promise<PageSource> {
  const inlineText = Array.from(document.scripts)
    .map((script) => script.textContent ?? '')
    .filter((text) => text.includes('ytInitialPlayerResponse') || text.includes('ytInitialData'))
    .join('\n');

  const inlinePlayer = extractJsonObject<PlayerResponse>(inlineText, 'ytInitialPlayerResponse');
  if (inlinePlayer?.videoDetails?.videoId === videoId) {
    return { player: inlinePlayer, rawText: inlineText };
  }

  const response = await fetch(`https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`, {
    credentials: 'include',
  });
  if (!response.ok) throw new Error('ERR_FETCH');

  const html = await response.text();
  const player = extractJsonObject<PlayerResponse>(html, 'ytInitialPlayerResponse');
  if (!player?.videoDetails) throw new Error('ERR_NO_DATA');
  return { player, rawText: html };
}

function findLikeCount(source: PageSource): number | null {
  const fromMicroformat = Number(source.player.microformat?.playerMicroformatRenderer?.likeCount);
  if (Number.isFinite(fromMicroformat) && fromMicroformat > 0) return fromMicroformat;

  const patterns = [/"likeCountIfIndifferentNumber":"(\d+)"/, /"likeCount":"(\d+)"/];
  for (const pattern of patterns) {
    const match = pattern.exec(source.rawText);
    if (match) return Number(match[1]);
  }

  // Last resort: the like button's accessible label, e.g. "... 12.345 kişiyle birlikte ..."
  const likeButton = document.querySelector<HTMLElement>(
    'like-button-view-model button, #segmented-like-button button',
  );
  return parseCount(likeButton?.getAttribute('aria-label'));
}

/** Comments are lazy-loaded, so this is only available after the user scrolls to them. */
function findCommentCount(): number | null {
  const header = document.querySelector<HTMLElement>(
    'ytd-comments-header-renderer #count .count-text, ytd-comments-header-renderer #count',
  );
  return parseCount(header?.textContent);
}

async function collectVideoData(): Promise<VideoAnalytics> {
  const videoId = getVideoIdFromUrl(location.href);
  if (!videoId) throw new Error('ERR_NO_VIDEO');

  if (cache?.videoId === videoId) {
    // Comment count may have loaded since the last request.
    const commentCount = findCommentCount() ?? cache.commentCount;
    cache = { ...cache, commentCount, engagementRate: engagementFor(cache.viewCount, cache.likeCount, commentCount) };
    return cache;
  }

  const source = await loadPageSource(videoId);
  const details = source.player.videoDetails ?? {};
  const micro = source.player.microformat?.playerMicroformatRenderer ?? {};

  const viewCount = Number(details.viewCount ?? micro.viewCount ?? 0) || 0;
  const title = details.title ?? document.title.replace(/ - YouTube$/, '');
  const tags = details.keywords ?? [];
  const descriptionLength = (details.shortDescription ?? '').length;
  const publishedAt = micro.publishDate ?? micro.uploadDate ?? '';
  const isShort = location.pathname.startsWith('/shorts/');
  const ageHours = getVideoAgeHours(publishedAt);
  const likeCount = findLikeCount(source);
  const commentCount = findCommentCount();

  cache = {
    videoId,
    title,
    channelTitle: details.author ?? micro.ownerChannelName ?? '',
    channelId: details.channelId ?? micro.externalChannelId ?? '',
    viewCount,
    likeCount,
    commentCount,
    publishedAt,
    tags,
    engagementRate: engagementFor(viewCount, likeCount, commentCount),
    isShort,
    seoScore: calculateSeoScore({
      tagCount: tags.length,
      titleLength: title.length,
      descriptionLength,
      views: viewCount,
    }),
    descriptionLength,
    // Under an hour old counts as one hour so a brand-new video doesn't divide by ~0.
    viewsPerHour: ageHours == null ? 0 : Math.round(viewCount / Math.max(ageHours, 1)),
    estimatedRevenue: estimateRevenue(viewCount, isShort),
    daysOld: ageHours == null ? 0 : Math.floor(ageHours / 24),
  };
  void recordSnapshot(videoId, viewCount).catch(() => {});
  return cache;
}

function engagementFor(views: number, likes: number | null, comments: number | null): number | null {
  if (likes == null && comments == null) return null;
  return calculateEngagement(views, likes ?? 0, comments ?? 0);
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function readTranscriptSegments(): TranscriptSegment[] {
  const read = (rows: NodeListOf<Element>, timeSel: string, textSel: string) =>
    Array.from(rows, (row) => ({
      time: row.querySelector(timeSel)?.textContent?.trim() ?? '',
      text: (row.querySelector(textSel)?.textContent ?? '').replace(/\s+/g, ' ').trim(),
    })).filter((segment) => segment.text);

  // Current layout first, then the older one.
  const modern = read(
    document.querySelectorAll('transcript-segment-view-model'),
    '.ytwTranscriptSegmentViewModelTimestamp',
    '.ytAttributedStringHost',
  );
  if (modern.length) return modern;
  return read(document.querySelectorAll('ytd-transcript-segment-renderer'), '.segment-timestamp', '.segment-text');
}

/**
 * YouTube rejects direct caption/transcript API calls without its own tokens, so open the
 * page's "Show transcript" panel and read the rendered segments instead.
 */
async function getTranscript(): Promise<TranscriptSegment[]> {
  if (!getVideoIdFromUrl(location.href)) throw new Error('ERR_NO_VIDEO');

  const button = document.querySelector<HTMLElement>('ytd-video-description-transcript-section-renderer button');
  if (button) button.click();
  else if (!readTranscriptSegments().length) throw new Error('ERR_NO_TRANSCRIPT');

  // Wait until the segment count stops changing (long videos render in chunks).
  let segments: TranscriptSegment[] = [];
  let stableRounds = 0;
  for (let i = 0; i < 60 && stableRounds < 3; i++) {
    await sleep(250);
    const next = readTranscriptSegments();
    stableRounds = next.length > 0 && next.length === segments.length ? stableRounds + 1 : 0;
    segments = next;
  }
  if (!segments.length) throw new Error('ERR_NO_TRANSCRIPT');
  return segments;
}

interface Upload {
  videoId: string;
  views: number;
}

function collectUploads(node: any, lang: PageLang, out: Map<string, number>): void {
  if (!node || typeof node !== 'object') return;
  if (Array.isArray(node)) {
    for (const child of node) collectUploads(child, lang, out);
    return;
  }

  const lockup = node.lockupViewModel;
  if (lockup?.contentType === 'LOCKUP_CONTENT_TYPE_VIDEO' && lockup.contentId) {
    const rows: any[] = lockup.metadata?.lockupMetadataViewModel?.metadata?.contentMetadataViewModel?.metadataRows ?? [];
    for (const row of rows) {
      const parts: string[] = (row.metadataParts ?? []).map((part: any) => part.text?.content ?? '');
      const parsed = parseMetadataParts(parts, lang);
      if (parsed) out.set(lockup.contentId, parsed.views);
    }
  }

  const renderer = node.videoRenderer;
  if (renderer?.videoId) {
    const parsed = parseMetadataParts(
      [renderer.viewCountText?.simpleText ?? '', renderer.publishedTimeText?.simpleText ?? ''],
      lang,
    );
    if (parsed) out.set(renderer.videoId, parsed.views);
  }

  const short = node.shortsLockupViewModel;
  const shortId = short?.onTap?.innertubeCommand?.reelWatchEndpoint?.videoId;
  if (shortId) {
    const views = parseCompactCount(short.overlayMetadata?.secondaryText?.content ?? '', lang);
    if (views != null) out.set(shortId, views);
  }

  for (const value of Object.values(node)) collectUploads(value, lang, out);
}

const channelCache = new Map<string, Upload[]>();

/** Recent uploads of the same format (videos or Shorts) from the channel's tab, newest first. */
async function getChannelUploads(channelId: string, isShort: boolean, lang: PageLang): Promise<Upload[]> {
  const key = `${channelId}:${isShort ? 'shorts' : 'videos'}`;
  const cached = channelCache.get(key);
  if (cached) return cached;

  const response = await fetch(`https://www.youtube.com/channel/${encodeURIComponent(channelId)}/${isShort ? 'shorts' : 'videos'}`, {
    credentials: 'include',
  });
  if (!response.ok) throw new Error('ERR_FETCH');
  const data = extractJsonObject<unknown>(await response.text(), 'ytInitialData');
  if (!data) throw new Error('ERR_NO_DATA');

  const found = new Map<string, number>();
  collectUploads(data, lang, found);
  const uploads = Array.from(found, ([videoId, views]) => ({ videoId, views }));
  channelCache.set(key, uploads);
  return uploads;
}

async function getChannelStats(): Promise<{ medianViews: number; sampleSize: number }> {
  const video = await collectVideoData();
  const lang = pageLang();
  if (!lang || !video.channelId) throw new Error('ERR_NO_DATA');

  const others = (await getChannelUploads(video.channelId, video.isShort, lang))
    .filter((upload) => upload.videoId !== video.videoId)
    .slice(0, 30);
  if (others.length < 3) throw new Error('ERR_NO_DATA');
  return { medianViews: median(others.map((upload) => upload.views)), sampleSize: others.length };
}

const errorCode = (error: unknown) => (error instanceof Error ? error.message : 'ERR_UNKNOWN');

chrome.runtime.onMessage.addListener((message: RuntimeMessage, _sender, sendResponse) => {
  if (message.type === 'URL_CHANGED') {
    if (cache && cache.videoId !== getVideoIdFromUrl(message.url)) cache = null;
    return false;
  }

  if (message.type === 'GET_VIDEO_DATA') {
    collectVideoData()
      .then((data) => sendResponse({ ok: true, data } satisfies VideoDataResponse))
      .catch((error: unknown) =>
        sendResponse({
          ok: false,
          error: errorCode(error),
        } satisfies VideoDataResponse),
      );
    return true; // keep the channel open for the async response
  }

  if (message.type === 'GET_TRANSCRIPT') {
    getTranscript()
      .then((segments) => sendResponse({ ok: true, segments } satisfies TranscriptResponse))
      .catch((error: unknown) => sendResponse({ ok: false, error: errorCode(error) } satisfies TranscriptResponse));
    return true;
  }

  if (message.type === 'GET_CHANNEL_STATS') {
    getChannelStats()
      .then((stats) => sendResponse({ ok: true, stats } satisfies ChannelStatsResponse))
      .catch((error: unknown) => sendResponse({ ok: false, error: errorCode(error) } satisfies ChannelStatsResponse));
    return true;
  }

  return false;
});

/** Sends the current video's data (or null off a video page) to the side panel. */
async function broadcastVideoData(): Promise<void> {
  const videoId = getVideoIdFromUrl(location.href);
  let payload: VideoAnalytics | null = null;

  if (videoId) {
    try {
      payload = await collectVideoData();
    } catch (error) {
      console.warn('[DagcanYT] Could not read video data', error);
      return;
    }
    // The user may have moved on while we were fetching.
    if (payload.videoId !== getVideoIdFromUrl(location.href)) return;
  }

  const message: VideoDataUpdatedMessage = { type: 'VIDEO_DATA_UPDATED', payload };
  chrome.runtime.sendMessage(message).catch(() => {
    // Side panel isn't open - nothing is listening.
  });
}

// YouTube fires this after every in-app navigation (including Shorts swipes).
window.addEventListener('yt-navigate-finish', () => {
  if (cache && cache.videoId !== getVideoIdFromUrl(location.href)) cache = null;
  void broadcastVideoData();
startBadges();
});

void broadcastVideoData();
startBadges();
