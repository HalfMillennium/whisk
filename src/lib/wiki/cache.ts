// Two-tier cache: fast in-memory Map + persistent localStorage with TTL.
// Keeps whisk polite to Wikimedia (repeated views of the same page don't refetch)
// and snappy across navigations within a session.

const MEM = new Map<string, unknown>();
const PREFIX = 'whisk:cache:';
const DEFAULT_TTL = 1000 * 60 * 60 * 12; // 12h

interface Stored<T> {
  v: T;
  exp: number;
}

function safeLocal(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function cacheGet<T>(key: string): T | undefined {
  if (MEM.has(key)) return MEM.get(key) as T;
  const ls = safeLocal();
  if (!ls) return undefined;
  const raw = ls.getItem(PREFIX + key);
  if (!raw) return undefined;
  try {
    const parsed = JSON.parse(raw) as Stored<T>;
    if (parsed.exp && parsed.exp < Date.now()) {
      ls.removeItem(PREFIX + key);
      return undefined;
    }
    MEM.set(key, parsed.v);
    return parsed.v;
  } catch {
    return undefined;
  }
}

export function cacheSet<T>(key: string, value: T, ttl = DEFAULT_TTL): void {
  MEM.set(key, value);
  const ls = safeLocal();
  if (!ls) return;
  try {
    ls.setItem(PREFIX + key, JSON.stringify({ v: value, exp: Date.now() + ttl }));
  } catch {
    // Storage full or blocked — the in-memory tier still serves this session.
    pruneLocal(ls);
  }
}

function pruneLocal(ls: Storage) {
  // Drop the oldest ~20 whisk cache entries when we hit quota.
  const keys: string[] = [];
  for (let i = 0; i < ls.length; i++) {
    const k = ls.key(i);
    if (k && k.startsWith(PREFIX)) keys.push(k);
  }
  keys.slice(0, 20).forEach((k) => ls.removeItem(k));
}

/** Memoize an async producer under a cache key. */
export async function cached<T>(
  key: string,
  producer: () => Promise<T>,
  ttl = DEFAULT_TTL,
): Promise<T> {
  const hit = cacheGet<T>(key);
  if (hit !== undefined) return hit;
  const value = await producer();
  cacheSet(key, value, ttl);
  return value;
}
