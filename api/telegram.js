import { waitUntil } from '@vercel/functions';
import { check500And1kViews } from '../lib/checkViews.js';
import { sendTelegram } from '../lib/telegram.js';

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
      waitUntil(check500And1kViews(msg.chat.id, true));
    } else if (cmd === '/start' || cmd.startsWith('/start@')) {
      waitUntil(
        sendTelegram(
          'Bot FB Page Notifier.\nLệnh: <code>/check</code> — quét mốc 500 / 1k view ngay.',
          msg.chat.id
        )
      );
    }
  }

  return res.status(200).end();
}