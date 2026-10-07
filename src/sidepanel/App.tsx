import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  BarChart3, Bookmark, BookmarkCheck, Check, Copy, Eye, Flame, RefreshCw, Search, Settings as SettingsIcon, Share2,
  ShieldCheck, Sparkles, Tag, ThumbsUp, TrendingUp, Wrench, Zap,
} from 'lucide-react';
import type { GetVideoDataMessage, RuntimeMessage, VideoAnalytics, VideoDataResponse } from '../types/youtube';
import { browserLang, makeT, translateError, type Lang } from '../i18n';
import { DEFAULT_SETTINGS, getSettings, onSettingsChanged, updateSettings, type Settings } from '../utils/settings';
import {
  MAX_WATCH_ITEMS, addToWatchlist, getWatchlist, onWatchlistChanged, removeFromWatchlist, type Watchlist,
} from '../utils/watchlist';
import { buildAiPrompt, formatDate, formatNumber, formatPercent, getVideoIdFromUrl } from '../utils/youtube';
import { LangContext } from './i18n';
import OutlierCard from './components/OutlierCard';
import RealGrowth from './components/RealGrowth';
import RevenueCard from './components/RevenueCard';
import ShareCard from './components/ShareCard';
import VelocityChart from './components/VelocityChart';
import WatchlistTab from './components/WatchlistTab';
import KeywordTool from './tools/KeywordTool';
import ThumbnailTool from './tools/ThumbnailTool';
import TranscriptTool from './tools/TranscriptTool';

type TabKey = 'overview' | 'chart' | 'tags' | 'tools' | 'watch' | 'share';

const NOT_A_VIDEO = 'not-a-video';

async function getActiveTab(): Promise<chrome.tabs.Tab | undefined> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

async function requestVideoData(tab: chrome.tabs.Tab | undefined): Promise<VideoDataResponse> {
  if (!tab?.id || !tab.url || !getVideoIdFromUrl(tab.url)) return { ok: false, error: NOT_A_VIDEO };

  try {
    const message: GetVideoDataMessage = { type: 'GET_VIDEO_DATA' };
    const response = (await chrome.tabs.sendMessage(tab.id, message)) as VideoDataResponse | undefined;
    return response ?? { ok: false, error: 'ERR_NO_RESPONSE' };
  } catch {
    return { ok: false, error: 'ERR_CONNECT' };
  }
}

function useCopy(): [string | null, (key: string, text: string) => void] {
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(null), 2000);
    return () => clearTimeout(timer);
  }, [copied]);

  const copy = useCallback((key: string, text: string) => {
    if (!text) return;
    navigator.clipboard
      .writeText(text)
      .then(() => setCopied(key))
      .catch((err) => console.error('[DagcanYT] Clipboard write failed', err));
  }, []);

  return [copied, copy];
}

function MetricCard({ icon, label, value, accent }: {
  icon: ReactNode;
  label: string;
  value: string;
  accent: string;
}) {
  return (
    <div className="flex items-center gap-2.5 rounded-2xl border border-slate-800/80 bg-slate-900/60 p-3 backdrop-blur-xl">
      <div className={`rounded-xl border p-2 ${accent}`}>{icon}</div>
      <div>
        <p className="text-[10px] text-slate-400">{label}</p>
        <p className="text-sm font-black text-white">{value}</p>
      </div>
    </div>
  );
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center justify-center gap-1 rounded-lg py-1.5 text-[10px] font-semibold transition ${
        active
          ? 'bg-gradient-to-r from-rose-600 to-purple-600 text-white shadow-glow-sm'
          : 'text-slate-400 hover:text-slate-200'
      }`}
    >
      {children}
    </button>
  );
}

export default function App() {
  const [data, setData] = useState<VideoAnalytics | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabKey>('overview');
  const [tagSearch, setTagSearch] = useState('');
  const [tabId, setTabId] = useState<number | null>(null);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [showSettings, setShowSettings] = useState(false);
  const [watchlist, setWatchlist] = useState<Watchlist>({});
  const [watchFull, setWatchFull] = useState(false);
  const [copied, copy] = useCopy();
  const activeTabId = useRef<number | null>(null);
  const requestId = useRef(0);

  const lang: Lang = settings.lang === 'auto' ? browserLang() : settings.lang;
  const i18n = useMemo(() => ({ lang, t: makeT(lang) }), [lang]);
  const { t } = i18n;

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  useEffect(() => {
    void getSettings().then(setSettings);
    void getWatchlist().then(setWatchlist);
    const offSettings = onSettingsChanged(setSettings);
    const offWatchlist = onWatchlistChanged(setWatchlist);
    return () => {
      offSettings();
      offWatchlist();
    };
  }, []);

  const showResult = useCallback((result: VideoDataResponse) => {
    setLoading(false);
    if (result.ok) {
      setData((previous) => {
        if (previous?.videoId !== result.data.videoId) {
          setTagSearch('');
          setWatchFull(false);
        }
        return result.data;
      });
      setError(null);
    } else {
      setData(null);
      setError(result.error);
    }
  }, []);

  // Pull the current tab's data (on open, on tab switch, and on the refresh button).
  const refresh = useCallback(async () => {
    const id = ++requestId.current;
    setLoading(true);
    const tab = await getActiveTab();
    activeTabId.current = tab?.id ?? null;
    setTabId(tab?.id ?? null);
    const result = await requestVideoData(tab);
    if (id === requestId.current) showResult(result);
  }, [showResult]);

  useEffect(() => {
    void refresh();

    // Pushed by the content script after every YouTube navigation.
    const onMessage = (message: RuntimeMessage, sender: chrome.runtime.MessageSender) => {
      if (message.type !== 'VIDEO_DATA_UPDATED') return;
      if (sender.tab?.id == null || sender.tab.id !== activeTabId.current) return;

      requestId.current++; // cancel any in-flight pull, the push is newer
      showResult(message.payload ? { ok: true, data: message.payload } : { ok: false, error: NOT_A_VIDEO });
    };

    const onActivated = () => void refresh();

    const onUpdated = (updatedTabId: number, changeInfo: chrome.tabs.TabChangeInfo) => {
      if (updatedTabId === activeTabId.current && changeInfo.status === 'loading' && changeInfo.url) setLoading(true);
    };

    chrome.runtime.onMessage.addListener(onMessage);
    chrome.tabs.onActivated.addListener(onActivated);
    chrome.tabs.onUpdated.addListener(onUpdated);
    return () => {
      chrome.runtime.onMessage.removeListener(onMessage);
      chrome.tabs.onActivated.removeListener(onActivated);
      chrome.tabs.onUpdated.removeListener(onUpdated);
    };
  }, [refresh, showResult]);

  const toggleWatch = async () => {
    if (!data) return;
    if (watchlist[data.videoId]) {
      await removeFromWatchlist(data.videoId);
      return;
    }
    const added = await addToWatchlist(
      { videoId: data.videoId, title: data.title, channelTitle: data.channelTitle, isShort: data.isShort },
      data.viewCount,
    );
    setWatchFull(!added);
  };

  const filteredTags = data?.tags.filter((tag) => tag.toLowerCase().includes(tagSearch.toLowerCase())) ?? [];
  const watched = data ? Boolean(watchlist[data.videoId]) : false;

  return (
    <LangContext.Provider value={i18n}>
      <div className="min-h-screen space-y-3.5 bg-[#07090E] p-3.5 text-xs text-slate-100">
        {/* Top Bar / Header */}
        <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-2.5 shadow-lg backdrop-blur-xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="relative">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-tr from-rose-600 via-rose-500 to-purple-600 font-black text-white shadow-glow-sm">
                  D
                </div>
                <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 animate-pulse rounded-full border-2 border-[#07090E] bg-emerald-500" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <h1 className="bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-sm font-extrabold tracking-wide text-transparent">
                    DagcanYT
                  </h1>
                  <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-1.5 py-px text-[9px] font-bold text-emerald-400">
                    {t('free')}
                  </span>
                </div>
                <p className="text-[10px] font-medium text-slate-400">{t('subtitle')}</p>
              </div>
            </div>
            <div className="flex items-center gap-0.5">
              <button
                type="button"
                onClick={() => setShowSettings((open) => !open)}
                className={`rounded-xl border p-2 transition hover:border-slate-700/50 hover:bg-slate-800/80 ${
                  showSettings ? 'border-slate-700/50 bg-slate-800/80 text-rose-400' : 'border-transparent text-slate-400'
                }`}
                title={t('settings')}
              >
                <SettingsIcon className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => void refresh()}
                disabled={loading}
                className="rounded-xl border border-transparent p-2 text-slate-400 transition hover:border-slate-700/50 hover:bg-slate-800/80 hover:text-rose-400 disabled:opacity-60"
                title={t('refresh')}
              >
                <RefreshCw className={`h-4 w-4 text-rose-500 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>

          {showSettings && (
            <div className="mt-2.5 space-y-2.5 border-t border-slate-800 pt-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-slate-300">{t('language')}</span>
                <div className="flex rounded-lg border border-slate-800 p-0.5">
                  {(['auto', 'tr', 'en'] as const).map((value) => (
                    <button
                      type="button"
                      key={value}
                      onClick={() => void updateSettings({ lang: value })}
                      className={`rounded-md px-2 py-0.5 text-[10px] font-semibold ${
                        settings.lang === value ? 'bg-slate-700 text-white' : 'text-slate-400'
                      }`}
                    >
                      {value === 'auto' ? t('langAuto') : value.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>
              <label className="flex items-start justify-between gap-3">
                <span>
                  <span className="block text-[11px] text-slate-300">{t('badgesSetting')}</span>
                  <span className="block text-[10px] leading-snug text-slate-500">{t('badgesHint')}</span>
                </span>
                <input
                  type="checkbox"
                  checked={settings.badges}
                  onChange={(e) => void updateSettings({ badges: e.target.checked })}
                  className="mt-0.5 accent-rose-500"
                />
              </label>
            </div>
          )}
        </div>

        {!data ? (
          <>
            <div className="space-y-3 rounded-2xl border border-slate-800/50 bg-slate-900/40 p-6 py-16 text-center backdrop-blur-md">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-rose-500/20 bg-rose-500/10 text-rose-500">
                <Flame className="h-6 w-6 animate-pulse" />
              </div>
              <h3 className="font-semibold text-slate-200">{loading ? t('loading') : t('waiting')}</h3>
              <p className="text-[11px] leading-relaxed text-slate-400">
                {error && error !== NOT_A_VIDEO ? translateError(t, error) : t('waitingHint')}
              </p>
            </div>
            {/* The tracking list is useful away from a video page too. */}
            {Object.keys(watchlist).length > 0 && <WatchlistTab list={watchlist} activeVideoId={null} />}
          </>
        ) : (
          <div className={`space-y-3.5 transition-opacity ${loading ? 'opacity-60' : ''}`}>
            {/* Main Video Meta Card */}
            <div className="relative space-y-2 overflow-hidden rounded-2xl border border-slate-800/80 bg-gradient-to-br from-slate-900/90 via-slate-900/50 to-rose-950/20 p-3.5 shadow-xl backdrop-blur-xl">
              <div className="pointer-events-none absolute right-0 top-0 h-24 w-24 rounded-full bg-rose-500/10 blur-2xl" />

              <div className="flex items-center justify-between">
                <span className="rounded-md border border-rose-500/30 bg-rose-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-rose-400">
                  {data.isShort ? t('shorts') : t('longVideo')}
                </span>
                <span className="font-mono text-[10px] text-slate-400">
                  {data.publishedAt ? formatDate(data.publishedAt, lang) : ''}
                </span>
              </div>

              <h2 className="line-clamp-2 text-xs font-bold leading-snug text-slate-100 transition hover:line-clamp-none">
                {data.title}
              </h2>

              <div className="flex items-center justify-between gap-2">
                <p className="flex min-w-0 items-center gap-1.5 truncate text-[11px] font-medium text-slate-400">
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-rose-500" />
                  {data.channelTitle}
                </p>
                <button
                  type="button"
                  onClick={() => void toggleWatch()}
                  title={watchFull ? t('watchFull', { max: MAX_WATCH_ITEMS }) : undefined}
                  className={`relative flex shrink-0 items-center gap-1 rounded-lg border px-2 py-1 text-[10px] font-bold transition ${
                    watched
                      ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400'
                      : 'border-slate-700 text-slate-300 hover:border-rose-500/40 hover:text-rose-300'
                  }`}
                >
                  {watched ? <BookmarkCheck className="h-3 w-3" /> : <Bookmark className="h-3 w-3" />}
                  {watched ? t('watchOn') : watchFull ? t('watchFull', { max: MAX_WATCH_ITEMS }) : t('watchAdd')}
                </button>
              </div>
            </div>

            {/* Navigation Tabs */}
            <div className="grid grid-cols-3 gap-1 rounded-xl border border-slate-800/80 bg-slate-900/80 p-1 backdrop-blur-md">
              <TabButton active={activeTab === 'overview'} onClick={() => setActiveTab('overview')}>
                <BarChart3 className="h-3 w-3" /> {t('tabOverview')}
              </TabButton>
              <TabButton active={activeTab === 'chart'} onClick={() => setActiveTab('chart')}>
                <TrendingUp className="h-3 w-3" /> {t('tabGrowth')}
              </TabButton>
              <TabButton active={activeTab === 'tags'} onClick={() => setActiveTab('tags')}>
                <Tag className="h-3 w-3" /> {t('tabTags')} ({data.tags.length})
              </TabButton>
              <TabButton active={activeTab === 'tools'} onClick={() => setActiveTab('tools')}>
                <Wrench className="h-3 w-3" /> {t('tabTools')}
              </TabButton>
              <TabButton active={activeTab === 'watch'} onClick={() => setActiveTab('watch')}>
                <Bookmark className="h-3 w-3" /> {t('tabWatch')} ({Object.keys(watchlist).length})
              </TabButton>
              <TabButton active={activeTab === 'share'} onClick={() => setActiveTab('share')}>
                <Share2 className="h-3 w-3" /> {t('tabShare')}
              </TabButton>
            </div>

            {/* TAB 1: SUMMARY, OUTLIER & ESTIMATED REVENUE */}
            {activeTab === 'overview' && (
              <div className="space-y-3">
                <OutlierCard data={data} tabId={tabId} />
                <RevenueCard data={data} />

                <div className="grid grid-cols-2 gap-2">
                  <MetricCard
                    icon={<Eye className="h-4 w-4" />}
                    label={t('views')}
                    value={formatNumber(data.viewCount)}
                    accent="border-cyan-500/20 bg-cyan-500/10 text-cyan-400"
                  />
                  <MetricCard
                    icon={<ThumbsUp className="h-4 w-4" />}
                    label={t('likes')}
                    value={data.likeCount ? formatNumber(data.likeCount) : t('hidden')}
                    accent="border-rose-500/20 bg-rose-500/10 text-rose-400"
                  />
                  <MetricCard
                    icon={<Zap className="h-4 w-4" />}
                    label={t('engagement')}
                    value={data.engagementRate != null ? formatPercent(data.engagementRate, lang) : '—'}
                    accent="border-purple-500/20 bg-purple-500/10 text-purple-400"
                  />
                  <MetricCard
                    icon={<ShieldCheck className="h-4 w-4" />}
                    label={t('seoScore')}
                    value={`${data.seoScore}/100`}
                    accent="border-emerald-500/20 bg-emerald-500/10 text-emerald-400"
                  />
                </div>
              </div>
            )}

            {/* TAB 2: GROWTH CHART & VELOCITY */}
            {activeTab === 'chart' && (
              <div className="space-y-3">
                <RealGrowth item={watchlist[data.videoId]} />
                <VelocityChart data={data} />
              </div>
            )}

            {/* TAB 3: TAGS + AI PROMPT */}
            {activeTab === 'tags' && (
              <div className="space-y-3">
                <div className="space-y-3 rounded-2xl border border-slate-800/80 bg-slate-900/60 p-3.5 backdrop-blur-xl">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 font-semibold text-slate-200">
                      <Tag className="h-4 w-4 text-rose-500" /> {t('hiddenTags')}
                    </span>
                    {data.tags.length > 0 && (
                      <button
                        type="button"
                        onClick={() => copy('all-tags', data.tags.join(', '))}
                        className="flex items-center gap-1 text-[11px] font-semibold text-rose-400 transition hover:text-rose-300"
                      >
                        {copied === 'all-tags' ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                        {copied === 'all-tags' ? t('copied') : t('copyAll')}
                      </button>
                    )}
                  </div>

                  {data.tags.length > 0 && (
                    <div className="relative">
                      <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-500" />
                      <input
                        type="text"
                        placeholder={t('searchTags')}
                        value={tagSearch}
                        onChange={(e) => setTagSearch(e.target.value)}
                        className="w-full rounded-xl border border-slate-800 bg-slate-950/80 py-1.5 pl-8 pr-3 text-[11px] text-slate-200 focus:border-rose-500/50 focus:outline-none"
                      />
                    </div>
                  )}

                  {data.tags.length === 0 ? (
                    <p className="rounded-xl border border-slate-800/50 bg-slate-950/50 py-6 text-center italic text-slate-400">
                      {t('noTags')}
                    </p>
                  ) : filteredTags.length === 0 ? (
                    <p className="py-4 text-center text-slate-500">{t('noTagMatch', { q: tagSearch })}</p>
                  ) : (
                    <div className="flex max-h-64 flex-wrap gap-1.5 overflow-y-auto pr-1">
                      {filteredTags.map((tag, idx) => (
                        <button
                          type="button"
                          key={`${tag}-${idx}`}
                          onClick={() => copy(`tag:${tag}`, tag)}
                          title={t('clickToCopy')}
                          className="group flex items-center gap-1 rounded-lg border border-slate-800 bg-slate-950/60 px-2.5 py-1 text-[11px] text-slate-300 transition hover:border-rose-500/40 hover:bg-rose-500/10 hover:text-rose-300"
                        >
                          <span>#{tag}</span>
                          {copied === `tag:${tag}` ? (
                            <Check className="h-2.5 w-2.5 text-emerald-400" />
                          ) : (
                            <Copy className="h-2.5 w-2.5 text-rose-400 opacity-0 transition group-hover:opacity-100" />
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="space-y-3 rounded-2xl border border-rose-500/20 bg-gradient-to-br from-rose-950/30 via-slate-900/80 to-purple-950/30 p-4 backdrop-blur-xl">
                  <div className="flex items-center gap-2 text-xs font-bold text-rose-400">
                    <Sparkles className="h-4 w-4 text-rose-500" /> {t('aiTitle')}
                  </div>
                  <p className="text-[11px] leading-relaxed text-slate-300">{t('aiHint')}</p>

                  <button
                    type="button"
                    onClick={() => copy('prompt', buildAiPrompt(data, lang))}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-rose-600 via-rose-500 to-purple-600 py-2.5 text-xs font-bold text-white shadow-glow-sm transition hover:opacity-90"
                  >
                    {copied === 'prompt' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    {copied === 'prompt' ? t('aiCopied') : t('aiCopy')}
                  </button>
                </div>
              </div>
            )}

            {/* TAB 4: THUMBNAIL, TRANSCRIPT & KEYWORD TOOLS */}
            {activeTab === 'tools' && (
              <div className="space-y-3">
                <ThumbnailTool data={data} />
                <TranscriptTool data={data} tabId={tabId} copied={copied} copy={copy} />
                <KeywordTool data={data} copied={copied} copy={copy} />
              </div>
            )}

            {/* TAB 5: TRACKING LIST */}
            {activeTab === 'watch' && <WatchlistTab list={watchlist} activeVideoId={data.videoId} />}

            {/* TAB 6: SHARE & EXPORT */}
            {activeTab === 'share' && <ShareCard data={data} />}
          </div>
        )}

        <footer className="flex items-center justify-center gap-1.5 pt-1 text-[10px] text-slate-500">
          <span>{t('madeBy')}</span>
          <span>·</span>
          <a
            href="https://github.com/dagcann34/YoutubeAnalyse"
            target="_blank"
            rel="noreferrer"
            className="text-slate-400 underline-offset-2 hover:text-rose-400 hover:underline"
          >
            GitHub
          </a>
          <span>· v{chrome.runtime.getManifest().version}</span>
        </footer>
      </div>
    </LangContext.Provider>
  );
}
