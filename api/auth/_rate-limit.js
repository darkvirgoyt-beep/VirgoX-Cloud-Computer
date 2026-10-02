/**
 * Rate Limiter for Vercel Serverless Functions
 * Uses in-memory store with sliding window (resets on cold start - acceptable for serverless)
 * For production: replace with Vercel KV / Upstash Redis
 */

const WINDOW_MS = 60 * 1000; // 1 minute window
const LIMITS = {
  // Auth endpoints - strict
  '/api/auth/device/code': { max: 10, windowMs: 60 * 1000 },      // 10 req/min per IP
  '/api/auth/device/approve': { max: 20, windowMs: 60 * 1000 },    // 20 req/min per IP
  '/api/auth/token': { max: 30, windowMs: 60 * 1000 },             // 30 req/min per IP
  '/api/auth/account/register': { max: 5, windowMs: 60 * 60 * 1000 }, // 5 req/hour per IP
  '/api/auth/account/login': { max: 10, windowMs: 15 * 60 * 1000 },  // 10 req/15min per IP
  '/api/auth/account/me': { max: 60, windowMs: 60 * 1000 },         // 60 req/min per IP
  '/api/auth/account/logout': { max: 30, windowMs: 60 * 1000 },
  '/api/auth/session/push': { max: 10, windowMs: 60 * 1000 },
  '/api/auth/session/claim': { max: 20, windowMs: 60 * 1000 },
  '/api/auth/session/revoke': { max: 10, windowMs: 60 * 1000 },
  '/api/auth/shell/*': { max: 100, windowMs: 60 * 1000 },
  '/api/auth/agent/*': { max: 50, windowMs: 60 * 1000 },
  // Default fallback
  'default': { max: 100, windowMs: 60 * 1000 }
};

// In-memory store: Map<key, { count: number, resetAt: number }>
const store = new Map();

function getClientKey(req, endpoint) {
  // Use IP + endpoint as key
  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
             req.headers['x-real-ip'] ||
             'unknown';
  return `${ip}:${endpoint}`;
}

function matchEndpoint(path) {
  // Exact match first
  if (LIMITS[path]) return LIMITS[path];
  // Pattern match for wildcards
  for (const [pattern, config] of Object.entries(LIMITS)) {
    if (pattern.endsWith('*')) {
      const prefix = pattern.slice(0, -1);
      if (path.startsWith(prefix)) return config;
    }
  }
  return LIMITS.default;
}

export function rateLimit(req, res, endpoint) {
  const config = matchEndpoint(endpoint);
  const key = getClientKey(req, endpoint);
  const now = Date.now();

  let entry = store.get(key);
  if (!entry || entry.resetAt <= now) {
    entry = { count: 0, resetAt: now + config.windowMs };
    store.set(key, entry);
  }

  entry.count++;

  // Set rate limit headers
  res.setHeader('X-RateLimit-Limit', config.max);
  res.setHeader('X-RateLimit-Remaining', Math.max(0, config.max - entry.count));
  res.setHeader('X-RateLimit-Reset', Math.ceil(entry.resetAt / 1000));

  if (entry.count > config.max) {
    const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
    res.setHeader('Retry-After', retryAfter);
    return { allowed: false, retryAfter, limit: config.max, remaining: 0 };
  }

  return { allowed: true, limit: config.max, remaining: config.max - entry.count };
}

// Cleanup old entries periodically (every 5 minutes)
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store.entries()) {
    if (entry.resetAt <= now) store.delete(key);
  }
}, 5 * 60 * 1000);

// Export for testing
export const _store = store;
export const _resetStore = () => store.clear();
