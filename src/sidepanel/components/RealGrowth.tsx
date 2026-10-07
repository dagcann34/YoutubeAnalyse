import { Activity } from 'lucide-react';
import { formatNumber } from '../../utils/youtube';
import { viewsPerDay, type WatchItem } from '../../utils/watchlist';
import { LOCALE } from '../../i18n';
import { useI18n } from '../i18n';
import Sparkline from './Sparkline';

/** Growth from the view counts the extension actually recorded for a tracked video. */
export default function RealGrowth({ item }: { item: WatchItem | undefined }) {
  const { t, lang } = useI18n();
  const snapshots = item?.snapshots ?? [];
  const perDay = viewsPerDay(snapshots);

  return (
    <div className="space-y-2 rounded-2xl border border-slate-800/80 bg-slate-900/60 p-3.5 backdrop-blur-xl">
      <span className="flex items-center gap-1.5 font-bold text-slate-200">
        <Activity className="h-4 w-4 text-emerald-400" /> {t('realTitle')}
      </span>
      {!item ? (
        <p className="text-[11px] leading-relaxed text-slate-400">{t('realNone')}</p>
      ) : snapshots.length < 2 ? (
        <p className="text-[11px] leading-relaxed text-slate-400">{t('realFew')}</p>
      ) : (
        <>
          <div className="rounded-xl border border-slate-800/80 bg-slate-950/80 p-2">
            <Sparkline snapshots={snapshots} width={280} height={60} fluid />
          </div>
          {perDay != null && (
            <p className="text-[11px] text-slate-300">{t('realGain', { n: formatNumber(perDay) })}</p>
          )}
          <p className="text-[10px] text-slate-500">
            {t('realSpan', {
              count: snapshots.length,
              since: new Date(snapshots[0].t).toLocaleDateString(LOCALE[lang]),
            })}
          </p>
        </>
      )}
    </div>
  );
}
