import { useEffect, useState } from 'react';
import { Check, Copy, Download, FileText, Loader2, Sparkles } from 'lucide-react';
import type { GetTranscriptMessage, TranscriptResponse, TranscriptSegment, VideoAnalytics } from '../../types/youtube';
import { translateError } from '../../i18n';
import { buildTranscriptPrompt } from '../../utils/youtube';
import { useI18n } from '../i18n';

function toText(segments: TranscriptSegment[], withTimes: boolean): string {
  return segments.map((s) => (withTimes && s.time ? `[${s.time}] ${s.text}` : s.text)).join('\n');
}

export default function TranscriptTool({ data, tabId, copied, copy }: {
  data: VideoAnalytics;
  tabId: number | null;
  copied: string | null;
  copy: (key: string, text: string) => void;
}) {
  const { t, lang } = useI18n();
  const [segments, setSegments] = useState<TranscriptSegment[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [withTimes, setWithTimes] = useState(true);

  useEffect(() => {
    setSegments(null);
    setError(null);
  }, [data.videoId]);

  const load = async () => {
    if (tabId == null) return;
    setLoading(true);
    setError(null);
    try {
      const message: GetTranscriptMessage = { type: 'GET_TRANSCRIPT' };
      const response = (await chrome.tabs.sendMessage(tabId, message)) as TranscriptResponse | undefined;
      if (response?.ok) setSegments(response.segments);
      else setError(response?.error ?? 'ERR_NO_RESPONSE');
    } catch {
      setError('ERR_CONNECT');
    } finally {
      setLoading(false);
    }
  };

  const download = () => {
    if (!segments) return;
    const url = URL.createObjectURL(new Blob([toText(segments, withTimes)], { type: 'text/plain;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `${data.videoId}-transcript.txt`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const words = segments ? segments.reduce((sum, s) => sum + s.text.split(/\s+/).filter(Boolean).length, 0) : 0;

  return (
    <div className="space-y-3 rounded-2xl border border-slate-800/80 bg-slate-900/60 p-3.5 backdrop-blur-xl">
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 font-bold text-slate-200">
          <FileText className="h-4 w-4 text-cyan-400" /> {t('transcriptTitle')}
        </span>
        {segments && (
          <span className="text-[10px] text-slate-500">{t('transcriptLines', { n: segments.length, w: words })}</span>
        )}
      </div>

      {!segments ? (
        <>
          <p className="text-[11px] text-slate-400">{t('transcriptHint')}</p>
          {error && <p className="text-[11px] text-rose-400">{translateError(t, error)}</p>}
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading || tabId == null}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-cyan-500/40 bg-cyan-600/15 py-2 text-[11px] font-bold text-cyan-300 transition hover:bg-cyan-600/25 disabled:opacity-60"
          >
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileText className="h-3.5 w-3.5" />}
            {loading ? t('transcriptLoading') : t('transcriptLoad')}
          </button>
        </>
      ) : (
        <>
          <label className="flex items-center gap-2 text-[11px] text-slate-300">
            <input type="checkbox" checked={withTimes} onChange={(e) => setWithTimes(e.target.checked)} className="accent-rose-500" />
            {t('transcriptTimestamps')}
          </label>
          <div className="max-h-56 space-y-1 overflow-y-auto rounded-xl border border-slate-800 bg-slate-950/70 p-2.5 text-[11px] leading-relaxed text-slate-300">
            {segments.map((s, i) => (
              <p key={i}>
                {withTimes && s.time && <span className="mr-1.5 font-mono text-[10px] text-cyan-500">{s.time}</span>}
                {s.text}
              </p>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            <button
              type="button"
              onClick={() => copy('transcript', toText(segments, withTimes))}
              className="flex items-center justify-center gap-1.5 rounded-lg border border-slate-800 bg-slate-950/60 py-1.5 text-[11px] text-slate-300 transition hover:border-cyan-500/40 hover:text-cyan-300"
            >
              {copied === 'transcript' ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
              {copied === 'transcript' ? t('copied') : t('transcriptCopy')}
            </button>
            <button
              type="button"
              onClick={download}
              className="flex items-center justify-center gap-1.5 rounded-lg border border-slate-800 bg-slate-950/60 py-1.5 text-[11px] text-slate-300 transition hover:border-cyan-500/40 hover:text-cyan-300"
            >
              <Download className="h-3 w-3" /> {t('transcriptDownload')}
            </button>
          </div>
          <button
            type="button"
            onClick={() => copy('transcript-ai', buildTranscriptPrompt(data, toText(segments, true), lang))}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-600 to-purple-600 py-2 text-[11px] font-bold text-white transition hover:opacity-90"
          >
            {copied === 'transcript-ai' ? <Check className="h-3.5 w-3.5" /> : <Sparkles className="h-3.5 w-3.5" />}
            {copied === 'transcript-ai' ? t('aiCopied') : t('transcriptAi')}
          </button>
        </>
      )}
    </div>
  );
}
