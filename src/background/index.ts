import type { RuntimeMessage, UrlChangedMessage } from '../types/youtube';
import { getWatchlist, recordSnapshot } from '../utils/watchlist';

const REFRESH_ALARM = 'watchlist-refresh';
const REFRESH_EVERY_MINUTES = 180;

// Clicking the toolbar icon opens the side panel.
chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((error) => console.error('[DagcanYT] setPanelBehavior failed', error));

// YouTube is a single-page app, so moving between videos doesn't reload the page.
// Tell the content script the URL changed so it can drop stale data.
chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  const url = changeInfo.url;
  if (!url || !url.startsWith('https://www.youtube.com/')) return;

  const message: UrlChangedMessage = { type: 'URL_CHANGED', url };
  chrome.tabs.sendMessage(tabId, message).catch(() => {
    // Content script not injected yet (e.g. tab opened before install) - ignore.
  });
});

/** Reads the current view count from a video's watch page. */
async function fetchViewCount(videoId: string): Promise<number | null> {
  const response = await fetch(`https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`, {
    credentials: 'include',
  });
  if (!response.ok) return null;
  const html = await response.text();
  const match = /"videoDetails":\{"videoId":"[\w-]+".*?"viewCount":"(\d+)"/.exec(html);
  return match ? Number(match[1]) : null;
}

let refreshing: Promise<void> | null = null;

/** Records a fresh view count for every tracked video, one at a time to stay polite. */
function refreshWatchlist(): Promise<void> {
  refreshing ??= (async () => {
    try {
      for (const videoId of Object.keys(await getWatchlist())) {
        try {
          const views = await fetchViewCount(videoId);
          if (views != null) await recordSnapshot(videoId, views);
        } catch (error) {
          console.warn('[DagcanYT] Could not refresh', videoId, error);
        }
        await new Promise((resolve) => setTimeout(resolve, 1500));
      }
    } finally {
      refreshing = null;
    }
  })();
  return refreshing;
}

// Alarms can be lost when the browser restarts, so make sure one exists every time the worker starts.
void chrome.alarms.get(REFRESH_ALARM).then((alarm) => {
  if (!alarm) void chrome.alarms.create(REFRESH_ALARM, { periodInMinutes: REFRESH_EVERY_MINUTES, delayInMinutes: 1 });
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === REFRESH_ALARM) void refreshWatchlist();
});

chrome.runtime.onMessage.addListener((message: RuntimeMessage, _sender, sendResponse) => {
  if (message.type !== 'REFRESH_WATCHLIST') return false;
  refreshWatchlist().then(() => sendResponse({ ok: true }));
  return true;
});
