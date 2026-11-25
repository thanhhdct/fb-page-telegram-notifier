import { getPages } from '../lib/facebook.js';

export default async function handler(_req, res) {
  try {
    const pages = await getPages();
    res.status(200).json({ ok: true, pages: pages.length, runtime: 'vercel' });
  } catch {
    res.status(200).json({ ok: true, pages: 0, runtime: 'vercel' });
  }
}