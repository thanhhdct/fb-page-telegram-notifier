import { waitUntil } from '@vercel/functions';
import { scanViewMilestones } from '../lib/viewMilestones.js';
import { sendTelegram } from '../lib/telegram.js';
import { VIEW_MILESTONES } from '../lib/config.js';
import { formatMilestoneRanges } from '../lib/format.js';

export const config = {
  maxDuration: 60,
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).end();
  }

  const msg = req.body?.message;
  if (msg?.text) {
    const cmd = msg.text.trim();
    if (cmd === '/check' || cmd.startsWith('/check@')) {
      waitUntil(scanViewMilestones(msg.chat.id, true));
    } else if (cmd === '/start' || cmd.startsWith('/start@')) {
      waitUntil(
        sendTelegram(
          `FB Page Notifier.\nMốc view: <b>${formatMilestoneRanges(VIEW_MILESTONES)}</b>\n` +
            'Lệnh: <code>/check</code> — quét ngay.',
          msg.chat.id
        )
      );
    }
  }

  return res.status(200).end();
}