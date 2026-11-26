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

/** Tên người nhắn Page (PSID) — cần Page access token, quyền pages_messaging. */
export async function getMessengerUserDisplayName(psid, pageAccessToken) {
  if (!psid || !pageAccessToken) return null;
  try {
    const res = await axios.get(`https://graph.facebook.com/${GRAPH_VERSION}/${psid}`, {
      params: {
        fields: 'first_name,last_name,name',
        access_token: pageAccessToken,
      },
      timeout: 8000,
    });
    const { first_name, last_name, name } = res.data || {};
    const full = (name || '').trim();
    if (full) return full;
    const parts = [first_name, last_name].map((s) => (s || '').trim()).filter(Boolean);
    return parts.length ? parts.join(' ') : null;
  } catch (err) {
    console.warn(
      `[FB] messenger profile ${psid}:`,
      err.response?.data?.error?.message || err.message
    );
    return null;
  }
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

/** Reels gần đây — dùng post_id (nếu có) để insights/engagement khớp với bài. */
export async function getRecentReels(page, limit) {
  try {
    const res = await axios.get(`https://graph.facebook.com/${GRAPH_VERSION}/${page.id}/video_reels`, {
      params: {
        fields: 'id,title,description,permalink_url,post_id',
        limit,
        access_token: page.access_token,
      },
    });
    const items = res.data.data || [];
    if (items.length) {
      return items.map((r) => ({
        id: String(r.post_id || r.id),
        title: (r.title || r.description || '').trim(),
        permalink_url: r.permalink_url,
      }));
    }
  } catch (err) {
    const msg = err.response?.data?.error?.message || err.message;
    console.warn(`[FB] video_reels (${page.name}): ${msg}`);
  }

  const posts = await getRecentPosts(page, limit);
  return posts.map((p) => ({
    id: p.id,
    title: (p.message || '').trim().split('\n')[0] || '',
    permalink_url: p.permalink_url,
  }));
}

function readSummaryCount(body, field) {
  const n = body?.[field]?.summary?.total_count;
  return typeof n === 'number' ? n : 0;
}

/** Like / comment / share theo post id (batch ≤50). */
export async function getPostEngagementMap(postIds, pageAccessToken) {
  const map = {};
  if (!postIds.length) return map;

  for (let offset = 0; offset < postIds.length; offset += 50) {
    const chunk = postIds.slice(offset, offset + 50);
    const batch = chunk.map((id) => ({
      method: 'GET',
      relative_url: `${id}?fields=likes.summary(true),comments.summary(true),shares`,
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
      const shares = body.shares?.count;
      map[chunk[i]] = {
        likes: readSummaryCount(body, 'likes'),
        comments: readSummaryCount(body, 'comments'),
        shares: typeof shares === 'number' ? shares : 0,
      };
    }
  }

  return map;
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