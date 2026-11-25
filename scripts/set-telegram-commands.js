import 'dotenv/config';
import { setTelegramBotCommands } from '../lib/telegramCommands.js';

if (!process.env.TG_BOT_TOKEN) {
  console.error('Set TG_BOT_TOKEN in .env');
  process.exit(1);
}

const res = await setTelegramBotCommands();
console.log(res);