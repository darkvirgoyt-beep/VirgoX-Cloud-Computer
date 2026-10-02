import { supabase, supabaseAdmin } from './_supabase.js';
import { securityHeaders, handleOptions, extractToken, sanitizeInput } from './_security.js';
import { rateLimit } from './_rate-limit.js';
import { genToken, getSessions, saveSessions } from './_shared.js';

export default async function handler(req, res) {
  securityHeaders(res);
  if (handleOptions(req, res)) return;

  const rl = rateLimit(req, res, '/api/auth/agent/command');
  if (!rl.allowed) return res.status(429).json({ error: 'rate_limited', retry_after: rl.retryAfter });

  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });

  const token = extractToken(req);
  if (!token) return res.status(401).json({ error: 'missing_token' });

  const sessions = await getSessions();
  const session = sessions[token];
  if (!session || new Date(session.expires).getTime() < Date.now()) {
    return res.status(401).json({ error: 'invalid_token' });
  }

  const cmdId = genToken();
  const { command } = req.body || {};
  sessions[cmdId] = { type: 'agent_cmd', email: session.email, command: sanitizeInput(command, 5000), created: Date.now(), expires: Date.now() + 5*60*1000, status: 'pending' };
  await saveSessions(sessions);

  res.status(200).json({ command_id: cmdId });
}
