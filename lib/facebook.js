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
      fields: 'id,message,permalink_url,created_time',
      limit,
      access_token: page.access_token,
    },
  });
  return res.data.data || [];
}

function parseGraphTime(iso) {
  if (!iso) return 0;
  const t = Date.parse(iso);
  return Number.isFinite(t) ? t : 0;
}

function postRowsFromReels(raw) {
  return raw.map((r) => ({
    id: String(r.post_id || r.id),
    title: (r.title || r.description || '').trim(),
    permalink_url: r.permalink_url,
    created_time: parseGraphTime(r.created_time),
    source: 'reel',
  }));
}

function postRowsFromPosts(raw) {
  return raw.map((p) => ({
    id: String(p.id),
    title: (p.message || '').trim().split('\n')[0] || '',
    permalink_url: p.permalink_url,
    created_time: parseGraphTime(p.created_time),
    source: 'post',
  }));
}

/** Reels + posts gần đây (dedupe theo post id, sort mới nhất, lấy limit). */
export async function getRecentReels(page, limit) {
  const fetchLimit = Math.max(limit, 10);
  let reelRows = [];

  try {
    const res = await axios.get(`https://graph.facebook.com/${GRAPH_VERSION}/${page.id}/video_reels`, {
      params: {
        fields: 'id,title,description,permalink_url,post_id,created_time',
        limit: fetchLimit,
        access_token: page.access_token,
      },
    });
    reelRows = postRowsFromReels(res.data.data || []);
  } catch (err) {
    const msg = err.response?.data?.error?.message || err.message;
    console.warn(`[FB] video_reels (${page.name}): ${msg}`);
  }

  let postRows = [];
  try {
    const posts = await getRecentPosts(page, fetchLimit);
    postRows = postRowsFromPosts(posts);
  } catch (err) {
    const msg = err.response?.data?.error?.message || err.message;
    console.warn(`[FB] posts (${page.name}): ${msg}`);
  }

  const combined = [...reelRows, ...postRows];
  if (!combined.length) return [];

  const byId = new Map();
  for (const row of combined) {
    const prev = byId.get(row.id);
    if (!prev) {
      byId.set(row.id, row);
      continue;
    }
    const prefer =
      row.source === 'reel' && row.title
        ? row
        : prev.source === 'reel' && prev.title
          ? prev
          : row.created_time >= prev.created_time
            ? { ...row, title: row.title || prev.title }
            : { ...prev, title: prev.title || row.title };
    byId.set(row.id, prefer);
  }

  return [...byId.values()]
    .sort((a, b) => b.created_time - a.created_time)
    .slice(0, limit);
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
  const views = {};
  const viewErrors = {};
  if (!postIds.length) return { views, viewErrors };

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
      const id = chunk[i];
      let body = {};
      try {
        body = JSON.parse(res.data[i]?.body || '{}');
      } catch {
        viewErrors[id] = 'Không parse được insights';
        views[id] = 0;
        continue;
      }
      const batchErr = body.error?.message;
      if (batchErr) {
        viewErrors[id] = batchErr;
        views[id] = 0;
        continue;
      }
      const val = body.data?.[0]?.values?.[0]?.value;
      views[id] = typeof val === 'number' ? val : 0;
      if (views[id] === 0 && !body.data?.length) {
        viewErrors[id] = 'Insights không có dữ liệu';
      }
    }
  }

  return { views, viewErrors };
}