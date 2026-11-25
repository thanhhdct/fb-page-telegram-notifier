import 'dotenv/config';
import axios from 'axios';
import { setTelegramBotCommands } from '../lib/telegramCommands.js';

const { TG_BOT_TOKEN, PUBLIC_BASE_URL } = process.env;

if (!TG_BOT_TOKEN || !PUBLIC_BASE_URL) {
  console.error('Set TG_BOT_TOKEN and PUBLIC_BASE_URL in .env');
  process.exit(1);
}

const url = `${PUBLIC_BASE_URL.replace(/\/$/, '')}/telegram`;

const res = await axios.post(`https://api.telegram.org/bot${TG_BOT_TOKEN}/setWebhook`, {
  url,
  allowed_updates: ['message'],
});

console.log('setWebhook', res.data);

const cmds = await setTelegramBotCommands();
console.log('setMyCommands', cmds);