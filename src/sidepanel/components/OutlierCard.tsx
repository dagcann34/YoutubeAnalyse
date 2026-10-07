import { useEffect, useState } from 'react';
import { Rocket } from 'lucide-react';
import type { ChannelStats, ChannelStatsResponse, GetChannelStatsMessage, VideoAnalytics } from '../../types/youtube';
import type { TKey } from '../../i18n';
import { formatNumber } from '../../utils/youtube';
import { useI18n } from '../i18n';

function tier(ratio: number): { label: TKey; color: string } {
  if (ratio >= 10) return { label: 'tierViral', color: 'text-rose-400' };
  if (ratio >= 3) return { label: 'tierOutlier', color: 'text-orange-400' };
  if (ratio >= 1.5) return { label: 'tierGood', color: 'text-emerald-400' };
  if (ratio >= 0.5) return { label: 'tierNormal', color: 'text-cyan-400' };
  return { label: 'tierLow', color: 'text-slate-400' };
}

/** How this video performs against the median of the channel's recent uploads. */
export default function OutlierCard({ data, tabId }: { data: VideoAnalytics; tabId: number | null }) {
  const { t } = useI18n();
  const [stats, setStats] = useState<ChannelStats | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setStats(null);
    setFailed(false);
    if (tabId == null) return;

    const message: GetChannelStatsMessage = { type: 'GET_CHANNEL_STATS' };
    chrome.tabs
      .sendMessage(tabId, message)
      .then((response: ChannelStatsResponse | undefined) => {
        if (cancelled) return;
        if (response?.ok && response.stats.medianViews > 0) setStats(response.stats);
        else setFailed(true);
      })
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, [data.videoId, tabId]);

  const ratio = stats ? data.viewCount / stats.medianViews : null;
  const level = ratio != null ? tier(ratio) : null;

  return (
    <div className="space-y-1.5 rounded-2xl border border-orange-500/25 bg-gradient-to-r from-orange-950/30 via-slate-900/80 to-slate-900/60 p-3.5 backdrop-blur-xl">
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-xs font-bold text-orange-400">
          <Rocket className="h-4 w-4" /> {t('outlierTitle')}
        </span>
        {ratio != null && level && (
          <span className={`text-base font-black ${level.color}`}>
            {ratio >= 10 ? Math.round(ratio) : ratio.toFixed(1)}x
          </span>
        )}
      </div>
      {ratio == null ? (
        <p className="text-[10px] text-slate-400">{failed ? t('outlierUnavailable') : t('outlierLoading')}</p>
      ) : (
        <>
          <p className={`text-[11px] font-semibold ${level!.color}`}>{t(level!.label)}</p>
          <p className="text-[10px] text-slate-400">
            {t('outlierDetail', { n: stats!.sampleSize, median: formatNumber(stats!.medianViews) })}
          </p>
          {data.daysOld < 7 && <p className="text-[10px] text-slate-500">{t('outlierNew', { days: data.daysOld })}</p>}
        </>
      )}
    </div>
  );
}
