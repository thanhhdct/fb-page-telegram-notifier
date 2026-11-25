import {
  setTelegramWebhook,
  verifyFacebookCallbackReachable,
  subscribeAllPages,
  registerAppPageWebhook,
  getTelegramWebhookInfo,
  diagnoseTelegramToken,
} from '../lib/setupWebhooks.js';

function authorized(req) {
  const auth = req.headers.authorization || '';
  const bearer = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  const key = req.query?.key || bearer;
  const cron = process.env.CRON_SECRET;
  const setup = process.env.WEBHOOK_SETUP_KEY;
  if (setup && key === setup) return true;
  if (cron && key === cron) return true;
  return false;
}

export default async function handler(req, res) {
  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!authorized(req)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const base = (process.env.PUBLIC_BASE_URL || '').replace(/\/$/, '');
  const out = {
    ok: true,
    facebook: { callbackUrl: `${base}/webhook`, verifyEndpoint: null, appSubscription: null, pages: null },
    telegram: { diagnose: null, setWebhook: null, info: null },
    errors: [],
  };

  try {
    out.facebook.verifyEndpoint = await verifyFacebookCallbackReachable();
  } catch (e) {
    out.errors.push({ step: 'facebook.verify', message: e.message, detail: e.response?.data });
  }

  try {
    out.facebook.appSubscription = await registerAppPageWebhook();
  } catch (e) {
    out.errors.push({ step: 'facebook.appSubscription', message: e.message, detail: e.response?.data });
  }

  try {
    out.facebook.pages = await subscribeAllPages();
  } catch (e) {
    out.errors.push({ step: 'facebook.pages', message: e.message, detail: e.response?.data });
  }

  try {
    out.telegram.diagnose = await diagnoseTelegramToken();
  } catch (e) {
    out.errors.push({ step: 'telegram.diagnose', message: e.message, detail: e.response?.data });
  }

  try {
    if (out.telegram.diagnose?.ok) {
      out.telegram.setWebhook = await setTelegramWebhook();
    } else {
      out.errors.push({
        step: 'telegram.setWebhook',
        message: 'Skipped: fix TG_BOT_TOKEN on Vercel (Telegram getMe failed)',
        detail: out.telegram.diagnose,
      });
    }
  } catch (e) {
    out.errors.push({ step: 'telegram.setWebhook', message: e.message, detail: e.response?.data });
  }

  try {
    out.telegram.info = await getTelegramWebhookInfo();
  } catch (e) {
    out.errors.push({ step: 'telegram.info', message: e.message, detail: e.response?.data });
  }

  if (out.errors.length) out.ok = out.errors.length < 5;

  res.status(200).json(out);
}