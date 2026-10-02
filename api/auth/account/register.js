import { supabase, supabaseAdmin } from './_supabase.js';
import { securityHeaders, handleOptions, validateEmail, validatePassword } from './_security.js';
import { rateLimit } from './_rate-limit.js';
import { getAccounts, saveAccounts, hashPassword, genSalt } from './_shared.js';

export default async function handler(req, res) {
  securityHeaders(res);
  if (handleOptions(req, res)) return;

  const rl = rateLimit(req, res, '/api/auth/account/register');
  if (!rl.allowed) return res.status(429).json({ error: 'rate_limited', retry_after: rl.retryAfter });

  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });

  const { email, password } = req.body || {};
  if (!validateEmail(email)) return res.status(400).json({ error: 'invalid_email' });
  const pwCheck = validatePassword(password);
  if (!pwCheck.valid) return res.status(400).json({ error: pwCheck.reason });

  const accounts = await getAccounts();
  if (accounts[email]) return res.status(409).json({ error: 'email_exists' });

  const salt = genSalt();
  accounts[email] = { email, salt, hash: hashPassword(password, salt), created_at: new Date().toISOString() };
  await saveAccounts(accounts);

  res.status(201).json({ status: 'registered', email });
}
