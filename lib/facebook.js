import axios from 'axios';
import { GRAPH_VERSION, FB_LONG_USER_TOKEN } from './config.js';
import { getRedis } from './redis.js';

const PAGES_CACHE_KEY = 'notifier:pages';
const PAGES_TTL_SEC = 600;

export async function getPages() {
  const redis = await getRedis();
  if (redis) {
    const cached = await redis.get(PAGES_CACHE_KEY);
    if (cached?.length) return cached;
  }

  const res = await axios.get(`https://graph.facebook.com/${GRAPH_VERSION}/me/accounts`, {
    params: {
      fields: 'id,name,access_token',
      limit: 100,
      access_token: FB_LONG_USER_TOKEN,
    },
  });
  const pages = res.data.data || [];

  if (redis && pages.length) {
    await redis.set(PAGES_CACHE_KEY, pages, { ex: PAGES_TTL_SEC });
  }

  return pages;
}

export function getPageById(pages, pageId) {
  return pages.find((p) => p.id === String(pageId));
}

export async function getPostViews(postId, pageAccessToken) {
  try {
    const res = await axios.get(`https://graph.facebook.com/${GRAPH_VERSION}/${postId}/insights`, {
      params: {
        metric: 'post_media_view',
        access_token: pageAccessToken,
      },
    });
    const val = res.data.data?.[0]?.values?.[0]?.value;
    return typeof val === 'number' ? val : 0;
  } catch {
    return 0;
  }
}