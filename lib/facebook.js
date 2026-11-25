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

export function pageMap(pages) {
  return new Map(pages.map((p) => [String(p.id), p]));
}

export async function getRecentPosts(page, limit) {
  const res = await axios.get(`https://graph.facebook.com/${GRAPH_VERSION}/${page.id}/posts`, {
    params: {
      fields: 'id,message,permalink_url',
      limit,
      access_token: page.access_token,
    },
  });
  return res.data.data || [];
}

/** Một request batch cho nhiều bài (tối đa 50 sub-request / lần). */
export async function getPostViewsMap(postIds, pageAccessToken) {
  const map = {};
  if (!postIds.length) return map;

  for (let offset = 0; offset < postIds.length; offset += 50) {
    const chunk = postIds.slice(offset, offset + 50);
    const batch = chunk.map((id) => ({
      method: 'GET',
      relative_url: `${id}/insights?metric=post_media_view`,
    }));

    const res = await axios.post(`https://graph.facebook.com/${GRAPH_VERSION}/`, null, {
      params: {
        batch: JSON.stringify(batch),
        access_token: pageAccessToken,
      },
    });

    for (let i = 0; i < chunk.length; i++) {
      let body = {};
      try {
        body = JSON.parse(res.data[i]?.body || '{}');
      } catch {
        /* ignore */
      }
      const val = body.data?.[0]?.values?.[0]?.value;
      map[chunk[i]] = typeof val === 'number' ? val : 0;
    }
  }

  return map;
}