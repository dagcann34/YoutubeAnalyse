import { useMemo, useState, type PointerEvent } from 'react';
import { TrendingUp } from 'lucide-react';
import type { VideoAnalytics } from '../../types/youtube';
import { formatNumber, getVideoAgeHours } from '../../utils/youtube';
import type { Translate } from '../../i18n';
import { useI18n } from '../i18n';

const WIDTH = 300;
const HEIGHT = 100;
const PAD = { top: 12, right: 8, bottom: 6, left: 8 };
const WINDOW_DAYS = 30;
const SAMPLES = 48;

interface Point {
  day: number; // days since publication
  views: number;
  x: number;
  y: number;
}

function smoothPath(points: Point[]): string {
  if (points.length === 0) return '';
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    const midX = (prev.x + curr.x) / 2;
    d += ` C ${midX} ${prev.y}, ${midX} ${curr.y}, ${curr.x} ${curr.y}`;
  }
  return d;
}

function dayLabel(offset: number, t: Translate): string {
  if (Math.abs(offset) < 0.5) return t('today');
  return t('dayOffset', { n: `${offset > 0 ? '+' : ''}${Math.round(offset)}` });
}

/**
 * YouTube doesn't expose a video's view history, so this plots views at the video's
 * lifetime average pace: the last 30 days (or since publication) and 30 days ahead.
 */
export default function VelocityChart({ data }: { data: VideoAnalytics }) {
  const { t } = useI18n();
  const [hover, setHover] = useState<Point | null>(null);

  const chart = useMemo(() => {
    const ageHours = getVideoAgeHours(data.publishedAt);
    if (ageHours == null || data.viewsPerHour <= 0) return null;

    const ageDays = Math.max(ageHours / 24, 1 / 24);
    const viewsPerDay = data.viewCount / ageDays;
    const startDay = Math.max(0, ageDays - WINDOW_DAYS);
    const endDay = ageDays + WINDOW_DAYS;
    const viewsAt = (day: number) => viewsPerDay * day;

    const minViews = viewsAt(startDay);
    const maxViews = viewsAt(endDay);
    const toX = (day: number) => PAD.left + ((day - startDay) / (endDay - startDay)) * (WIDTH - PAD.left - PAD.right);
    const toY = (views: number) =>
      PAD.top + (1 - (views - minViews) / Math.max(maxViews - minViews, 1)) * (HEIGHT - PAD.top - PAD.bottom);

    const points: Point[] = Array.from({ length: SAMPLES + 1 }, (_, i) => {
      const day = startDay + ((endDay - startDay) * i) / SAMPLES;
      const views = viewsAt(day);
      return { day, views, x: toX(day), y: toY(views) };
    });

    const nowX = toX(ageDays);
    const past = points.filter((p) => p.day <= ageDays);
    const future = points.filter((p) => p.day >= ageDays);
    const nowPoint: Point = { day: ageDays, views: data.viewCount, x: nowX, y: toY(data.viewCount) };
    if (past[past.length - 1]?.day !== ageDays) past.push(nowPoint);
    if (future[0]?.day !== ageDays) future.unshift(nowPoint);

    const baseY = HEIGHT - PAD.bottom;
    const area = (pts: Point[]) => `${smoothPath(pts)} L ${pts[pts.length - 1].x} ${baseY} L ${pts[0].x} ${baseY} Z`;

    return {
      ageDays,
      startDay,
      endDay,
      points,
      nowPoint,
      pastLine: smoothPath(past),
      pastArea: area(past),
      futureLine: smoothPath(future),
      futureArea: area(future),
      projected30: Math.round(viewsAt(endDay)),
      viewsPerDay,
    };
  }, [data.publishedAt, data.viewCount, data.viewsPerHour]);

  const onPointerMove = (event: PointerEvent<SVGSVGElement>) => {
    if (!chart) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * WIDTH;
    const nearest = chart.points.reduce((best, p) => (Math.abs(p.x - x) < Math.abs(best.x - x) ? p : best));
    setHover(nearest);
  };

  return (
    <div className="space-y-3 rounded-2xl border border-slate-800/80 bg-slate-900/60 p-3.5 backdrop-blur-xl">
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 font-bold text-slate-200">
          <TrendingUp className="h-4 w-4 text-cyan-400" /> {t('growthTitle')}
        </span>
        {chart && (
          <span className="rounded-full border border-cyan-500/20 bg-cyan-500/10 px-2 py-0.5 font-mono text-[10px] text-cyan-400">
            ~{formatNumber(data.viewsPerHour)} {t('perHour')}
          </span>
        )}
      </div>

      {!chart ? (
        <p className="py-4 text-center text-[11px] text-slate-500">{t('noDate')}</p>
      ) : (
        <>
          <div className="rounded-xl border border-slate-800/80 bg-slate-950/80 p-3">
            <svg
              viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
              className="w-full cursor-crosshair touch-none select-none"
              onPointerMove={onPointerMove}
              onPointerLeave={() => setHover(null)}
              role="img"
              aria-label={t('chartAria')}
            >
              <defs>
                <linearGradient id="velocity-area" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#06B6D4" stopOpacity="0.4" />
                  <stop offset="100%" stopColor="#06B6D4" stopOpacity="0" />
                </linearGradient>
                <linearGradient id="velocity-future" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#A855F7" stopOpacity="0.25" />
                  <stop offset="100%" stopColor="#A855F7" stopOpacity="0" />
                </linearGradient>
              </defs>

              <path d={chart.pastArea} fill="url(#velocity-area)" />
              <path d={chart.futureArea} fill="url(#velocity-future)" />
              <path d={chart.pastLine} fill="none" stroke="#06B6D4" strokeWidth="3" strokeLinecap="round" />
              <path d={chart.futureLine} fill="none" stroke="#A855F7" strokeWidth="2" strokeDasharray="4 4" />

              <line
                x1={chart.nowPoint.x}
                x2={chart.nowPoint.x}
                y1={PAD.top - 4}
                y2={HEIGHT - PAD.bottom}
                stroke="rgba(255,255,255,0.15)"
                strokeDasharray="2 3"
              />
              {/* fill-box + center makes the ping scale around the dot, not the SVG's top-left corner */}
              <circle
                cx={chart.nowPoint.x}
                cy={chart.nowPoint.y}
                r="4"
                fill="#38BDF8"
                className="animate-ping"
                style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
              />
              <circle cx={chart.nowPoint.x} cy={chart.nowPoint.y} r="4" fill="#06B6D4" />
              <circle
                cx={chart.points[chart.points.length - 1].x}
                cy={chart.points[chart.points.length - 1].y}
                r="5"
                fill="#F43F5E"
              />

              {hover && (
                <g pointerEvents="none">
                  <line x1={hover.x} x2={hover.x} y1={PAD.top - 4} y2={HEIGHT - PAD.bottom} stroke="rgba(244,63,94,0.5)" />
                  <circle cx={hover.x} cy={hover.y} r="3.5" fill="#fff" />
                  <g transform={`translate(${Math.min(Math.max(hover.x - 45, 2), WIDTH - 92)} 0)`}>
                    <rect width="90" height="26" rx="6" fill="#020617" stroke="rgba(255,255,255,0.12)" />
                    <text x="45" y="11" fill="#94A3B8" fontSize="8" textAnchor="middle">
                      {dayLabel(hover.day - chart.ageDays, t)}
                    </text>
                    <text x="45" y="21" fill="#fff" fontSize="9" fontWeight="700" textAnchor="middle">
                      {formatNumber(hover.views)} {t('viewsUnit')}
                    </text>
                  </g>
                </g>
              )}
            </svg>
            <div className="mt-2 flex justify-between font-mono text-[9px] text-slate-500">
              <span>{chart.startDay === 0 ? t('publishDay') : dayLabel(chart.startDay - chart.ageDays, t)}</span>
              <span>{t('nowDays', { n: formatNumber(data.daysOld) })}</span>
              <span>{t('plus30')}</span>
            </div>
          </div>

          <div className="space-y-1 rounded-xl border border-slate-800/50 bg-slate-950/50 p-2.5 text-[11px] text-slate-400">
            <p>• {t('growthLine1', { n: formatNumber(data.viewsPerHour) })}</p>
            <p>• {t('growthLine2', { n: formatNumber(chart.projected30) })}</p>
            <p className="pt-1 text-[10px] text-slate-500">{t('growthNote', { n: formatNumber(chart.viewsPerDay) })}</p>
          </div>
        </>
      )}
    </div>
  );
}
