import type { Lang } from '../i18n';

export interface Settings {
  /** 'auto' follows the browser language */
  lang: Lang | 'auto';
  /** Views/day + outlier badges on YouTube thumbnails */
  badges: boolean;
}

const KEY = 'settings';
export const DEFAULT_SETTINGS: Settings = { lang: 'auto', badges: true };

export async function getSettings(): Promise<Settings> {
  const stored = await chrome.storage.local.get(KEY);
  return { ...DEFAULT_SETTINGS, ...(stored[KEY] as Partial<Settings> | undefined) };
}

export async function updateSettings(patch: Partial<Settings>): Promise<void> {
  const current = await getSettings();
  await chrome.storage.local.set({ [KEY]: { ...current, ...patch } });
}

/** Calls `listener` with the new settings whenever they change. Returns an unsubscribe function. */
export function onSettingsChanged(listener: (settings: Settings) => void): () => void {
  const handler = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
    if (area === 'local' && changes[KEY]) listener({ ...DEFAULT_SETTINGS, ...changes[KEY].newValue });
  };
  chrome.storage.onChanged.addListener(handler);
  return () => chrome.storage.onChanged.removeListener(handler);
}
