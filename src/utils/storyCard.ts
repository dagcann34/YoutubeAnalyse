import type { VideoAnalytics } from '../types/youtube';
import type { Lang, Translate } from '../i18n';
import { formatNumber, formatPercent, formatUsd } from './youtube';

const W = 1080;
const H = 1920;
const FONT = '"Segoe UI", system-ui, -apple-system, "Helvetica Neue", Arial, sans-serif';

/** Same artwork as design/logo.svg, drawn at `size` px. */
function drawLogo(ctx: CanvasRenderingContext2D, x: number, y: number, size: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(size / 128, size / 128);
  ctx.fillStyle = '#1F1F1F';
  ctx.strokeStyle = '#333333';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(2, 2, 124, 124, 28);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#FF0000';
  ctx.fill(new Path2D('M26 22 H62 A42 42 0 0 1 62 106 H26 Z M46 42 H61 A22 22 0 0 1 61 86 H46 Z'), 'evenodd');
  ctx.fillStyle = '#3EA6FF';
  for (const [bx, by, bh] of [[51, 70, 11], [61, 61, 20], [71, 51, 30]]) {
    ctx.beginPath();
    ctx.roundRect(bx, by, 7, bh, 2);
    ctx.fill();
  }
  ctx.restore();
}

/** Word-wraps `text` to at most `maxLines`, ending with an ellipsis when cut. */
function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = '';

  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (ctx.measureText(candidate).width <= maxWidth) {
      line = candidate;
      continue;
    }
    if (line) lines.push(line);
    line = word;
    if (lines.length === maxLines) break;
  }
  if (lines.length < maxLines && line) lines.push(line);

  if (lines.length === maxLines && lines.join(' ').length < text.length) {
    let last = lines[maxLines - 1];
    while (last && ctx.measureText(`${last}…`).width > maxWidth) last = last.slice(0, -1);
    lines[maxLines - 1] = `${last.trimEnd()}…`;
  }
  return lines;
}

function glow(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, color);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
}

function statTile(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  label: string,
  value: string,
  accent: string,
) {
  ctx.fillStyle = 'rgba(15, 23, 42, 0.75)';
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 36);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = accent;
  ctx.beginPath();
  ctx.roundRect(x + 40, y + 48, 10, 40, 5);
  ctx.fill();

  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#94A3B8';
  ctx.font = `500 36px ${FONT}`;
  ctx.fillText(label, x + 66, y + 69);

  // Shrink long values (e.g. revenue ranges) until they fit the tile.
  let size = 64;
  ctx.font = `800 ${size}px ${FONT}`;
  while (size > 30 && ctx.measureText(value).width > w - 80) {
    size -= 2;
    ctx.font = `800 ${size}px ${FONT}`;
  }
  ctx.fillStyle = '#FFFFFF';
  ctx.fillText(value, x + 40, y + h - 62);
}

export function renderStoryCard(data: VideoAnalytics, t: Translate, lang: Lang): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas not supported');

  // Background
  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, '#07090E');
  bg.addColorStop(0.55, '#0B0F1A');
  bg.addColorStop(1, '#1A0B1E');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  glow(ctx, 900, 260, 520, 'rgba(244, 63, 94, 0.28)');
  glow(ctx, 150, 1500, 600, 'rgba(147, 51, 234, 0.22)');

  // Header
  drawLogo(ctx, 90, 120, 120);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#FFFFFF';
  ctx.font = `800 64px ${FONT}`;
  ctx.fillText('DagcanYT', 240, 165);
  ctx.fillStyle = '#94A3B8';
  ctx.font = `500 34px ${FONT}`;
  ctx.fillText(t('subtitle'), 242, 222);

  // Format badge
  const badge = data.isShort ? 'SHORTS' : t('cardLong');
  ctx.font = `700 32px ${FONT}`;
  const badgeW = ctx.measureText(badge).width + 56;
  ctx.fillStyle = 'rgba(244, 63, 94, 0.15)';
  ctx.strokeStyle = 'rgba(244, 63, 94, 0.45)';
  ctx.beginPath();
  ctx.roundRect(90, 330, badgeW, 64, 18);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#FB7185';
  ctx.fillText(badge, 118, 363);

  // Title + channel
  ctx.font = `800 66px ${FONT}`;
  ctx.fillStyle = '#F8FAFC';
  const titleLines = wrapText(ctx, data.title, W - 180, 4);
  titleLines.forEach((line, i) => ctx.fillText(line, 90, 470 + i * 84));
  const afterTitle = 470 + titleLines.length * 84;
  ctx.font = `500 40px ${FONT}`;
  ctx.fillStyle = '#94A3B8';
  ctx.fillText(data.channelTitle, 90, afterTitle + 20);

  // Bottom-up layout so long titles never push content off the card.
  const footerY = H - 95;
  const tileH = 200;
  const gap = 24;
  const tileW = (W - 180 - gap) / 2;
  const gridBottom = footerY - 110;
  const gridTop = gridBottom - tileH * 2 - gap;

  // SEO score ring, centred between the channel name and the stats grid
  const r = 150;
  const cx = W / 2;
  const cy = (afterTitle + 60 + gridTop) / 2;
  ctx.lineWidth = 32;
  ctx.lineCap = 'round';
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke();
  const ring = ctx.createLinearGradient(cx - r, cy - r, cx + r, cy + r);
  ring.addColorStop(0, '#F43F5E');
  ring.addColorStop(1, '#9333EA');
  ctx.strokeStyle = ring;
  ctx.shadowColor = 'rgba(244, 63, 94, 0.6)';
  ctx.shadowBlur = 40;
  ctx.beginPath();
  ctx.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + (Math.PI * 2 * Math.min(data.seoScore, 100)) / 100);
  ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#FFFFFF';
  ctx.font = `900 110px ${FONT}`;
  ctx.fillText(String(data.seoScore), cx, cy - 10);
  ctx.fillStyle = '#94A3B8';
  ctx.font = `600 30px ${FONT}`;
  ctx.fillText(t('cardSeo'), cx, cy + 66);

  // Stats, 2 x 2
  const left = 90;
  const right = left + tileW + gap;
  const row2 = gridTop + tileH + gap;
  statTile(ctx, left, gridTop, tileW, tileH, t('views'), formatNumber(data.viewCount), '#22D3EE');
  statTile(ctx, right, gridTop, tileW, tileH, t('likes'), data.likeCount ? formatNumber(data.likeCount) : t('hidden'), '#F43F5E');
  statTile(
    ctx, left, row2, tileW, tileH, t('engagement'),
    data.engagementRate != null ? formatPercent(data.engagementRate, lang) : '—', '#A855F7',
  );
  statTile(
    ctx, right, row2, tileW, tileH, t('cardRevenue'),
    `${formatUsd(data.estimatedRevenue.min)} – ${formatUsd(data.estimatedRevenue.max)}`, '#34D399',
  );

  // Footer
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#64748B';
  ctx.font = `500 32px ${FONT}`;
  ctx.fillText(`youtu.be/${data.videoId}`, cx, footerY - 45);
  ctx.fillStyle = '#94A3B8';
  ctx.font = `600 34px ${FONT}`;
  ctx.fillText(t('cardFooter'), cx, footerY + 5);

  return canvas;
}

export async function downloadStoryCard(
  data: VideoAnalytics,
  t: Translate,
  lang: Lang,
  fileName = 'dagcanyt-card.png',
): Promise<void> {
  const canvas = renderStoryCard(data, t, lang);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
  if (!blob) throw new Error('Could not create image');

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
