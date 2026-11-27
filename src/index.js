import 'dotenv/config';
import express from 'express';
import { FB_VERIFY_TOKEN } from '../lib/config.js';
import { scanViewMilestones } from '../lib/viewMilestones.js';
import { handlePageMessagingWebhook } from '../lib/pageMessages.js';
import { sendTelegram } from '../lib/telegram.js';
import { getPages } from '../lib/facebook.js';
import { VIEW_MILESTONES } from '../lib/config.js';
import { formatMilestoneRanges } from '../lib/format.js';

const { PORT = 3000, CHECK_INTERVAL_MINUTES = '5' } = process.env;

const app = express();
app.use(express.json());

app.get('/health', async (_req, res) => {
  const pages = await getPages().catch(() => []);
  res.json({ ok: true, pages: pages.length, runtime: 'local' });
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
    await scanViewMilestones(msg.chat.id, true);
  } else if (cmd === '/start' || cmd.startsWith('/start@')) {
    await sendTelegram(
      `FB Page Notifier.\nMốc view: ${formatMilestoneRanges(VIEW_MILESTONES)}\nLệnh: /check`,
      msg.chat.id
    );
  }
});

app.listen(PORT, () => {
  console.log(`http://localhost:${PORT}`);

  const intervalMin = Number(CHECK_INTERVAL_MINUTES);
  if (intervalMin > 0 && process.env.FB_LONG_USER_TOKEN) {
    setTimeout(() => scanViewMilestones().catch(console.error), 10_000);
    setInterval(() => scanViewMilestones().catch(console.error), intervalMin * 60_000);
  }
});