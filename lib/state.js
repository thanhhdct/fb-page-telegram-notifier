import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getRedis } from './redis.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STATE_FILE = path.join(__dirname, '..', 'state.json');
const STATE_KEY = 'notifier:state';
const MAX_SEEN_MESSAGES = 2000;

const emptyState = () => ({ notifiedMilestones: {}, seenMessageIds: {} });

function normalizeState(raw) {
  const state = { ...emptyState(), ...raw };
  if (raw?.seenMessages?.length && !raw.seenMessageIds) {
    state.seenMessageIds = Object.fromEntries(raw.seenMessages.map((id) => [id, true]));
  }
  delete state.seenMessages;
  return state;
}

export async function loadState() {
  const redis = await getRedis();
  if (redis) {
    const data = await redis.get(STATE_KEY);
    return data ? normalizeState(data) : emptyState();
  }
  if (!fs.existsSync(STATE_FILE)) return emptyState();
  return normalizeState(JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')));
}

export async function saveState(state) {
  const payload = {
    notifiedMilestones: state.notifiedMilestones,
    seenMessageIds: state.seenMessageIds,
  };
  const redis = await getRedis();
  if (redis) {
    await redis.set(STATE_KEY, payload);
    return;
  }
  fs.writeFileSync(STATE_FILE, JSON.stringify(payload, null, 2));
}

export function isMessageSeen(state, mid) {
  return Boolean(state.seenMessageIds?.[mid]);
}

export function markMessageSeen(state, mid) {
  if (!state.seenMessageIds) state.seenMessageIds = {};
  state.seenMessageIds[mid] = true;
  const ids = Object.keys(state.seenMessageIds);
  if (ids.length > MAX_SEEN_MESSAGES) {
    for (const old of ids.slice(0, ids.length - MAX_SEEN_MESSAGES)) {
      delete state.seenMessageIds[old];
    }
  }
}

export function newMilestonesForPost(state, postId, views, milestones) {
  const doneList = state.notifiedMilestones[postId] || [];
  const done = new Set(doneList);
  const maxDone = doneList.length ? Math.max(...doneList) : 0;
  // Không báo mốc thấp hơn mốc cao nhất đã từng báo (tránh spam khi thêm mốc mới).
  return milestones.filter((m) => views >= m && !done.has(m) && m > maxDone);
}

export function recordMilestones(state, postId, hits) {
  const prev = state.notifiedMilestones[postId] || [];
  state.notifiedMilestones[postId] = [...new Set([...prev, ...hits])].sort((a, b) => a - b);
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