import { supabase, supabaseAdmin } from './_supabase.js';
import { securityHeaders, handleOptions } from './_security.js';
import { rateLimit } from './_rate-limit.js';
import { getSessions, saveSessions } from './_shared.js';

export default async function handler(req, res) {
  securityHeaders(res);
  if (handleOptions(req, res)) return;

  const rl = rateLimit(req, res, '/api/auth/session/claim');
  if (!rl.allowed) return res.status(429).json({ error: 'rate_limited', retry_after: rl.retryAfter });

  if (req.method !== 'GET') return res.status(405).json({ error: 'method_not_allowed' });

  const url = new URL(req.url, `http://${req.headers.host}`);
  const claim = url.searchParams.get('claim');
  if (!claim) return res.status(400).json({ error: 'missing_claim' });

  const sessions = await getSessions();
  const entry = sessions[claim];
  if (!entry || new Date(entry.expires).getTime() < Date.now()) {
    return res.status(404).json({ error: 'invalid_claim' });
  }

  delete sessions[claim];
  await saveSessions(sessions);

  res.status(200).json(entry.data || {});
}
