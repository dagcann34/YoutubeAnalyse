import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Check, Copy, KeyRound, Loader2, Search } from 'lucide-react';
import type { VideoAnalytics } from '../../types/youtube';
import type { Lang } from '../../i18n';
import { useI18n } from '../i18n';

const ALPHABET: Record<Lang, string> = {
  tr: 'abcçdefgğhıijklmnoöprsştuüvyz',
  en: 'abcdefghijklmnopqrstuvwxyz',
};
const TAG_LIMIT = 500;

/** YouTube search autocomplete for `query`, most popular first. */
async function suggest(query: string, lang: Lang): Promise<string[]> {
  const url = `https://suggestqueries.google.com/complete/search?client=firefox&ds=yt&hl=${lang}&q=${encodeURIComponent(query)}`;
  const response = await fetch(url);
  if (!response.ok) return [];
  const body = (await response.json()) as [string, string[]];
  return Array.isArray(body[1]) ? body[1] : [];
}

/** Runs `tasks` with at most `limit` in flight. */
async function pooled<T>(tasks: Array<() => Promise<T>>, limit: number): Promise<T[]> {
  const results: T[] = [];
  let next = 0;
  const worker = async () => {
    while (next < tasks.length) {
      const index = next++;
      results[index] = await tasks[index]().catch(() => undefined as T);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, tasks.length) }, worker));
  return results;
}

function defaultSeed(data: VideoAnalytics): string {
  return data.title
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 3)
    .join(' ')
    .toLowerCase();
}

export default function KeywordTool({ data, copied, copy }: {
  data: VideoAnalytics;
  copied: string | null;
  copy: (key: string, text: string) => void;
}) {
  const { t, lang } = useI18n();
  const [seed, setSeed] = useState(() => defaultSeed(data));
  const [deep, setDeep] = useState(false);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<string[] | null>(null);

  useEffect(() => {
    setSeed(defaultSeed(data));
    setResults(null);
  }, [data.videoId]);

  const videoTags = useMemo(() => new Set(data.tags.map((tag) => tag.toLowerCase())), [data.tags]);
  const inVideo = (keyword: string) => videoTags.has(keyword) || data.title.toLowerCase().includes(keyword);

  const run = async (event?: FormEvent) => {
    event?.preventDefault();
    const query = seed.trim();
    if (!query) return;
    setLoading(true);
    try {
      const queries = [query, ...(deep ? Array.from(ALPHABET[lang], (letter) => `${query} ${letter}`) : [])];
      const lists = await pooled(queries.map((q) => () => suggest(q, lang)), 6);

      // Rank by how often and how high a phrase is suggested across all queries.
      const score = new Map<string, number>();
      for (const list of lists) {
        (list ?? []).forEach((phrase, position) => {
          const key = phrase.toLowerCase().trim();
          if (key) score.set(key, (score.get(key) ?? 0) + (10 - Math.min(position, 9)));
        });
      }
      setResults([...score.entries()].sort((a, b) => b[1] - a[1]).map(([phrase]) => phrase).slice(0, 150));
    } finally {
      setLoading(false);
    }
  };

  // Greedily fit keywords into YouTube's 500-character tag box (commas count).
  const tagText = useMemo(() => {
    const picked: string[] = [];
    let length = 0;
    for (const keyword of results ?? []) {
      const extra = keyword.length + (picked.length ? 2 : 0);
      if (length + extra > TAG_LIMIT) continue;
      picked.push(keyword);
      length += extra;
    }
    return picked.join(', ');
  }, [results]);

  return (
    <div className="space-y-3 rounded-2xl border border-slate-800/80 bg-slate-900/60 p-3.5 backdrop-blur-xl">
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 font-bold text-slate-200">
          <KeyRound className="h-4 w-4 text-amber-400" /> {t('keywordTitle')}
        </span>
        {results && <span className="text-[10px] text-slate-500">{t('keywordCount', { n: results.length })}</span>}
      </div>
      <p className="text-[11px] text-slate-400">{t('keywordHint')}</p>

      <form onSubmit={(e) => void run(e)} className="flex gap-1.5">
        <input
          type="text"
          value={seed}
          onChange={(e) => setSeed(e.target.value)}
          placeholder={t('keywordPlaceholder')}
          className="min-w-0 flex-1 rounded-xl border border-slate-800 bg-slate-950/80 px-3 py-1.5 text-[11px] text-slate-200 focus:border-amber-500/50 focus:outline-none"
        />
        <button
          type="submit"
          disabled={loading}
          className="flex items-center gap-1 rounded-xl bg-amber-500/90 px-3 text-[11px] font-bold text-slate-950 transition hover:bg-amber-400 disabled:opacity-60"
        >
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />}
          {t('keywordSearch')}
        </button>
      </form>
      <label className="flex items-center gap-2 text-[11px] text-slate-300">
        <input type="checkbox" checked={deep} onChange={(e) => setDeep(e.target.checked)} className="accent-amber-500" />
        {t('keywordDeep')}
      </label>

      {results &&
        (results.length === 0 ? (
          <p className="py-3 text-center text-[11px] text-slate-500">{t('keywordEmpty')}</p>
        ) : (
          <>
            <div className="flex max-h-60 flex-wrap gap-1.5 overflow-y-auto pr-1">
              {results.map((keyword) => (
                <button
                  type="button"
                  key={keyword}
                  onClick={() => copy(`kw:${keyword}`, keyword)}
                  title={inVideo(keyword) ? t('keywordInVideo') : t('clickToCopy')}
                  className={`flex items-center gap-1 rounded-lg border px-2 py-1 text-[11px] transition ${
                    inVideo(keyword)
                      ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
                      : 'border-slate-800 bg-slate-950/60 text-slate-300 hover:border-amber-500/40 hover:text-amber-300'
                  }`}
                >
                  {keyword}
                  {copied === `kw:${keyword}` && <Check className="h-2.5 w-2.5 text-emerald-400" />}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => copy('kw-tags', tagText)}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 py-2 text-[11px] font-bold text-amber-300 transition hover:bg-amber-500/20"
            >
              {copied === 'kw-tags' ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {copied === 'kw-tags' ? t('copied') : t('keywordCopyTags')}
              <span className="font-normal text-amber-200/60">{t('keywordTagLimit', { n: tagText.length })}</span>
            </button>
          </>
        ))}
    </div>
  );
}
