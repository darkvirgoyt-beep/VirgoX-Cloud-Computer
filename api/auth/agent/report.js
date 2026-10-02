import { supabase, supabaseAdmin } from './_supabase.js';
import { securityHeaders, handleOptions, sanitizeInput } from './_security.js';
import { rateLimit } from './_rate-limit.js';
import { getSessions, saveSessions } from './_shared.js';

export default async function handler(req, res) {
  securityHeaders(res);
  if (handleOptions(req, res)) return;

  const rl = rateLimit(req, res, '/api/auth/agent/report');
  if (!rl.allowed) return res.status(429).json({ error: 'rate_limited', retry_after: rl.retryAfter });

  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });

  const { command_id, status, result } = req.body || {};
  if (!command_id) return res.status(400).json({ error: 'missing_command_id' });

  const sessions = await getSessions();
  if (!sessions[command_id]) return res.status(404).json({ error: 'not_found' });

  sessions[command_id].status = status || 'done';
  sessions[command_id].result = sanitizeInput(JSON.stringify(result), 50000);
  await saveSessions(sessions);

  res.status(200).json({ status: 'recorded' });
}
