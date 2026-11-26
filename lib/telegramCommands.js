import axios from 'axios';
import { TG_BOT_TOKEN } from './config.js';

/** Danh sách lệnh — hiện menu khi user gõ "/" trong chat với bot. */
export const TELEGRAM_BOT_COMMANDS = [
  { command: 'start', description: 'Giới thiệu bot và các mốc view' },
  { command: 'check', description: 'Quét mốc view 100 / 500 / 1K / 5K / 10K ngay' },
];

export async function setTelegramBotCommands() {
  const token = (process.env.TG_BOT_TOKEN || TG_BOT_TOKEN || '').trim();
  if (!token) throw new Error('Missing TG_BOT_TOKEN');

  const res = await axios.post(`https://api.telegram.org/bot${token}/setMyCommands`, {
    commands: TELEGRAM_BOT_COMMANDS,
  });
  return res.data;
}