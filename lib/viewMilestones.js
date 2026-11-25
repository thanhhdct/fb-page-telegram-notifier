import {
  VIEW_MILESTONES,
  TG_CHAT_ID,
  RECENT_POSTS_PER_PAGE,
  PAGE_SCAN_CONCURRENCY,
} from './config.js';
import { getPages, getRecentPosts, getPostViewsMap } from './facebook.js';
import { sendTelegram } from './telegram.js';
import {
  loadState,
  saveState,
  tryAcquireCheckLock,
  releaseCheckLock,
  newMilestonesForPost,
  recordMilestones,
} from './state.js';
import { formatInt, formatMilestoneList, postPreview } from './format.js';

async function pmap(items, concurrency, fn) {
  const results = [];
  for (let i = 0; i < items.length; i += concurrency) {
    const chunk = items.slice(i, i + concurrency);
    results.push(...(await Promise.allSettled(chunk.map(fn))));
  }
  return results;
}

export async function scanViewMilestones(notifyChatId = TG_CHAT_ID, manual = false) {
  if (!(await tryAcquireCheckLock())) {
    if (manual) {
      await sendTelegram('⚠️ Đang quét view trước đó, thử lại sau vài giây.', notifyChatId);
    }
    return { skipped: true };
  }

  let hitCount = 0;
  try {
    const pages = await getPages();
    if (manual) {
      await sendTelegram(
        `🔍 Quét mốc view ${formatMilestoneList(VIEW_MILESTONES)} — ${pages.length} page.`,
        notifyChatId
      );
    }

    const state = await loadState();

    await pmap(pages, PAGE_SCAN_CONCURRENCY, async (page) => {
      const posts = await getRecentPosts(page, RECENT_POSTS_PER_PAGE);
      if (!posts.length) return;

      const viewsMap = await getPostViewsMap(
        posts.map((p) => p.id),
        page.access_token
      );

      for (const post of posts) {
        const views = viewsMap[post.id] ?? 0;
        const newHits = newMilestonesForPost(state, post.id, views, VIEW_MILESTONES);
        if (!newHits.length) continue;

        hitCount += newHits.length;
        recordMilestones(state, post.id, newHits);
        await saveState(state);

        await sendTelegram(
          `🔥 <b>[${page.name}]</b> Mốc mới: <b>${formatMilestoneList(newHits)}</b> view\n` +
            `👀 Hiện tại: <b>${formatInt(views)}</b> view\n` +
            `📝 ${postPreview(post.message)}\n` +
            `<a href="${post.permalink_url}">Xem bài viết</a>`,
          notifyChatId
        );
      }
    });

    if (manual && hitCount === 0) {
      await sendTelegram('✅ Quét xong — không có mốc view mới.', notifyChatId);
    }

    return { hitCount };
  } catch (err) {
    console.error('[View scan]', err.response?.data?.error?.message || err.message);
    throw err;
  } finally {
    await releaseCheckLock();
  }
}

/** Giữ tên cũ cho import hiện có */
export const check500And1kViews = scanViewMilestones;