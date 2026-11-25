import axios from 'axios';
import { TG_BOT_TOKEN, TG_CHAT_ID } from './config.js';

export async function sendTelegram(text, chatId = TG_CHAT_ID) {
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