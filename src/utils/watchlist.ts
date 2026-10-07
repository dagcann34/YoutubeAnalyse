export interface Snapshot {
  /** epoch ms */
  t: number;
  views: number;
}

export interface WatchItem {
  videoId: string;
  title: string;
  channelTitle: string;
  isShort: boolean;
  addedAt: number;
  snapshots: Snapshot[];
}

export type Watchlist = Record<string, WatchItem>;

const KEY = 'watchlist';
export const MAX_WATCH_ITEMS = 50;
const MAX_SNAPSHOTS = 200;
/** Snapshots closer together than this replace each other instead of piling up. */
const MIN_SNAPSHOT_GAP_MS = 30 * 60 * 1000;

export async function getWatchlist(): Promise<Watchlist> {
  const stored = await chrome.storage.local.get(KEY);
  return (stored[KEY] as Watchlist | undefined) ?? {};
}

async function save(list: Watchlist): Promise<void> {
  await chrome.storage.local.set({ [KEY]: list });
}

/** Returns false when the list is full. */
export async function addToWatchlist(
  item: Omit<WatchItem, 'addedAt' | 'snapshots'>,
  views: number,
): Promise<boolean> {
  const list = await getWatchlist();
  if (list[item.videoId]) return true;
  if (Object.keys(list).length >= MAX_WATCH_ITEMS) return false;
  const now = Date.now();
  list[item.videoId] = { ...item, addedAt: now, snapshots: [{ t: now, views }] };
  await save(list);
  return true;
}

export async function removeFromWatchlist(videoId: string): Promise<void> {
  const list = await getWatchlist();
  delete list[videoId];
  await save(list);
}

/** Appends a view count for a tracked video. No-op for videos that aren't tracked. */
export async function recordSnapshot(videoId: string, views: number, now = Date.now()): Promise<void> {
  if (!views) return;
  const list = await getWatchlist();
  const item = list[videoId];
  if (!item) return;

  const last = item.snapshots[item.snapshots.length - 1];
  if (last && now - last.t < MIN_SNAPSHOT_GAP_MS) {
    if (last.views === views) return;
    item.snapshots[item.snapshots.length - 1] = { t: now, views };
  } else {
    item.snapshots.push({ t: now, views });
  }
  if (item.snapshots.length > MAX_SNAPSHOTS) item.snapshots.splice(1, item.snapshots.length - MAX_SNAPSHOTS);
  await save(list);
}

export function onWatchlistChanged(listener: (list: Watchlist) => void): () => void {
  const handler = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
    if (area === 'local' && changes[KEY]) listener((changes[KEY].newValue as Watchlist | undefined) ?? {});
  };
  chrome.storage.onChanged.addListener(handler);
  return () => chrome.storage.onChanged.removeListener(handler);
}

/**
 * Views gained per day over roughly the last `windowDays`, from real snapshots.
 * null until there are two snapshots at least an hour apart.
 */
export function viewsPerDay(snapshots: Snapshot[], windowDays = 3): number | null {
  if (snapshots.length < 2) return null;
  const last = snapshots[snapshots.length - 1];
  const cutoff = last.t - windowDays * 86_400_000;
  const first = snapshots.find((s) => s.t >= cutoff && last.t - s.t >= 3_600_000) ?? snapshots[0];
  const days = (last.t - first.t) / 86_400_000;
  if (days < 1 / 24) return null;
  return Math.max(0, Math.round((last.views - first.views) / days));
}

export function watchlistToCsv(list: Watchlist): string {
  const escape = (value: string | number) => {
    const text = String(value);
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  const rows: Array<Array<string | number>> = [['video_id', 'title', 'channel', 'url', 'timestamp', 'views']];
  for (const item of Object.values(list)) {
    for (const snap of item.snapshots) {
      rows.push([
        item.videoId,
        item.title,
        item.channelTitle,
        `https://www.youtube.com/watch?v=${item.videoId}`,
        new Date(snap.t).toISOString(),
        snap.views,
      ]);
    }
  }
  return rows.map((row) => row.map(escape).join(',')).join('\n');
}
