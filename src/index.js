import 'dotenv/config';
import express from 'express';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STATE_FILE = path.join(__dirname, '..', 'state.json');

const {
  PORT = 3000,
  GRAPH_VERSION = 'v26.0',
  FB_LONG_USER_TOKEN,
  FB_VERIFY_TOKEN,
  TG_BOT_TOKEN,
  TG_CHAT_ID,
  CHECK_INTERVAL_MINUTES = '5',
} = process.env;

const MILESTONES = [500, 1000];

function loadState() {
  if (!fs.existsSync(STATE_FILE)) {
    return { notifiedMilestones: {}, seenMessages: [] };
  }
  return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
}

function saveState(state) {
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

const state = loadState();
let pagesCache = [];
let isCheckingViews = false;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function sendTelegram(text, chatId = TG_CHAT_ID) {
  if (!TG_BOT_TOKEN || !chatId) {
    console.warn('[TG] Missing TG_BOT_TOKEN or chat id, skip send.');
    return;
  }
  await axios.post(`https://api.telegram.org/bot${TG_BOT_TOKEN}/sendMessage`, {
    chat_id: chatId,
    text,
    parse_mode: 'HTML',
    disable_web_page_preview: true,
  });
}

async function refreshPages() {
  const res = await axios.get(`https://graph.facebook.com/${GRAPH_VERSION}/me/accounts`, {
    params: {
      fields: 'id,name,access_token',
      limit: 100,
      access_token: FB_LONG_USER_TOKEN,
    },
  });
  pagesCache = res.data.data || [];
  console.log(`[FB] Loaded ${pagesCache.length} page(s).`);
  return pagesCache;
}

function getPageById(pageId) {
  return pagesCache.find((p) => p.id === String(pageId));
}

async function getPostViews(postId, pageAccessToken) {
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

async function check500And1kViews(notifyChatId = TG_CHAT_ID, manual = false) {
  if (isCheckingViews) {
    if (manual) {
      await sendTelegram('⚠️ Đang quét view lượt trước, vui lòng đợi vài giây...', notifyChatId);
    }
    return;
  }

  isCheckingViews = true;
  try {
    if (!pagesCache.length) await refreshPages();
    if (manual) {
      await sendTelegram(
        `🔍 Đang kiểm tra mốc 500 / 1k view cho ${pagesCache.length} page...`,
        notifyChatId
      );
    }

    let hitCount = 0;
    const batchSize = 5;

    for (let i = 0; i < pagesCache.length; i += batchSize) {
      const batch = pagesCache.slice(i, i + batchSize);

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
              saveState(state);

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
  } catch (err) {
    console.error('[Check Views Error]:', err.response?.data?.error?.message || err.message);
  } finally {
    isCheckingViews = false;
  }
}

const app = express();
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ ok: true, pages: pagesCache.length });
});

app.get('/webhook', (req, res) => {
  if (
    req.query['hub.mode'] === 'subscribe' &&
    req.query['hub.verify_token'] === FB_VERIFY_TOKEN
  ) {
    return res.status(200).send(req.query['hub.challenge']);
  }
  return res.sendStatus(403);
});

app.post('/webhook', async (req, res) => {
  res.sendStatus(200);
  if (req.body.object !== 'page') return;

  if (!pagesCache.length) {
    await refreshPages().catch(console.error);
  }

  for (const entry of req.body.entry || []) {
    const page = getPageById(entry.id);
    const pageName = page?.name || `Page ${entry.id}`;

    for (const event of entry.messaging || []) {
      const msg = event.message;
      if (!msg || msg.is_echo || !msg.mid) continue;
      if (state.seenMessages.includes(msg.mid)) continue;

      state.seenMessages.push(msg.mid);
      if (state.seenMessages.length > 3000) {
        state.seenMessages = state.seenMessages.slice(-1500);
      }
      saveState(state);

      const text = msg.text || '[Hình ảnh / File / Sticker]';
      await sendTelegram(
        `💬 <b>[${pageName}]</b> Tin nhắn mới từ <code>${event.sender?.id}</code>:\n` + `"${text}"`
      ).catch(console.error);
    }
  }
});

app.post('/telegram', async (req, res) => {
  res.sendStatus(200);
  const msg = req.body?.message;
  if (!msg?.text) return;

  const cmd = msg.text.trim();
  if (cmd === '/check' || cmd.startsWith('/check@')) {
    await check500And1kViews(msg.chat.id, true);
  } else if (cmd === '/start' || cmd.startsWith('/start@')) {
    await sendTelegram(
      'Bot FB Page Notifier.\nLệnh: <code>/check</code> — quét mốc 500 / 1k view ngay.',
      msg.chat.id
    );
  }
});

function requireEnv() {
  const missing = ['FB_LONG_USER_TOKEN', 'FB_VERIFY_TOKEN', 'TG_BOT_TOKEN', 'TG_CHAT_ID'].filter(
    (k) => !process.env[k]
  );
  if (missing.length) {
    console.warn(`[Env] Thiếu biến: ${missing.join(', ')}. Một số tính năng sẽ không hoạt động.`);
  }
}

requireEnv();

app.listen(PORT, async () => {
  console.log(`Server running on port ${PORT}`);
  if (FB_LONG_USER_TOKEN) {
    await refreshPages().catch((e) =>
      console.error('[FB] refreshPages failed:', e.response?.data?.error?.message || e.message)
    );
  }

  const intervalMin = Number(CHECK_INTERVAL_MINUTES);
  if (intervalMin > 0 && FB_LONG_USER_TOKEN) {
    setTimeout(() => check500And1kViews().catch(console.error), 10000);
    setInterval(() => {
      check500And1kViews().catch(console.error);
    }, intervalMin * 60 * 1000);
  }
});