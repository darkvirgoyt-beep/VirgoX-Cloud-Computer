import { supabase, supabaseAdmin } from './_supabase.js';
import { securityHeaders, handleOptions, validateEmail } from './_security.js';
import { rateLimit } from './_rate-limit.js';
import { genCode, genToken, getDeviceCodes, saveDeviceCodes } from './_shared.js';

const CLIENT_ID = 'virgox-cloud-pc';
const SCOPE = 'openid profile';
const EXPIRY_MS = 15 * 60 * 1000;

export default async function handler(req, res) {
  securityHeaders(res);
  if (handleOptions(req, res)) return;

  const rl = rateLimit(req, res, '/api/auth/device/code');
  if (!rl.allowed) return res.status(429).json({ error: 'rate_limited', retry_after: rl.retryAfter });

  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });

  const { client_id, scope, email } = req.body || {};
  if (client_id !== CLIENT_ID) {
    return res.status(400).json({ error: 'invalid_client' });
  }

  const device_code = genToken();
  const user_code = genCode();
  const expires = new Date(Date.now() + EXPIRY_MS).toISOString();

  const codes = await getDeviceCodes();
  codes[device_code] = {
    user_code,
    client_id,
    scope: scope || SCOPE,
    expires,
    approved: false,
    account_email: null
  };
  await saveDeviceCodes(codes);

  const base = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:8787';
  res.status(200).json({
    device_code,
    user_code,
    verification_uri: `${base}/auth.html`,
    verification_uri_complete: `${base}/auth.html?code=${user_code}&auth=${base}`,
    expires_in: Math.floor(EXPIRY_MS / 1000),
    interval: 5
  });
}
