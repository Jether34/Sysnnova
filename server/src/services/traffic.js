// In-memory request traffic tracking for the system administrator dashboard.

const BUCKET_MS = 1000;
const MAX_BUCKETS = 180;
const ACTIVE_WINDOW_MS = 2 * 60 * 1000;
const ACTIVE_PRUNE_MS = 5 * 60 * 1000;

const buckets = [];
const endpoints = new Map();
const active = new Map();

export function recordRequest(path) {
  const now = Date.now();
  const last = buckets[buckets.length - 1];
  if (last && now - last.t < BUCKET_MS) {
    last.count += 1;
  } else {
    buckets.push({ t: now, count: 1 });
    if (buckets.length > MAX_BUCKETS) buckets.shift();
  }
  endpoints.set(path, (endpoints.get(path) || 0) + 1);
}

export function trackActiveUser(userId) {
  if (!userId) return;
  const key = String(userId);
  active.set(key, Date.now());
  const cutoff = Date.now() - ACTIVE_PRUNE_MS;
  for (const [id, ts] of active) {
    if (ts < cutoff) active.delete(id);
  }
}

export function getTrafficStats() {
  const now = Date.now();
  const series = buckets.filter((b) => now - b.t <= ACTIVE_WINDOW_MS).map((b) => ({ t: b.t, count: b.count }));
  const lastMin = series.reduce((sum, b) => sum + b.count, 0);
  const lastBucket = buckets[buckets.length - 1];
  const rpsNow = lastBucket && now - lastBucket.t < BUCKET_MS ? lastBucket.count : 0;
  const activeUsers = [...active].filter(([, ts]) => ts >= now - ACTIVE_WINDOW_MS).length;
  const topEndpoints = [...endpoints.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([path, count]) => ({ path, count }));
  return { series, lastMin, rpsNow, activeUsers, topEndpoints, uptime: Math.floor(process.uptime()) };
}
