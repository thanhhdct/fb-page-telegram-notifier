import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getRedis } from './redis.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STATE_FILE = path.join(__dirname, '..', 'state.json');
const STATE_KEY = 'notifier:state';

const emptyState = () => ({ notifiedMilestones: {}, seenMessages: [] });

export async function loadState() {
  const redis = await getRedis();
  if (redis) {
    const data = await redis.get(STATE_KEY);
    return data ? { ...emptyState(), ...data } : emptyState();
  }
  if (!fs.existsSync(STATE_FILE)) return emptyState();
  return { ...emptyState(), ...JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')) };
}

export async function saveState(state) {
  const redis = await getRedis();
  if (redis) {
    await redis.set(STATE_KEY, state);
    return;
  }
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

const LOCK_KEY = 'notifier:check-lock';
const LOCK_TTL_SEC = 300;

export async function tryAcquireCheckLock() {
  const redis = await getRedis();
  if (!redis) return true;
  const acquired = await redis.set(LOCK_KEY, '1', { nx: true, ex: LOCK_TTL_SEC });
  return acquired === 'OK';
}

export async function releaseCheckLock() {
  const redis = await getRedis();
  if (!redis) return;
  await redis.del(LOCK_KEY);
}