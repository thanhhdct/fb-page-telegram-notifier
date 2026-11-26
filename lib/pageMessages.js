import { getPages, pageMap } from './facebook.js';
import { sendTelegram } from './telegram.js';
import { loadState, saveState, isMessageSeen, markMessageSeen } from './state.js';
import { formatNotifyDateTime } from './format.js';

function messageLabel(msg) {
  if (msg.text) return msg.text;
  if (msg.attachments?.length) {
    const types = [...new Set(msg.attachments.map((a) => a.type).filter(Boolean))];
    if (types.length) return `[${types.join(', ')}]`;
  }
  return '[Hình ảnh / File / Sticker]';
}

export async function handlePageMessagingWebhook(body) {
  if (body.object !== 'page') {
    console.log('[Webhook] ignored object', body?.object);
    return;
  }

  const entryCount = body.entry?.length ?? 0;
  const eventCount = (body.entry || []).reduce((n, e) => n + (e.messaging?.length || 0), 0);
  console.log('[Webhook] page entries', entryCount, 'messaging events', eventCount);

  let pagesById = new Map();
  try {
    pagesById = pageMap(await getPages());
  } catch (e) {
    console.error('[Webhook] getPages failed', e.response?.data?.error?.message || e.message);
  }

  const state = await loadState();
  let dirty = false;

  for (const entry of body.entry || []) {
    const pageName = pagesById.get(String(entry.id))?.name || `Page ${entry.id}`;

    for (const event of entry.messaging || []) {
      const msg = event.message;
      if (!msg || msg.is_echo || !msg.mid || isMessageSeen(state, msg.mid)) continue;

      markMessageSeen(state, msg.mid);
      dirty = true;

      const text = messageLabel(msg);
      const senderId = event.sender?.id || 'unknown';

      await sendTelegram(
        `💬 <b>[${pageName}]</b> Tin nhắn mới\n` +
          `🕐 ${formatNotifyDateTime()}\n` +
          `Từ <code>${senderId}</code>:\n"${text}"`
      ).catch(console.error);
    }
  }

  if (dirty) await saveState(state);
}