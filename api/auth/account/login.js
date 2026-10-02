import { supabase, supabaseAdmin } from './_supabase.js';
import { securityHeaders, handleOptions, validateEmail, validatePassword } from './_security.js';
import { rateLimit } from './_rate-limit.js';
import { getAccounts, hashPassword, genToken, getSessions, saveSessions } from './_shared.js';

export default async function handler(req, res) {
  securityHeaders(res);
  if (handleOptions(req, res)) return;

  const rl = rateLimit(req, res, '/api/auth/account/login');
  if (!rl.allowed) return res.status(429).json({ error: 'rate_limited', retry_after: rl.retryAfter });

  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });

  const { email, password } = req.body || {};
  if (!validateEmail(email)) return res.status(400).json({ error: 'invalid_email' });
  const pwCheck = validatePassword(password);
  if (!pwCheck.valid) return res.status(400).json({ error: pwCheck.reason });

  const accounts = await getAccounts();
  const account = accounts[email];
  if (!account || hashPassword(password, account.salt) !== account.hash) {
    return res.status(401).json({ error: 'invalid_credentials' });
  }

  const session_token = genToken();
  const sessions = await getSessions();
  sessions[session_token] = { email, created: Date.now(), expires: Date.now() + 30*24*60*60*1000 };
  await saveSessions(sessions);

  res.status(200).json({ session_token, email });
}
