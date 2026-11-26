export const GRAPH_VERSION = process.env.GRAPH_VERSION || 'v26.0';
export const FB_LONG_USER_TOKEN = process.env.FB_LONG_USER_TOKEN?.trim();
export const FB_APP_ID = process.env.FB_APP_ID?.trim();
export const FB_APP_SECRET = process.env.FB_APP_SECRET?.trim();
export const FB_VERIFY_TOKEN = process.env.FB_VERIFY_TOKEN?.trim();
export const TG_BOT_TOKEN = process.env.TG_BOT_TOKEN?.trim();
export const TG_CHAT_ID = process.env.TG_CHAT_ID?.trim();

/** Các mốc view cần báo (mỗi mốc chỉ báo một lần / bài) */
export const VIEW_MILESTONES = [500, 1_000, 5_000, 10_000];

export const RECENT_POSTS_PER_PAGE = Number(process.env.RECENT_POSTS_PER_PAGE || 10);
export const PAGE_SCAN_CONCURRENCY = Number(process.env.PAGE_SCAN_CONCURRENCY || 8);