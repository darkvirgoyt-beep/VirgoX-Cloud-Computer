import { supabase, supabaseAdmin } from './_supabase.js';
import { securityHeaders, handleOptions } from './_security.js';
import { rateLimit } from './_rate-limit.js';
import { getDeviceCodes, saveDeviceCodes, genToken, getSessions, saveSessions } from './_shared.js';

export default async function handler(req, res) {
  securityHeaders(res);
  if (handleOptions(req, res)) return;

  const rl = rateLimit(req, res, '/api/auth/token');
  if (!rl.allowed) return res.status(429).json({ error: 'rate_limited', retry_after: rl.retryAfter });

  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });

  const { device_code, grant_type } = req.body || {};
  if (grant_type !== 'urn:ietf:params:oauth:grant-type:device_code') {
    return res.status(400).json({ error: 'unsupported_grant_type' });
  }

  const codes = await getDeviceCodes();
  const entry = codes[device_code];
  if (!entry) return res.status(400).json({ error: 'invalid_device_code' });
  if (new Date(entry.expires).getTime() < Date.now()) {
    delete codes[device_code];
    await saveDeviceCodes(codes);
    return res.status(400).json({ error: 'expired_token' });
  }
  if (!entry.approved) {
    return res.status(400).json({ error: 'authorization_pending' });
  }

  const access_token = genToken();
  const refresh_token = genToken();
  const sessions = await getSessions();
  sessions[access_token] = { email: entry.account_email, created: Date.now(), expires: Date.now() + 30*24*60*60*1000 };
  await saveSessions(sessions);

  res.status(200).json({
    access_token,
    token_type: 'Bearer',
    expires_in: 30*24*60*60,
    refresh_token,
    scope: entry.scope
  });
}
