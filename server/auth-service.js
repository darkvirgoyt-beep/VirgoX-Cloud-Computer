#!/usr/bin/env node
/**
 * VirgoX auth service — OAuth 2.0 Device Authorization Grant (RFC 8628).
 *
 * Backs `vxc auth login` in the VirgoX Cloud PC terminal and the code-entry page
 * in auth.html. The workstation is a static page, so this has to run somewhere
 * reachable; point VXC_AUTH.base in app.js and BASE in auth.html at it.
 *
 *   node server/auth-service.js
 *   PORT=8787 node server/auth-service.js
 *
 * Endpoints
 *   GET  /health                       liveness
 *   POST /device/code    {client_id,scope}          -> device_code, user_code, uri
 *   POST /device/approve {user_code}                -> marks the grant approved
 *   POST /token          form-encoded, device_code  -> access_token | pending
 *
 * RFC 8628 deliberately has no client_secret: the flow exists for devices that
 * cannot keep one. Authorization therefore happens entirely in this browser
 * page, which is the only thing standing between a code and a token.
 *
 * Zero dependencies — node 18+.
 */

'use strict';

const http = require('http');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const PORT = Number(process.env.PORT) || 8787;
const HOST = process.env.HOST || '0.0.0.0';
const CLIENT_ID = process.env.VXC_CLIENT_ID || 'virgox-cloud-pc';
const DEFAULT_SCOPE = process.env.VXC_SCOPE || 'workstation:read';
const TTL_SECONDS = Number(process.env.VXC_CODE_TTL) || 900; // 15 min, per RFC 8628
const INTERVAL = Number(process.env.VXC_POLL_INTERVAL) || 5;

// device_code -> grant
const grants = new Map();

/* ------------------------------------------------------------------ helpers */

// Ambiguous glyphs removed: users retype these from a terminal constantly.
const ALPHABET = 'BCDFGHJKLMNPQRSTVWXZ23456789';

function randomChars(n) {
  const bytes = crypto.randomBytes(n);
  let out = '';
  for (let i = 0; i < n; i++) out += ALPHABET[bytes[i] % ALPHABET.length];
  return out;
}

// user_code is human-typed, so it stays short; device_code is machine-only.
const newUserCode = () => randomChars(8);
const newDeviceCode = () => crypto.randomBytes(32).toString('hex');

const newAccessToken = () => 'vxc_' + crypto.randomBytes(32).toString('base64url');

function sweep() {
  const now = Date.now();
  for (const [code, g] of grants) {
    if (g.expires_at <= now) grants.delete(code);
  }
}
setInterval(sweep, 60_000).unref();

function publicBase(req) {
  const env = process.env.VXC_PUBLIC_URL;
  if (env) return env.replace(/\/$/, '');
  const host = req.headers.host || `localhost:${PORT}`;
  return `http://${host}`;
}

function send(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    // The terminal and auth.html are served from a different origin (GitHub
    // Pages), so this has to be wide open. The device flow protects itself with
    // the one-time code, not with CORS.
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Accept',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Cache-Control': 'no-store',
  });
  res.end(body);
}

function readBody(req, limit = 8 * 1024) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', c => {
      size += c.length;
      if (size > limit) {
        reject(new Error('payload too large'));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

async function readJson(req) {
  const raw = await readBody(req);
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch (e) {
    return {};
  }
}

async function readForm(req) {
  const raw = await readBody(req);
  const out = {};
  for (const [k, v] of new URLSearchParams(raw)) out[k] = v;
  return out;
}

// auth.html posts JSON, a curl user will post a form. Take either.
async function readAny(req) {
  const raw = await readBody(req);
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch (e) {
    const out = {};
    for (const [k, v] of new URLSearchParams(raw)) out[k] = v;
    return out;
  }
}

/* -------------------------------------------------------------- /device/code */

async function handleDeviceCode(req, res) {
  const body = await readJson(req);
  const clientId = body.client_id || CLIENT_ID;

  if (clientId !== CLIENT_ID) {
    return send(res, 400, {
      error: 'invalid_client',
      error_description: 'unknown client_id',
    });
  }

  sweep();

  // A code is only unique among live grants, so a stale one can be recycled.
  let userCode;
  do {
    userCode = newUserCode();
  } while (grants.has(userCode));

  const deviceCode = newDeviceCode();
  const verifyBase = publicBase(req);
  const verificationUri = process.env.VXC_VERIFY_URL || `${verifyBase}/auth.html`;

  grants.set(userCode, {
    device_code: deviceCode,
    user_code: userCode,
    client_id: clientId,
    scope: body.scope || DEFAULT_SCOPE,
    device: body.device || 'cloud-pc',
    created_at: Date.now(),
    expires_at: Date.now() + TTL_SECONDS * 1000,
    approved: false,
    // Track the client polling us so slow_down can be enforced.
    last_poll_at: 0,
    token: null,
    email: null,
  });

  // auth.html is a static file with no way to discover us. So the URI we hand
  // back carries the service origin in `auth=`, and the page reads it. Without
  // this the page posts to whatever BASE it was hardcoded with and the approval
  // never lands — the CLI would poll until the code expired.
  const browserBase = verifyBase;

  send(res, 200, {
    device_code: deviceCode,
    user_code: userCode,
    verification_uri: verificationUri,
    verification_uri_complete:
      `${verificationUri}?code=${userCode}&auth=${encodeURIComponent(browserBase)}`,
    expires_in: TTL_SECONDS,
    interval: INTERVAL,
  });
}

/* ------------------------------------------------------------ /device/approve */

async function handleApprove(req, res) {
  const body = await readAny(req);

  // Approval is an authenticated act. Before this existed, the identity came out
  // of the request body or defaulted to VXC_DEFAULT_EMAIL, so any page could
  // approve any code as anyone. It now has to be a real signed-in account.
  const session = sessionFor(req);
  if (!session) {
    return send(res, 401, {
      error: 'not_signed_in',
      error_description: 'Sign in to your VirgoX account before approving this device.',
    });
  }

  const userCode = String(body.user_code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  const grant = grants.get(userCode);

  if (!grant) {
    return send(res, 404, {
      error: 'invalid_user_code',
      error_description: 'That code is not valid or has already been used.',
    });
  }

  if (grant.expires_at <= Date.now()) {
    grants.delete(userCode);
    return send(res, 400, {
      error: 'expired_token',
      error_description: 'That code has expired. Run vxc auth login again.',
    });
  }

  if (grant.approved) {
    return send(res, 409, {
      error: 'already_approved',
      error_description: 'That device has already been approved.',
    });
  }

  grant.approved = true;
  grant.approved_at = Date.now();
  grant.email = session.email;   // from the session, never from the request

  send(res, 200, {
    approved: true,
    device: grant.device,
    scope: grant.scope,
  });
}

/* -------------------------------------------------------------------- /token */

async function handleToken(req, res) {
  const body = await readForm(req);
  const deviceCode = body.device_code;

  if (!deviceCode || body.grant_type !== 'urn:ietf:params:oauth:grant-type:device_code') {
    return send(res, 400, {
      error: 'unsupported_grant_type',
      error_description: 'expected grant_type urn:ietf:params:oauth:grant-type:device_code',
    });
  }

  let grant = null;
  for (const g of grants.values()) {
    if (g.device_code === deviceCode) { grant = g; break; }
  }

  if (!grant) {
    return send(res, 400, {
      error: 'invalid_grant',
      error_description: 'unknown device code',
    });
  }

  const now = Date.now();

  if (grant.expires_at <= now) {
    grants.delete(grant.user_code);
    return send(res, 400, {
      error: 'expired_token',
      error_description: 'the device code expired before it was approved',
    });
  }

  // RFC 8628 §3.5: if the client polls faster than `interval`, tell it to back
  // off rather than serving it.
  if (grant.last_poll_at && now - grant.last_poll_at < INTERVAL * 1000 * 0.8) {
    return send(res, 400, { error: 'slow_down' });
  }
  grant.last_poll_at = now;

  if (!grant.approved) {
    return send(res, 400, { error: 'authorization_pending' });
  }

  // Mint once and reuse, so a retried poll doesn't invalidate a token the
  // client already wrote to sessionStorage.
  if (!grant.token) grant.token = newAccessToken();

  send(res, 200, {
    access_token: grant.token,
    token_type: 'Bearer',
    scope: grant.scope,
    user_email: grant.email,
    expires_in: Math.floor((grant.expires_at - now) / 1000),
  });

  // The code is spent; this device no longer needs the grant record.
  setTimeout(() => grants.delete(grant.user_code), 30_000).unref();
}

/* ------------------------------------------------------------- web handoff */

// vxc auth login runs on a phone (Termux) or a laptop, but the workstation runs
// in a browser. Same-origin storage is not shared between them, so the approved
// session is parked here and the page claims it once.

const handoffs = new Map(); // claim_token -> { token, email, scope, created_at }
const HANDOFF_TTL = 300_000; // 5 min: long enough to switch apps, short enough to expire

function pruneHandoffs() {
  const now = Date.now();
  for (const [k, v] of handoffs) if (v.created_at + HANDOFF_TTL <= now) handoffs.delete(k);
}
setInterval(pruneHandoffs, 60_000).unref();

async function handleSessionPush(req, res) {
  const body = await readAny(req);
  if (!body.token) {
    return send(res, 400, { error: 'invalid_request', error_description: 'token is required' });
  }
  pruneHandoffs();
  const claim = crypto.randomBytes(24).toString('base64url');
  handoffs.set(claim, {
    token: body.token,
    email: body.email || null,
    scope: body.scope || DEFAULT_SCOPE,
    created_at: Date.now(),
  });
  send(res, 200, { queued: true, claim, expires_in: HANDOFF_TTL / 1000 });
}

async function handleSessionClaim(req, res) {
  const claim = url.searchParams.get('claim') || '';
  pruneHandoffs();
  const entry = handoffs.get(claim);
  if (!entry) {
    return send(res, 404, { error: 'no_session', error_description: 'no queued session for that claim' });
  }
  // One-shot: whoever presents the claim first gets the session, then it is gone.
  handoffs.delete(claim);
  send(res, 200, {
    access_token: entry.token,
    user_email: entry.email,
    scope: entry.scope,
  });
}

async function handleSessionRevoke(req, res) {
  const body = await readAny(req);
  if (!body.token) {
    return send(res, 400, { error: 'invalid_request', error_description: 'token is required' });
  }
  let removed = 0;
  for (const [k, v] of handoffs) {
    if (v.token === body.token) { handoffs.delete(k); removed++; }
  }
  send(res, 200, { revoked: removed });
}

/* ------------------------------------------------------------------- routing */

/* ------------------------------------------------------------------ accounts
 *
 * The device-approval page used to have no idea who was approving. handleApprove
 * took the email straight out of the request body, or fell back to
 * VXC_DEFAULT_EMAIL, which meant anyone who could reach the page could claim any
 * identity they liked. That is not a login.
 *
 * Accounts are real: scrypt-hashed passwords, a random per-user salt, and a
 * constant-time comparison. They live in a JSON file so an account stays valid
 * across restarts — you sign in with the same one every time.
 */

const SCRYPT_PARAMS = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };
const accounts = new Map();     // email -> { email, salt, hash, created_at }
const sessions = new Map();     // token  -> { token, email, created_at, expires_at }
const SESSION_TTL = 30 * 24 * 3600 * 1000; // 30 days

const DATA_FILE = process.env.VXC_DATA_FILE
  || path.join(__dirname, '..', 'data', 'accounts.json');

function loadAccounts() {
  try {
    const raw = fs.readFileSync(DATA_FILE, 'utf8');
    for (const rec of JSON.parse(raw)) {
      if (rec && rec.email && rec.salt && rec.hash) accounts.set(rec.email, rec);
    }
    console.log(`  loaded ${accounts.size} account(s) from ${DATA_FILE}`);
  } catch (e) {
    if (e.code !== 'ENOENT') console.log(`  could not read ${DATA_FILE}: ${e.message}`);
    console.log('  no accounts file yet — the first sign-in creates one');
  }
}

function saveAccounts() {
  fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
  // 0600: the file holds password hashes, it does not belong world-readable.
  fs.writeFileSync(DATA_FILE, JSON.stringify([...accounts.values()], null, 2), { mode: 0o600 });
}

const hashPassword = (password, salt) =>
  crypto.scryptSync(password, salt, 64, SCRYPT_PARAMS).toString('base64');

function validEmail(e) {
  return typeof e === 'string' && /^[^\s@]{1,64}@[^\s@]{1,190}\.[a-z]{2,}$/i.test(e.trim());
}

/* Refuse the weakest passwords outright rather than storing them. */
function passwordProblem(p) {
  if (typeof p !== 'string') return 'Password is required.';
  if (p.length < 10) return 'Use at least 10 characters.';
  if (p.length > 200) return 'That password is too long.';
  const classes = [/[a-z]/, /[A-Z]/, /[0-9]/, /[^A-Za-z0-9]/].filter(r => r.test(p)).length;
  if (classes < 3) return 'Mix lower case, upper case, numbers and symbols — at least three of the four.';
  return null;
}

function bearer(req) {
  const h = req.headers.authorization || '';
  const m = /^Bearer\s+(.+)$/i.exec(h.trim());
  if (m) return m[1];
  // Fall back to a query param so the browser page can pass it in a link-free way
  // via the Authorization header; kept explicit rather than cookie-based so there
  // is no CSRF surface on a service exposed cross-origin.
  return null;
}

function sessionFor(req) {
  const tok = bearer(req);
  if (!tok) return null;
  const s = sessions.get(tok);
  if (!s) return null;
  if (s.expires_at <= Date.now()) { sessions.delete(tok); return null; }
  return s;
}

/* Simple fixed-window throttle on password guessing. */
const attempts = new Map(); // key -> { n, until }
function throttleKey(req, email) {
  return (req.socket.remoteAddress || 'unknown') + '|' + String(email).toLowerCase();
}
function tooManyAttempts(req, email) {
  const a = attempts.get(throttleKey(req, email));
  return !!(a && a.until > Date.now());
}
function noteFailure(req, email) {
  const k = throttleKey(req, email);
  const a = attempts.get(k) || { n: 0, until: 0 };
  a.n++;
  if (a.n >= 5) { a.until = Date.now() + Math.min(300_000, a.n * 15_000); a.n = 0; }
  attempts.set(k, a);
}
function clearFailures(req, email) { attempts.delete(throttleKey(req, email)); }

function newSession(email) {
  const token = 'vxs_' + crypto.randomBytes(32).toString('base64url');
  sessions.set(token, { token, email, created_at: Date.now(), expires_at: Date.now() + SESSION_TTL });
  return token;
}

async function handleRegister(req, res) {
  const b = await readAny(req);
  const email = String(b.email || '').trim().toLowerCase();
  const password = b.password;

  if (!validEmail(email)) {
    return send(res, 400, { error: 'invalid_email', error_description: 'That does not look like an email address.' });
  }
  const problem = passwordProblem(password);
  if (problem) return send(res, 400, { error: 'weak_password', error_description: problem });
  if (accounts.has(email)) {
    return send(res, 409, { error: 'email_taken', error_description: 'That email already has an account. Sign in instead.' });
  }

  const salt = crypto.randomBytes(16).toString('base64');
  accounts.set(email, {
    email,
    salt,
    hash: hashPassword(password, salt),
    created_at: new Date().toISOString(),
  });
  saveAccounts();

  const token = newSession(email);
  send(res, 201, { token, email, token_type: 'Bearer', expires_in: Math.floor(SESSION_TTL / 1000) });
}

async function handleLogin(req, res) {
  const b = await readAny(req);
  const email = String(b.email || '').trim().toLowerCase();
  const password = b.password;

  if (!email || typeof password !== 'string') {
    return send(res, 400, { error: 'invalid_request', error_description: 'Email and password are both required.' });
  }
  if (tooManyAttempts(req, email)) {
    return send(res, 429, { error: 'too_many_attempts', error_description: 'Too many tries. Wait a minute and go again.' });
  }

  const rec = accounts.get(email);
  // Hash against a dummy record when the user is missing so a wrong email and a
  // wrong password take the same time. Otherwise you can enumerate accounts.
  const salt = rec ? rec.salt : 'not-a-real-salt';
  const attempt = hashPassword(password, salt);
  const ok = rec && crypto.timingSafeEqual(
    Buffer.from(attempt, 'base64'), Buffer.from(rec.hash, 'base64'));

  if (!ok) {
    noteFailure(req, email);
    return send(res, 401, { error: 'invalid_credentials', error_description: 'Email or password is wrong.' });
  }

  clearFailures(req, email);
  const token = newSession(email);
  send(res, 200, { token, email: rec.email, token_type: 'Bearer', expires_in: Math.floor(SESSION_TTL / 1000) });
}

async function handleMe(req, res) {
  const s = sessionFor(req);
  if (!s) return send(res, 401, { error: 'not_signed_in', error_description: 'No session.' });
  send(res, 200, { email: s.email, created_at: s.created_at, expires_at: s.expires_at });
}

async function handleLogout(req, res) {
  const tok = bearer(req);
  if (tok) sessions.delete(tok);
  send(res, 200, { signed_out: true });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const path = url.pathname.replace(/\/+$/, '') || '/';

  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type, Accept',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Max-Age': '86400',
    });
    return res.end();
  }

  try {
    if (req.method === 'GET' && (path === '/health' || path === '/')) {
      sweep();
      return send(res, 200, {
        status: 'ok',
        service: 'virgox-auth',
        grants_pending: grants.size,
        interval: INTERVAL,
      });
    }

    if (req.method === 'POST' && path === '/device/code') return await handleDeviceCode(req, res);
    if (req.method === 'POST' && path === '/device/approve') return await handleApprove(req, res);
    if (req.method === 'POST' && path === '/token') return await handleToken(req, res);
    if (req.method === 'POST' && path === '/account/register') return await handleRegister(req, res);
    if (req.method === 'POST' && path === '/account/login') return await handleLogin(req, res);
    if (req.method === 'GET' && path === '/account/me') return await handleMe(req, res);
    if (req.method === 'POST' && path === '/account/logout') return await handleLogout(req, res);
    if (req.method === 'POST' && path === '/session/push') return await handleSessionPush(req, res);
    if (req.method === 'GET' && path === '/session/claim') return await handleSessionClaim(req, res);
    if (req.method === 'POST' && path === '/session/revoke') return await handleSessionRevoke(req, res);

    return send(res, 404, { error: 'not_found', error_description: path });
  } catch (err) {
    return send(res, 500, {
      error: 'server_error',
      error_description: err && err.message ? err.message : 'unknown',
    });
  }
});

loadAccounts();

server.listen(PORT, HOST, () => {
  console.log(`virgox auth service listening on http://${HOST}:${PORT}`);
  console.log(`  accounts: ${accounts.size} (${DATA_FILE})`);
  console.log(`  device codes expire in ${TTL_SECONDS}s, clients poll every ${INTERVAL}s`);
  if (!process.env.VXC_PUBLIC_URL) {
    console.log('  note: set VXC_PUBLIC_URL when behind a proxy so verification_uri is correct');
  }
});

module.exports = server;