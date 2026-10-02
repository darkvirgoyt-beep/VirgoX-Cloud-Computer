import { supabase, supabaseAdmin } from './_supabase.js';
import { securityHeaders, handleOptions, validateEmail, validatePassword } from './_security.js';
import { rateLimit } from './_rate-limit.js';
import { getDeviceCodes, saveDeviceCodes, getAccounts, saveAccounts, hashPassword, genSalt, genToken, getSessions, saveSessions } from './_shared.js';

export default async function handler(req, res) {
  securityHeaders(res);
  if (handleOptions(req, res)) return;

  const rl = rateLimit(req, res, '/api/auth/device/approve');
  if (!rl.allowed) return res.status(429).json({ error: 'rate_limited', retry_after: rl.retryAfter });

  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });

  const { user_code, email, password, action } = req.body || {};
  if (!user_code) return res.status(400).json({ error: 'missing_user_code' });

  const codes = await getDeviceCodes();
  const entry = Object.values(codes).find(c => c.user_code === user_code);
  if (!entry) return res.status(404).json({ error: 'invalid_code' });
  if (new Date(entry.expires).getTime() < Date.now()) return res.status(400).json({ error: 'code_expired' });
  if (entry.approved) return res.status(400).json({ error: 'already_approved' });

  if (action === 'deny') {
    const key = Object.keys(codes).find(k => codes[k].user_code === user_code);
    delete codes[key];
    await saveDeviceCodes(codes);
    return res.status(200).json({ status: 'denied' });
  }

  // Validate email/password
  if (!validateEmail(email)) return res.status(400).json({ error: 'invalid_email' });
  const pwCheck = validatePassword(password);
  if (!pwCheck.valid) return res.status(400).json({ error: pwCheck.reason });

  const accounts = await getAccounts();
  let account = accounts[email];
  if (!account) {
    const salt = genSalt();
    account = { email, salt, hash: hashPassword(password, salt), created_at: new Date().toISOString() };
    accounts[email] = account;
    await saveAccounts(accounts);
  } else {
    if (hashPassword(password, account.salt) !== account.hash) {
      return res.status(401).json({ error: 'invalid_credentials' });
    }
  }

  entry.approved = true;
  entry.account_email = email;
  await saveDeviceCodes(codes);

  const session_token = genToken();
  const sessions = await getSessions();
  sessions[session_token] = { email, created: Date.now(), expires: Date.now() + 30*24*60*60*1000 };
  await saveSessions(sessions);

  res.status(200).json({ status: 'approved', session_token, email });
}
