/**
 * Soft cooling alarm helper.
 *
 * For each in-progress cooling log we want two local notifications:
 *   • 75 min after started_at  →  "15 min left to reach target°C — record temp soon"
 *   • 90 min after started_at  →  "Cooling overdue — record temp now"
 *
 * These are scheduled in-tab via setTimeout. setTimeout cannot fire when the
 * tab is fully closed, so on every page load we call `reconcile(logs)` which
 * (a) trims state for finished/deleted logs and (b) re-schedules any timers
 * that still lie in the future. A notified-set in localStorage prevents
 * duplicate firings across reloads.
 */

const NOTIFIED_KEY = 'jkhive.cooling.notified';

const readNotified = () => {
  try { return JSON.parse(localStorage.getItem(NOTIFIED_KEY)) || {}; } catch { return {}; }
};
const writeNotified = (m) => localStorage.setItem(NOTIFIED_KEY, JSON.stringify(m));

// Per-tab map of pending timeouts keyed by `${id}.${label}` so we never schedule
// the same alarm twice within one session.
const pending = new Map();

const fire = (id, label, message) => {
  const n = readNotified();
  if (n[`${id}.${label}`]) return;
  n[`${id}.${label}`] = Date.now();
  writeNotified(n);
  if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
    try {
      new Notification(message.title, {
        body: message.body,
        tag: `cooling-${id}-${label}`,
      });
    } catch (_) { /* ignore */ }
  }
};

const schedule = (id, label, fireAt, message) => {
  const ms = fireAt - Date.now();
  const key = `${id}.${label}`;
  if (ms <= 0 || pending.has(key)) return;
  const t = setTimeout(() => { pending.delete(key); fire(id, label, message); }, ms);
  pending.set(key, t);
};

export const requestPermission = async () => {
  if (typeof window === 'undefined' || !('Notification' in window)) return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;
  try {
    const r = await Notification.requestPermission();
    return r === 'granted';
  } catch { return false; }
};

export const scheduleForLog = (log) => {
  if (!log || !log.started_at || log.status !== 'cooling') return;
  const startMs = new Date(log.started_at).getTime();
  const target = log.target_temp_c ?? 8;
  const itemName = log.item_name || 'Cooling item';
  const n = readNotified();
  if (!n[`${log.id}.warn`]) {
    schedule(log.id, 'warn', startMs + 75 * 60 * 1000, {
      title: `${itemName} — 15 min left`,
      body: `Cool to ${target}°C or lower in the next 15 minutes.`,
    });
  }
  if (!n[`${log.id}.over`]) {
    schedule(log.id, 'over', startMs + 90 * 60 * 1000, {
      title: `${itemName} OVERDUE`,
      body: `Cooling has exceeded 90 min — record the temperature now.`,
    });
  }
};

export const clearForLog = (id) => {
  for (const key of [`${id}.warn`, `${id}.over`]) {
    const t = pending.get(key);
    if (t) { clearTimeout(t); pending.delete(key); }
  }
  const n = readNotified();
  delete n[`${id}.warn`];
  delete n[`${id}.over`];
  writeNotified(n);
};

/** Trim state for completed/deleted logs and re-schedule any future alarms. */
export const reconcile = (logs) => {
  const live = (logs || []).filter(l => l.status === 'cooling');
  const liveIds = new Set(live.map(l => l.id));
  const n = readNotified();
  let changed = false;
  for (const k of Object.keys(n)) {
    const id = k.split('.')[0];
    if (!liveIds.has(id)) { delete n[k]; changed = true; }
  }
  if (changed) writeNotified(n);
  live.forEach(scheduleForLog);
};

/**
 * Severity bucket based on minutes since started_at:
 *   ok   → < 75 min
 *   warn → 75–90 min
 *   over → ≥ 90 min
 */
export const ageStatus = (startedAt) => {
  if (!startedAt) return 'ok';
  const m = (Date.now() - new Date(startedAt).getTime()) / 60000;
  if (m < 75) return 'ok';
  if (m < 90) return 'warn';
  return 'over';
};

/** Compute the worst (most urgent) bucket across an array of cooling logs. */
export const worstStatus = (logs) => {
  let worst = null;
  for (const l of (logs || [])) {
    if (l.status !== 'cooling') continue;
    const s = ageStatus(l.started_at);
    if (s === 'over') return 'over';
    if (s === 'warn' && worst !== 'over') worst = 'warn';
    if (s === 'ok' && !worst) worst = 'ok';
  }
  return worst;
};

export const STATUS_COLOR = {
  ok:   '#0A84C9', // calm blue
  warn: '#FF9500', // orange
  over: '#FF3B30', // red
};

export const STATUS_LABEL = {
  ok:   'On track',
  warn: 'Hurry — 15 min',
  over: 'OVERDUE',
};
