import { supabase, supabaseAdmin } from './_supabase.js';
import { securityHeaders, handleOptions, extractToken } from './_security.js';
import { rateLimit } from './_rate-limit.js';
import { getSessions } from './_shared.js';

export default async function handler(req, res) {
  securityHeaders(res);
  if (handleOptions(req, res)) return;

  const rl = rateLimit(req, res, '/api/auth/agent/poll');
  if (!rl.allowed) return res.status(429).json({ error: 'rate_limited', retry_after: rl.retryAfter });

  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });

  const token = extractToken(req);
  if (!token) return res.status(401).json({ error: 'missing_token' });

  const sessions = await getSessions();
  const session = sessions[token];
  if (!session || new Date(session.expires).getTime() < Date.now()) {
    return res.status(401).json({ error: 'invalid_token' });
  }

  const pending = Object.entries(sessions)
    .filter(([k,v]) => v.type === 'agent_cmd' && v.email === session.email && v.status === 'pending')
    .map(([k,v]) => ({ command_id: k, command: v.command }));

  res.status(200).json({ pending });
}
