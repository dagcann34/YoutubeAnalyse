import { useState } from 'react';
import { Check, Download, MessageSquare, Send, Share2 } from 'lucide-react';
import type { VideoAnalytics } from '../../types/youtube';
import { formatNumber, formatPercent, formatUsd } from '../../utils/youtube';
import { downloadStoryCard } from '../../utils/storyCard';
import type { Lang, Translate } from '../../i18n';
import { useI18n } from '../i18n';

function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}

function whatsAppText(data: VideoAnalytics, t: Translate): string {
  return [
    `📊 *${truncate(data.title, 120)}*`,
    `👁️ ${t('shareWaViews')}: ${formatNumber(data.viewCount)}`,
    `⚡ ${t('seoScore')}: ${data.seoScore}/100`,
    `💵 ${t('shareWaRevenue')}: ${formatUsd(data.estimatedRevenue.min)} - ${formatUsd(data.estimatedRevenue.max)}`,
    `https://youtu.be/${data.videoId}`,
    '',
    t('shareAnalyzed'),
  ].join('\n');
}

function xText(data: VideoAnalytics, t: Translate, lang: Lang): string {
  const engagement = data.engagementRate != null ? formatPercent(data.engagementRate, lang) : '—';
  return [
    `📊 ${t('shareXHeader')}: "${truncate(data.title, 80)}"`,
    `👁️ ${formatNumber(data.viewCount)} ${t('views')}`,
    `⚡ ${engagement} ${t('engagement')}`,
    `https://youtu.be/${data.videoId}`,
    '',
    t('shareXFooter'),
  ].join('\n');
}

function openTab(url: string) {
  void chrome.tabs.create({ url });
}

export default function ShareCard({ data }: { data: VideoAnalytics }) {
  const { t, lang } = useI18n();
  const [status, setStatus] = useState<'idle' | 'working' | 'done' | 'error'>('idle');

  const download = async () => {
    setStatus('working');
    try {
      await downloadStoryCard(data, t, lang);
      setStatus('done');
      setTimeout(() => setStatus('idle'), 2000);
    } catch (err) {
      console.error('[DagcanYT] Story card failed', err);
      setStatus('error');
    }
  };

  return (
    <div className="space-y-3 rounded-2xl border border-slate-800/80 bg-slate-900/60 p-4 backdrop-blur-xl">
      <div className="flex items-center gap-2 text-xs font-bold text-rose-400">
        <Share2 className="h-4 w-4 text-rose-500" /> {t('shareTitle')}
      </div>
      <p className="text-[11px] text-slate-300">
        {t('shareHint')}
      </p>

      <button
        type="button"
        onClick={() => void download()}
        disabled={status === 'working'}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-rose-600 via-purple-600 to-indigo-600 py-2.5 text-xs font-bold text-white shadow-glow-sm transition hover:opacity-90 disabled:opacity-60"
      >
        {status === 'done' ? <Check className="h-4 w-4" /> : <Download className="h-4 w-4" />}
        {status === 'done'
          ? t('shareDone')
          : status === 'error'
            ? t('shareError')
            : t('shareDownload')}
      </button>

      <div className="grid grid-cols-2 gap-2 pt-1">
        <button
          type="button"
          onClick={() => openTab(`https://api.whatsapp.com/send?text=${encodeURIComponent(whatsAppText(data, t))}`)}
          className="flex items-center justify-center gap-1.5 rounded-xl border border-emerald-500/40 bg-emerald-600/20 py-2 text-[11px] font-bold text-emerald-400 transition hover:bg-emerald-600/30"
        >
          <MessageSquare className="h-3.5 w-3.5" /> WhatsApp
        </button>
        <button
          type="button"
          onClick={() => openTab(`https://twitter.com/intent/tweet?text=${encodeURIComponent(xText(data, t, lang))}`)}
          className="flex items-center justify-center gap-1.5 rounded-xl border border-sky-500/40 bg-sky-600/20 py-2 text-[11px] font-bold text-sky-400 transition hover:bg-sky-600/30"
        >
          <Send className="h-3.5 w-3.5" /> X (Twitter)
        </button>
      </div>
    </div>
  );
}
