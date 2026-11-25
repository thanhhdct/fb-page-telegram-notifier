import axios from 'axios';
import { GRAPH_VERSION, MILESTONES, TG_CHAT_ID } from './config.js';
import { getPages, getPostViews, getPageById } from './facebook.js';
import { sendTelegram } from './telegram.js';
import {
  loadState,
  saveState,
  tryAcquireCheckLock,
  releaseCheckLock,
} from './state.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function check500And1kViews(notifyChatId = TG_CHAT_ID, manual = false) {
  const acquired = await tryAcquireCheckLock();
  if (!acquired) {
    if (manual) {
      await sendTelegram('⚠️ Đang quét view lượt trước, vui lòng đợi vài giây...', notifyChatId);
    }
    return { skipped: true };
  }

  try {
    const pages = await getPages();
    if (manual) {
      await sendTelegram(
        `🔍 Đang kiểm tra mốc 500 / 1k view cho ${pages.length} page...`,
        notifyChatId
      );
    }

    let hitCount = 0;
    const batchSize = 5;
    let state = await loadState();

    for (let i = 0; i < pages.length; i += batchSize) {
      const batch = pages.slice(i, i + batchSize);

      await Promise.allSettled(
        batch.map(async (page) => {
          const postsRes = await axios.get(
            `https://graph.facebook.com/${GRAPH_VERSION}/${page.id}/posts`,
            {
              params: {
                fields: 'id,message,permalink_url',
                limit: 3,
                access_token: page.access_token,
              },
            }
          );

          for (const post of postsRes.data.data || []) {
            const views = await getPostViews(post.id, page.access_token);
            const done = state.notifiedMilestones[post.id] || [];
            const newHits = MILESTONES.filter((m) => views >= m && !done.includes(m));

            if (newHits.length > 0) {
              hitCount += newHits.length;
              state.notifiedMilestones[post.id] = [...new Set([...done, ...newHits])];
              await saveState(state);

              const topHit = Math.max(...newHits);
              const preview = (post.message || '(Bài viết không có nội dung chữ)').slice(0, 75);

              await sendTelegram(
                `🔥 <b>[${page.name}]</b> Đạt mốc <b>${topHit.toLocaleString()} view</b>!\n` +
                  `👀 Hiện tại: <b>${views.toLocaleString()}</b> view\n` +
                  `📝 ${preview}${post.message?.length > 75 ? '...' : ''}\n` +
                  `<a href="${post.permalink_url}">Xem bài viết</a>`,
                notifyChatId
              );
            }
          }
        })
      );

      await sleep(300);
    }

    if (manual && hitCount === 0) {
      await sendTelegram(
        '✅ Quét xong: hiện chưa có bài viết mới nào chạm mốc 500 hoặc 1k view chưa báo.',
        notifyChatId
      );
    }

    return { hitCount };
  } catch (err) {
    console.error('[Check Views Error]:', err.response?.data?.error?.message || err.message);
    throw err;
  } finally {
    await releaseCheckLock();
  }
}

export async function handlePageMessagingWebhook(body) {
  if (body.object !== 'page') return;

  const pages = await getPages();
  let state = await loadState();

  for (const entry of body.entry || []) {
    const page = getPageById(pages, entry.id);
    const pageName = page?.name || `Page ${entry.id}`;

    for (const event of entry.messaging || []) {
      const msg = event.message;
      if (!msg || msg.is_echo || !msg.mid) continue;
      if (state.seenMessages.includes(msg.mid)) continue;

      state.seenMessages.push(msg.mid);
      if (state.seenMessages.length > 3000) {
        state.seenMessages = state.seenMessages.slice(-1500);
      }
      await saveState(state);

      const text = msg.text || '[Hình ảnh / File / Sticker]';
      await sendTelegram(
        `💬 <b>[${pageName}]</b> Tin nhắn mới từ <code>${event.sender?.id}</code>:\n` + `"${text}"`
      ).catch(console.error);
    }
  }
}