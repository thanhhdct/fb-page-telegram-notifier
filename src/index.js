import 'dotenv/config';
import express from 'express';
import { FB_VERIFY_TOKEN } from '../lib/config.js';
import { check500And1kViews, handlePageMessagingWebhook } from '../lib/checkViews.js';
import { sendTelegram } from '../lib/telegram.js';
import { getPages } from '../lib/facebook.js';

const { PORT = 3000, CHECK_INTERVAL_MINUTES = '5' } = process.env;

const app = express();
app.use(express.json());

app.get('/health', async (_req, res) => {
  try {
    const pages = await getPages();
    res.json({ ok: true, pages: pages.length, runtime: 'local' });
  } catch {
    res.json({ ok: true, pages: 0, runtime: 'local' });
  }
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
  await handlePageMessagingWebhook(req.body).catch(console.error);
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

app.listen(PORT, () => {
  console.log(`Local server http://localhost:${PORT} (use vercel dev for parity)`);

  const intervalMin = Number(CHECK_INTERVAL_MINUTES);
  if (intervalMin > 0 && process.env.FB_LONG_USER_TOKEN) {
    setTimeout(() => check500And1kViews().catch(console.error), 10000);
    setInterval(() => check500And1kViews().catch(console.error), intervalMin * 60 * 1000);
  }
});