import { DollarSign } from 'lucide-react';
import type { VideoAnalytics } from '../../types/youtube';
import { RPM_RANGES, formatUsd } from '../../utils/youtube';
import { useI18n } from '../i18n';

export default function RevenueCard({ data }: { data: VideoAnalytics }) {
  const { t } = useI18n();
  const rpm = data.isShort ? RPM_RANGES.short : RPM_RANGES.long;

  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-emerald-500/30 bg-gradient-to-r from-emerald-950/40 via-slate-900/80 to-slate-900/60 p-3.5 backdrop-blur-xl">
      <div className="space-y-1">
        <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-400">
          <DollarSign className="h-4 w-4 text-emerald-400" /> {t('revenueTitle')}
        </div>
        <p className="text-[10px] leading-relaxed text-slate-400">
          {t(data.isShort ? 'revenueHintShorts' : 'revenueHintLong', { min: rpm.min, max: rpm.max })}
        </p>
      </div>
      <div className="shrink-0 text-right">
        <p className="text-base font-black text-emerald-400">
          {formatUsd(data.estimatedRevenue.min)} - {formatUsd(data.estimatedRevenue.max)}
        </p>
        <span className="font-mono text-[9px] text-slate-500">{t('revenueUnit')}</span>
      </div>
    </div>
  );
}
