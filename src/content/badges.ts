import { getSettings, onSettingsChanged } from '../utils/settings';
import { formatNumber } from '../utils/youtube';
import { median, pageLang, parseMetadataParts, type PageLang } from '../utils/ytText';

/**
 * Draws a small badge on video thumbnails across YouTube (home, search, related, channel pages):
 * average views per day since upload, plus the outlier ratio against the other videos on a channel's
 * Videos tab. Everything is read from the card's own text - no extra requests.
 */

const CARD_SELECTOR =
  'ytd-video-renderer, ytd-grid-video-renderer, ytd-compact-video-renderer, ytd-rich-grid-media, yt-lockup-view-model';
const ROW_SELECTOR =
  '#metadata-line, .ytContentMetadataViewModelMetadataRow, .yt-content-metadata-view-model-wiz__metadata-row';
const PART_SELECTOR =
  'span.inline-metadata-item, .ytContentMetadataViewModelMetadataText, .yt-content-metadata-view-model-wiz__metadata-text';
const THUMB_SELECTOR = 'yt-thumbnail-view-model, ytd-thumbnail';
const BADGE_CLASS = 'dagcanyt-badge';
const CHANNEL_PATH = /^\/(@[^/]+|channel\/[^/]+|c\/[^/]+|user\/[^/]+)\/(videos|shorts|streams)\/?$/;
const PER_DAY: Record<PageLang, string> = { tr: '/gün', en: '/day' };

const STYLE = `
.${BADGE_CLASS} {
  position: absolute; top: 6px; left: 6px; z-index: 5;
  padding: 2px 7px; border-radius: 6px;
  font: 700 11px/1.5 Roboto, Arial, sans-serif; letter-spacing: .2px; color: #fff;
  background: rgba(15, 23, 42, .85); box-shadow: 0 1px 3px rgba(0, 0, 0, .4);
  pointer-events: none; white-space: nowrap;
}
.${BADGE_CLASS}[data-tier="hot"] { background: linear-gradient(90deg, #e11d48, #9333ea); }
.${BADGE_CLASS}[data-tier="warm"] { background: #ea580c; }
.${BADGE_CLASS}[data-tier="mild"] { background: #0e7490; }
`;

type Tier = 'hot' | 'warm' | 'mild' | 'cold';

interface CardInfo {
  card: Element;
  views: number;
  perDay: number;
}

let enabled = false;
let observer: MutationObserver | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;

function readCard(card: Element, lang: PageLang): CardInfo | null {
  for (const row of Array.from(card.querySelectorAll(ROW_SELECTOR))) {
    const parts = Array.from(row.querySelectorAll(PART_SELECTOR), (el) => el.textContent ?? '');
    const parsed = parseMetadataParts(parts, lang);
    // Under a day old counts as one day, so a fresh upload doesn't show an inflated pace.
    if (parsed) return { card, views: parsed.views, perDay: parsed.views / Math.max(parsed.ageDays, 1) };
  }
  return null;
}

function paceTier(perDay: number): Tier {
  if (perDay >= 100_000) return 'hot';
  if (perDay >= 10_000) return 'warm';
  if (perDay >= 1_000) return 'mild';
  return 'cold';
}

function ratioTier(ratio: number): Tier {
  if (ratio >= 3) return 'hot';
  if (ratio >= 1.5) return 'warm';
  if (ratio >= 0.5) return 'mild';
  return 'cold';
}

function setBadge(card: Element, text: string, tier: Tier) {
  const thumb = card.querySelector<HTMLElement>(THUMB_SELECTOR);
  if (!thumb) return;
  let badge = thumb.querySelector<HTMLElement>(`:scope > .${BADGE_CLASS}`);
  if (!badge) {
    if (getComputedStyle(thumb).position === 'static') thumb.style.position = 'relative';
    badge = document.createElement('div');
    badge.className = BADGE_CLASS;
    thumb.appendChild(badge);
  }
  if (badge.textContent !== text) badge.textContent = text;
  if (badge.dataset.tier !== tier) badge.dataset.tier = tier;
}

function removeBadges() {
  document.querySelectorAll(`.${BADGE_CLASS}`).forEach((badge) => badge.remove());
}

function processPage() {
  timer = null;
  const lang = pageLang();
  if (!enabled || !lang) return;

  const cards: CardInfo[] = [];
  for (const card of Array.from(document.querySelectorAll(CARD_SELECTOR))) {
    const info = readCard(card, lang);
    if (info) cards.push(info);
    // YouTube recycles card elements; drop a badge left over from the card's previous video.
    else card.querySelector(`.${BADGE_CLASS}`)?.remove();
  }

  // On a channel's video grid, compare every video against the channel's own median.
  const onChannelGrid = CHANNEL_PATH.test(location.pathname) && cards.length >= 5;
  const channelMedian = onChannelGrid ? median(cards.map((c) => c.views)) : 0;

  for (const { card, views, perDay } of cards) {
    const pace = `~${formatNumber(perDay)}${PER_DAY[lang]}`;
    if (channelMedian > 0) {
      const ratio = views / channelMedian;
      setBadge(card, `${ratio >= 10 ? Math.round(ratio) : ratio.toFixed(1)}x · ${pace}`, ratioTier(ratio));
    } else {
      setBadge(card, pace, paceTier(perDay));
    }
  }
}

function schedule() {
  if (timer == null) timer = setTimeout(processPage, 500);
}

function apply(badges: boolean) {
  enabled = badges;
  if (!enabled) {
    observer?.disconnect();
    observer = null;
    removeBadges();
    return;
  }
  if (!document.getElementById('dagcanyt-badge-style')) {
    const style = document.createElement('style');
    style.id = 'dagcanyt-badge-style';
    style.textContent = STYLE;
    document.head.appendChild(style);
  }
  if (!observer) {
    observer = new MutationObserver(schedule);
    observer.observe(document.body, { childList: true, subtree: true });
  }
  schedule();
}

export function startBadges() {
  void getSettings().then((settings) => apply(settings.badges));
  onSettingsChanged((settings) => {
    if (settings.badges !== enabled) apply(settings.badges);
  });
  window.addEventListener('yt-navigate-finish', schedule);
}
