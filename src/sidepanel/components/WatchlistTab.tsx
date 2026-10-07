import { useState } from 'react';
import { Bookmark, Download, Loader2, RefreshCw, X } from 'lucide-react';
import type { RefreshWatchlistMessage } from '../../types/youtube';
import { LOCALE, type Lang } from '../../i18n';
import { formatNumber } from '../../utils/youtube';
import { MAX_WATCH_ITEMS, removeFromWatchlist, viewsPerDay, watchlistToCsv, type Watchlist } from '../../utils/watchlist';
import { useI18n } from '../i18n';
import Sparkline from './Sparkline';

function timeAgo(t: number, lang: Lang): string {
  const rtf = new Intl.RelativeTimeFormat(LOCALE[lang], { numeric: 'auto' });
  const minutes = Math.round((t - Date.now()) / 60_000);
  if (Math.abs(minutes) < 60) return rtf.format(minutes, 'minute');
  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 48) return rtf.format(hours, 'hour');
  return rtf.format(Math.round(hours / 24), 'day');
}

export default function WatchlistTab({ list, activeVideoId }: { list: Watchlist; activeVideoId: string | null }) {
  const { t, lang } = useI18n();
  const [refreshing, setRefreshing] = useState(false);
  const items = Object.values(list).sort((a, b) => b.addedAt - a.addedAt);

  const refresh = async () => {
    setRefreshing(true);
    try {
      const message: RefreshWatchlistMessage = { type: 'REFRESH_WATCHLIST' };
      await chrome.runtime.sendMessage(message);
    } finally {
      setRefreshing(false);
    }
  };

  const exportCsv = () => {
    const url = URL.createObjectURL(new Blob([`﻿${watchlistToCsv(list)}`], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `dagcanyt-tracking-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <div className="space-y-3 rounded-2xl border border-slate-800/80 bg-slate-900/60 p-3.5 backdrop-blur-xl">
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 font-bold text-slate-200">
          <Bookmark className="h-4 w-4 text-rose-500" /> {t('watchTitle')}
          <span className="font-mono text-[10px] font-normal text-slate-500">
            {items.length}/{MAX_WATCH_ITEMS}
          </span>
        </span>
        {items.length > 0 && (
          <div className="flex gap-1">
            <button
              type="button"
              onClick={exportCsv}
              className="flex items-center gap-1 rounded-lg border border-slate-800 px-2 py-1 text-[10px] text-slate-300 hover:text-white"
            >
              <Download className="h-3 w-3" /> {t('watchCsv')}
            </button>
            <button
              type="button"
              onClick={() => void refresh()}
              disabled={refreshing}
              className="flex items-center gap-1 rounded-lg border border-slate-800 px-2 py-1 text-[10px] text-slate-300 hover:text-white disabled:opacity-60"
            >
              {refreshing ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
              {refreshing ? t('watchRefreshing') : t('watchRefresh')}
            </button>
          </div>
        )}
      </div>

      {items.length === 0 ? (
        <p className="rounded-xl border border-slate-800/50 bg-slate-950/50 p-4 text-center text-[11px] leading-relaxed text-slate-400">
          {t('watchEmpty')}
        </p>
      ) : (
        <ul className="space-y-2">
          {items.map((item) => {
            const last = item.snapshots[item.snapshots.length - 1];
            const perDay = viewsPerDay(item.snapshots);
            return (
              <li
                key={item.videoId}
                className={`group flex items-center gap-2 rounded-xl border p-2 ${
                  item.videoId === activeVideoId ? 'border-rose-500/40 bg-rose-500/5' : 'border-slate-800 bg-slate-950/50'
                }`}
              >
                <button
                  type="button"
                  onClick={() => void chrome.tabs.create({ url: `https://www.youtube.com/watch?v=${item.videoId}` })}
                  className="min-w-0 flex-1 text-left"
                >
                  <p className="line-clamp-2 text-[11px] font-semibold leading-snug text-slate-200 group-hover:text-white">
                    {item.title}
                  </p>
                  <p className="mt-0.5 text-[10px] text-slate-500">
                    {formatNumber(last?.views ?? 0)} {t('viewsUnit')}
                    {perDay != null && (
                      <span className="ml-1.5 font-semibold text-emerald-400">
                        {t('watchPerDay', { n: formatNumber(perDay) })}
                      </span>
                    )}
                  </p>
                  {last && <p className="text-[9px] text-slate-600">{t('watchUpdated', { when: timeAgo(last.t, lang) })}</p>}
                </button>
                <Sparkline snapshots={item.snapshots} width={64} height={28} />
                <button
                  type="button"
                  onClick={() => void removeFromWatchlist(item.videoId)}
                  title={t('watchRemove')}
                  className="rounded-md p-1 text-slate-600 transition hover:bg-slate-800 hover:text-rose-400"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
