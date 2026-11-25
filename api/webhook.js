import { waitUntil } from '@vercel/functions';
import { FB_VERIFY_TOKEN } from '../lib/config.js';
import { handlePageMessagingWebhook } from '../lib/checkViews.js';

export const config = {
  maxDuration: 60,
};

export default async function handler(req, res) {
  if (req.method === 'GET') {
    if (
      req.query['hub.mode'] === 'subscribe' &&
      req.query['hub.verify_token'] === FB_VERIFY_TOKEN
    ) {
      return res.status(200).send(req.query['hub.challenge']);
    }
    return res.status(403).end();
  }

  if (req.method === 'POST') {
    waitUntil(
      handlePageMessagingWebhook(req.body).catch((e) => console.error('[Webhook POST]', e))
    );
    return res.status(200).end();
  }

  res.status(405).end();
}