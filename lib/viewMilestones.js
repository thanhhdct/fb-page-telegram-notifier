import {
  VIEW_MILESTONES,
  TG_CHAT_ID,
  RECENT_POSTS_PER_PAGE,
  PAGE_SCAN_CONCURRENCY,
} from './config.js';
import { getPages, getRecentReels, getPostViewsMap, getPostEngagementMap } from './facebook.js';
import { sendTelegram } from './telegram.js';
import {
  loadState,
  saveState,
  tryAcquireCheckLock,
  releaseCheckLock,
  newMilestonesForPost,
  recordMilestones,
} from './state.js';
import { formatMilestoneList, formatMilestoneAlert } from './format.js';

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
      const reels = await getRecentReels(page, RECENT_POSTS_PER_PAGE);
      if (!reels.length) return;

      const ids = reels.map((r) => r.id);
      const [viewsMap, engagementMap] = await Promise.all([
        getPostViewsMap(ids, page.access_token),
        getPostEngagementMap(ids, page.access_token),
      ]);

      for (const reel of reels) {
        const views = viewsMap[reel.id] ?? 0;
        const newHits = newMilestonesForPost(state, reel.id, views, VIEW_MILESTONES);
        if (!newHits.length) continue;

        const engagement = engagementMap[reel.id] || { likes: 0, comments: 0, shares: 0 };

        hitCount += newHits.length;
        recordMilestones(state, reel.id, newHits);
        await saveState(state);

        await sendTelegram(
          formatMilestoneAlert({
            pageName: page.name,
            title: reel.title,
            newHits,
            views,
            likes: engagement.likes,
            comments: engagement.comments,
            shares: engagement.shares,
            url: reel.permalink_url,
          }),
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