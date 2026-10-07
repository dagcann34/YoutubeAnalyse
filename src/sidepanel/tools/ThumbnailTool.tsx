import { useEffect, useState } from 'react';
import { Check, Download, Image as ImageIcon } from 'lucide-react';
import type { VideoAnalytics } from '../../types/youtube';
import { formatNumber } from '../../utils/youtube';
import { useI18n } from '../i18n';

const SIZES = [
  { key: 'maxresdefault', label: '1280×720' },
  { key: 'sddefault', label: '640×480' },
  { key: 'hqdefault', label: '480×360' },
  { key: 'mqdefault', label: '320×180' },
] as const;

type SizeKey = (typeof SIZES)[number]['key'];

const thumbUrl = (videoId: string, size: SizeKey) => `https://i.ytimg.com/vi/${videoId}/${size}.jpg`;

export default function ThumbnailTool({ data }: { data: VideoAnalytics }) {
  const { t } = useI18n();
  // maxres doesn't exist for every video; YouTube answers 404 and we fall back to hq.
  const [missing, setMissing] = useState<Set<SizeKey>>(new Set());
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [status, setStatus] = useState<{ key: SizeKey; state: 'done' | 'error' } | null>(null);

  useEffect(() => {
    setMissing(new Set());
    setStatus(null);
  }, [data.videoId]);

  const preview = missing.has('maxresdefault') ? thumbUrl(data.videoId, 'hqdefault') : thumbUrl(data.videoId, 'maxresdefault');

  const download = async (size: SizeKey) => {
    try {
      const response = await fetch(thumbUrl(data.videoId, size));
      if (!response.ok) throw new Error(String(response.status));
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement('a');
      link.href = url;
      link.download = `${data.videoId}-${size}.jpg`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setStatus({ key: size, state: 'done' });
    } catch {
      setStatus({ key: size, state: 'error' });
    }
  };

  const dark = theme === 'dark';

  return (
    <div className="space-y-3 rounded-2xl border border-slate-800/80 bg-slate-900/60 p-3.5 backdrop-blur-xl">
      <span className="flex items-center gap-1.5 font-bold text-slate-200">
        <ImageIcon className="h-4 w-4 text-rose-500" /> {t('thumbTitle')}
      </span>

      <img
        src={thumbUrl(data.videoId, 'maxresdefault')}
        alt=""
        className="hidden"
        onError={() => setMissing((prev) => new Set(prev).add('maxresdefault'))}
      />

      <div className="grid grid-cols-2 gap-1.5">
        {SIZES.map(({ key, label }) => {
          const unavailable = missing.has(key);
          const state = status?.key === key ? status.state : null;
          return (
            <button
              type="button"
              key={key}
              disabled={unavailable}
              onClick={() => void download(key)}
              title={unavailable ? t('thumbMissing') : state === 'error' ? t('thumbError') : t('thumbDownload')}
              className="flex items-center justify-center gap-1.5 rounded-lg border border-slate-800 bg-slate-950/60 py-1.5 text-[11px] text-slate-300 transition hover:border-rose-500/40 hover:text-rose-300 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {state === 'done' ? <Check className="h-3 w-3 text-emerald-400" /> : <Download className="h-3 w-3" />}
              {label}
              {state === 'error' && <span className="text-rose-400">!</span>}
            </button>
          );
        })}
      </div>

      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold text-slate-300">{t('thumbPreview')}</span>
        <div className="flex rounded-lg border border-slate-800 p-0.5">
          {(['dark', 'light'] as const).map((value) => (
            <button
              type="button"
              key={value}
              onClick={() => setTheme(value)}
              className={`rounded-md px-2 py-0.5 text-[10px] font-semibold ${
                theme === value ? 'bg-slate-700 text-white' : 'text-slate-400'
              }`}
            >
              {t(value === 'dark' ? 'thumbDark' : 'thumbLight')}
            </button>
          ))}
        </div>
      </div>

      {/* Mimics a home-feed card and a related-videos row at their real proportions. */}
      <div className={`space-y-3 rounded-xl p-3 ${dark ? 'bg-[#0f0f0f]' : 'bg-white'}`}>
        <div>
          <img src={preview} alt="" className="aspect-video w-full rounded-xl object-cover" />
          <div className="mt-2 flex gap-2">
            <div className={`h-7 w-7 shrink-0 rounded-full ${dark ? 'bg-neutral-700' : 'bg-neutral-300'}`} />
            <div className="min-w-0">
              <p className={`line-clamp-2 text-[12px] font-semibold leading-tight ${dark ? 'text-[#f1f1f1]' : 'text-[#0f0f0f]'}`}>
                {data.title}
              </p>
              <p className={`mt-0.5 text-[10px] ${dark ? 'text-[#aaa]' : 'text-[#606060]'}`}>
                {data.channelTitle} · {formatNumber(data.viewCount)} {t('viewsUnit')}
              </p>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <img src={preview} alt="" className="aspect-video w-[45%] shrink-0 rounded-lg object-cover" />
          <div className="min-w-0">
            <p className={`line-clamp-2 text-[11px] font-semibold leading-tight ${dark ? 'text-[#f1f1f1]' : 'text-[#0f0f0f]'}`}>
              {data.title}
            </p>
            <p className={`mt-0.5 text-[10px] ${dark ? 'text-[#aaa]' : 'text-[#606060]'}`}>{data.channelTitle}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
