import axios from 'axios';
import { GRAPH_VERSION, FB_LONG_USER_TOKEN, FB_VERIFY_TOKEN, TG_BOT_TOKEN } from './config.js';
import { getPages } from './facebook.js';
import { setTelegramBotCommands } from './telegramCommands.js';

const WEBHOOK_BASE = (process.env.PUBLIC_BASE_URL || '').replace(/\/$/, '');

function botToken() {
  return (process.env.TG_BOT_TOKEN || TG_BOT_TOKEN || '').trim();
}

export async function diagnoseTelegramToken() {
  const token = botToken();
  if (!token) return { present: false, shapeOk: false };
  const shapeOk = /^\d+:[A-Za-z0-9_-]+$/.test(token);
  try {
    const res = await axios.get(`https://api.telegram.org/bot${token}/getMe`);
    return { present: true, shapeOk, ok: res.data?.ok, username: res.data?.result?.username };
  } catch (e) {
    const d = e.response?.data;
    return {
      present: true,
      shapeOk,
      ok: false,
      httpStatus: e.response?.status,
      description: d?.description,
      errorCode: d?.error_code,
    };
  }
}

export async function setTelegramWebhook() {
  const token = botToken();
  if (!token || !WEBHOOK_BASE) {
    throw new Error('Missing TG_BOT_TOKEN or PUBLIC_BASE_URL');
  }
  const url = `${WEBHOOK_BASE}/telegram`;
  const res = await axios.post(`https://api.telegram.org/bot${token}/setWebhook`, {
    url,
    allowed_updates: ['message'],
  });
  return { url, ...res.data };
}

export async function registerTelegramBotCommands() {
  return setTelegramBotCommands();
}

export async function verifyFacebookCallbackReachable() {
  if (!FB_VERIFY_TOKEN || !WEBHOOK_BASE) {
    throw new Error('Missing FB_VERIFY_TOKEN or PUBLIC_BASE_URL');
  }
  const challenge = 'webhook-setup-ping';
  const res = await axios.get(`${WEBHOOK_BASE}/webhook`, {
    params: {
      'hub.mode': 'subscribe',
      'hub.verify_token': FB_VERIFY_TOKEN,
      'hub.challenge': challenge,
    },
    validateStatus: () => true,
  });
  return {
    ok: res.status === 200 && String(res.data) === challenge,
    status: res.status,
    body: String(res.data).slice(0, 80),
  };
}

export async function subscribeAllPages() {
  if (!FB_LONG_USER_TOKEN) throw new Error('Missing FB_LONG_USER_TOKEN');
  const pages = await getPages();
  const results = [];

  for (const page of pages) {
    try {
      const res = await axios.post(
        `https://graph.facebook.com/${GRAPH_VERSION}/${page.id}/subscribed_apps`,
        null,
        {
          params: {
            subscribed_fields: 'messages',
            access_token: page.access_token,
          },
        }
      );
      results.push({ pageId: page.id, name: page.name, ok: true, data: res.data });
    } catch (e) {
      const err = e.response?.data?.error || { message: e.message };
      results.push({ pageId: page.id, name: page.name, ok: false, error: err });
    }
  }

  return { pageCount: pages.length, results };
}

export async function registerAppPageWebhook() {
  if (!FB_LONG_USER_TOKEN || !FB_VERIFY_TOKEN || !WEBHOOK_BASE) {
    throw new Error('Missing FB credentials or PUBLIC_BASE_URL');
  }

  let appId;
  try {
    const dbg = await axios.get(`https://graph.facebook.com/${GRAPH_VERSION}/debug_token`, {
      params: {
        input_token: FB_LONG_USER_TOKEN,
        access_token: FB_LONG_USER_TOKEN,
      },
    });
    appId = dbg.data?.data?.app_id;
  } catch (e) {
    return { attempted: false, reason: 'debug_token failed', detail: e.response?.data?.error || e.message };
  }

  if (!appId) {
    return { attempted: false, reason: 'Could not resolve app_id from user token' };
  }

  try {
    const res = await axios.post(
      `https://graph.facebook.com/${GRAPH_VERSION}/${appId}/subscriptions`,
      null,
      {
        params: {
          object: 'page',
          callback_url: `${WEBHOOK_BASE}/webhook`,
          verify_token: FB_VERIFY_TOKEN,
          fields: 'messages',
          access_token: FB_LONG_USER_TOKEN,
        },
      }
    );
    return { attempted: true, ok: true, appId, data: res.data };
  } catch (e) {
    const err = e.response?.data?.error || { message: e.message };
    return { attempted: true, ok: false, appId, error: err };
  }
}

export async function getTelegramWebhookInfo() {
  const token = botToken();
  if (!token) throw new Error('Missing TG_BOT_TOKEN');
  const res = await axios.get(`https://api.telegram.org/bot${token}/getWebhookInfo`);
  return res.data;
}