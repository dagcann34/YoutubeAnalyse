export interface VideoAnalytics {
  videoId: string;
  title: string;
  channelTitle: string;
  channelId: string;
  viewCount: number;
  /** null when YouTube does not expose the value on the page */
  likeCount: number | null;
  /** null until the comments section has loaded on the page */
  commentCount: number | null;
  publishedAt: string;
  tags: string[];
  /** Percentage, e.g. 4.25 means 4.25% */
  engagementRate: number | null;
  isShort: boolean;
  /** 0-100, from tag count, title length, description length and views */
  seoScore: number;
  descriptionLength: number;
  /** Lifetime average: views / hours since publication (0 when the date is unknown) */
  viewsPerHour: number;
  /** USD range from views x RPM, see RPM_RANGES in utils/youtube.ts */
  estimatedRevenue: { min: number; max: number };
  /** Whole days since publication */
  daysOld: number;
}

/** Side panel -> content script */
export interface GetVideoDataMessage {
  type: 'GET_VIDEO_DATA';
}

/** Background -> content script */
export interface UrlChangedMessage {
  type: 'URL_CHANGED';
  url: string;
}

/** Content script -> side panel. `payload` is null when the tab left a video page. */
export interface VideoDataUpdatedMessage {
  type: 'VIDEO_DATA_UPDATED';
  payload: VideoAnalytics | null;
}

/** Side panel -> content script: open YouTube's transcript panel and read it. */
export interface GetTranscriptMessage {
  type: 'GET_TRANSCRIPT';
}

/** Side panel -> content script: median views of the channel's recent uploads. */
export interface GetChannelStatsMessage {
  type: 'GET_CHANNEL_STATS';
}

/** Side panel -> background: re-check view counts of tracked videos now. */
export interface RefreshWatchlistMessage {
  type: 'REFRESH_WATCHLIST';
}

export type RuntimeMessage =
  | GetVideoDataMessage
  | UrlChangedMessage
  | VideoDataUpdatedMessage
  | GetTranscriptMessage
  | GetChannelStatsMessage
  | RefreshWatchlistMessage;

export interface TranscriptSegment {
  /** As shown by YouTube, e.g. "1:02:15" */
  time: string;
  text: string;
}

export type TranscriptResponse = { ok: true; segments: TranscriptSegment[] } | { ok: false; error: string };

export interface ChannelStats {
  /** Median views of the channel's recent uploads of the same format, excluding this video */
  medianViews: number;
  sampleSize: number;
}

export type ChannelStatsResponse = { ok: true; stats: ChannelStats } | { ok: false; error: string };

export type VideoDataResponse =
  | { ok: true; data: VideoAnalytics }
  | { ok: false; error: string };
