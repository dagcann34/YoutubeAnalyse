import type { Snapshot } from '../../utils/watchlist';

/** Tiny time-scaled line of view snapshots. */
export default function Sparkline({ snapshots, width = 120, height = 32, fluid = false }: {
  snapshots: Snapshot[];
  width?: number;
  height?: number;
  /** Stretch to the container's width */
  fluid?: boolean;
}) {
  if (snapshots.length < 2) return null;

  const t0 = snapshots[0].t;
  const t1 = snapshots[snapshots.length - 1].t;
  const v0 = Math.min(...snapshots.map((s) => s.views));
  const v1 = Math.max(...snapshots.map((s) => s.views));
  const x = (t: number) => 2 + ((t - t0) / Math.max(t1 - t0, 1)) * (width - 4);
  const y = (v: number) => height - 2 - ((v - v0) / Math.max(v1 - v0, 1)) * (height - 4);
  const line = snapshots.map((s, i) => `${i ? 'L' : 'M'} ${x(s.t).toFixed(1)} ${y(s.views).toFixed(1)}`).join(' ');
  const last = snapshots[snapshots.length - 1];

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width={fluid ? '100%' : width}
      height={height}
      preserveAspectRatio={fluid ? 'none' : undefined}
      className="shrink-0"
      aria-hidden="true"
    >
      <path d={`${line} L ${x(t1)} ${height} L ${x(t0)} ${height} Z`} fill="rgba(6,182,212,0.15)" />
      <path d={line} fill="none" stroke="#06B6D4" strokeWidth="1.75" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={x(last.t)} cy={y(last.views)} r="2.5" fill="#22D3EE" />
    </svg>
  );
}
