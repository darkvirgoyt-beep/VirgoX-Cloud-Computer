import { securityHeaders, handleOptions } from './_security.js';
import { rateLimit } from './_rate-limit.js';

export default async function handler(req, res) {
  securityHeaders(res);
  if (handleOptions(req, res)) return;

  const rl = rateLimit(req, res, '/api/auth/health');
  if (!rl.allowed) return res.status(429).json({ error: 'rate_limited', retry_after: rl.retryAfter });

  res.status(200).json({
    ok: true,
    service: 'virgox-auth',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    storage: 'supabase'
  });
}
