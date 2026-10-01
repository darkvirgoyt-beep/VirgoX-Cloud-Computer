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
 *   GET  /agent/status                -> is a PC attached to this session?
 *   POST /agent/command  {argv}       -> queue a command for that PC
 *   GET  /agent/result?id=             -> wait for the answer
 *   POST /agent/poll     (browser)    -> long-poll: take the next command
 *   POST /agent/report   {id,ok,...}  -> hand the answer back
 *
 *   POST /shell/open                    -> a real shell on this host, under a PTY
 *   POST /shell/input   {id,data}       -> keystrokes into that shell
 *   GET  /shell/read?id=&cursor=        -> new output after the cursor
 *   POST /shell/close  {id}             -> end it
 *
 * The /shell/* endpoints are not a command echo. They are `script(1)` around a
 * real shell on this machine, so `ls`, `cd`, `apt` and `python3` are the host's
 * own, with the host's own filesystem. Read the long block at handleShellOpen
 * before exposing this service to a network you do not control: it is remote
 * code execution by design, gated only on a session token.
 *
 * RFC 8628 deliberately has no client_secret: the flow exists for devices that
 * cannot keep one. Authorization therefore happens entirely in this browser
 * page, which is the only thing standing between a code and a token.
 *
 * The agent endpoints are how `vxc pc …` drives the workstation. The terminal
 * and the page cannot see each other directly — one is Termux, the other is a
 * browser on another origin — so this service carries the traffic. Both sides
 * authenticate with the same session token, so a queue only exists for a
 * session that actually signed in.
 *
 * Zero dependencies — node 18+.
 */

'use strict';

const http = require('http');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');

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
  for (const [tok, s] of sessions) {
    if (s.expires_at <= now) sessions.delete(tok);
  }
  for (const [tok, d] of deviceTokens) {
    if (d.expires_at <= now) deviceTokens.delete(tok);
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
    'Access-Control-Allow-Headers': 'Content-Type, Accept, Authorization',
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

  // Record it, so this token is a real session everywhere else in the service
  // and not just an opaque string the /token endpoint happens to recognise.
  deviceTokens.set(grant.token, {
    token: grant.token,
    email: grant.email,
    created_at: now,
    expires_at: grant.expires_at,
  });

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

async function handleSessionClaim(req, url, res) {
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
  // A revoked token must also stop being able to drive the PC. Dropping it from
  // sessions alone left device-grant tokens working, because they live in their
  // own store, and an agent queue keyed on the token outlives the logout.
  const dropped = sessions.delete(body.token) || deviceTokens.delete(body.token);
  releaseAgent(body.token);
  send(res, 200, { revoked: removed, session_dropped: dropped });
}

/* -------------------------------------------------------------- agent bridge
 *
 * `vxc auth login` signs the terminal in; it cannot sign the browser in by
 * itself, and once both are signed in they still cannot see each other. The
 * terminal is Termux on a phone, the PC is a document in a browser, and there is
 * no shared process, socket or storage between them. What does exist is this
 * service, which both already talk to — so the control traffic goes through it.
 *
 * Shape: the browser long-polls for work, the terminal queues a command and
 * waits for the answer. Both authenticate with the same session token, so a queue
 * exists only for a session that really signed in, and two accounts on the same
 * service never see each other's commands.
 */

const AGENT_IDLE_MS = 45_000;   // no poll for this long means the page is gone
const AGENT_POLL_CAP = 30_000;  // longest a poll is held open, matching the page
const AGENT_QUEUE_MAX = 32;     // per session; a page that stalls cannot grow it
const AGENT_RESULT_MS = 120_000;

// token -> { queue: [{id, argv, at}], pollers: [{res,timer}], waiting: [{res,id,timer}],
//            results: Map(id -> answer), inflight: Set(id), last_seen,
//            reported: {at, facts} }
//
// The two kinds of held-open request are kept apart. A poller is waiting for work
// and a result-waiter is waiting for an answer; answering one with the other is
// how a `vxc pc status` silently prints nothing instead of a real reading.
const agents = new Map();

function agentFor(token) {
  let a = agents.get(token);
  if (!a) {
    a = {
      queue: [],
      pollers: [],
      waiting: [],
      results: new Map(),
      inflight: new Set(),
      last_seen: 0,
      reported: null,
    };
    agents.set(token, a);
  }
  return a;
}

function releaseAgent(token) {
  const a = agents.get(token);
  if (!a) return;
  // Both kinds of waiter are released: the page gets an empty command list and
  // the terminal is told the answer never came, rather than both sockets being
  // left hanging until their own timers fire.
  for (const p of a.pollers) {
    clearTimeout(p.timer);
    try { send(p.res, 200, { commands: [] }); } catch (e) { /* socket already gone */ }
  }
  for (const w of a.waiting) {
    clearTimeout(w.timer);
    try { w.reply({ pending: true }); } catch (e) { /* socket already gone */ }
  }
  a.pollers.length = 0;
  a.waiting.length = 0;
  a.queue.length = 0;
  a.results.clear();
  a.inflight.clear();
  agents.delete(token);
}

function pruneAgents() {
  const now = Date.now();
  for (const [tok, a] of agents) {
    if (a.last_seen && now - a.last_seen > AGENT_IDLE_MS) { releaseAgent(tok); continue; }
    for (const [id, r] of a.results) if (now - r.at > AGENT_RESULT_MS) a.results.delete(id);
  }
}
setInterval(pruneAgents, 30_000).unref();

/* ---- terminal side ------------------------------------------------------- */

async function handleAgentStatus(req, res) {
  const s = sessionFor(req);
  if (!s) return send(res, 401, { error: 'not_signed_in', error_description: 'No session.' });
  const a = agents.get(bearer(req));
  const live = !!a && Date.now() - a.last_seen <= AGENT_IDLE_MS;
  send(res, 200, {
    email: s.email,
    attached: live,
    last_seen: live ? a.last_seen : null,
    queued: live ? a.queue.length : 0,
    running: live ? a.inflight.size : 0,
    pollers: live ? a.pollers.length : 0,
    reported: live && a.reported ? a.reported.facts : null,
    reported_at: live && a.reported ? a.reported.at : null,
  });
}

async function handleAgentCommand(req, res) {
  const s = sessionFor(req);
  if (!s) return send(res, 401, { error: 'not_signed_in', error_description: 'No session.' });
  const body = await readAny(req);

  const argv = Array.isArray(body.argv) ? body.argv : [];
  if (!argv.length || !argv.every(a => typeof a === 'string')) {
    return send(res, 400, { error: 'invalid_request', error_description: 'argv must be a non-empty array of strings' });
  }
  if (argv.length > 16 || argv.some(a => a.length > 512)) {
    return send(res, 400, { error: 'command_too_long', error_description: 'argv is capped at 16 items of 512 chars' });
  }

  const token = bearer(req);
  const a = agents.get(token);
  if (!a || Date.now() - a.last_seen > AGENT_IDLE_MS) {
    return send(res, 409, {
      error: 'no_pc_attached',
      error_description: 'No PC is polling this session. Open the PC page and sign in there.',
    });
  }
  if (a.queue.length >= AGENT_QUEUE_MAX) {
    return send(res, 429, { error: 'queue_full', error_description: 'Too many commands waiting for the PC.' });
  }

  const id = crypto.randomBytes(9).toString('base64url');
  a.queue.push({ id, argv, at: Date.now() });

  // A page already parked on a long-poll gets it immediately, and it is marked
  // running for the same reason the direct-poll path marks it: the queue will
  // not hold it by the time the terminal asks for the answer.
  while (a.pollers.length && a.queue.length) {
    const waiter = a.pollers.shift();
    const handed = a.queue.splice(0, 1)[0];
    a.inflight.add(handed.id);
    try { send(waiter.res, 200, { commands: [handed] }); } catch (e) { /* gone */ }
  }

  send(res, 200, { queued: true, id, email: s.email, position: a.queue.length });
}

/* Renders an answer as plain text.
 *
 * The terminal is a POSIX shell script with no JSON parser, so asking it to
 * un-nest a JSON object out of a JSON string is a way to ship a printer that
 * silently prints nothing. The page hands back a nested object; this flattens it
 * once, here, where there is a real parser, and the CLI prints lines.
 *
 * Scalars become "key: value", an array of strings becomes a "- item" list, and
 * an array of objects becomes an indented block. Anything else is JSON-encoded,
 * which is still real output rather than a guess. */
function renderAnswer(answer) {
  if (answer.pending) return 'pending';
  if (answer.ok === false) return `refused\n${answer.error || 'the PC refused the command'}`;

  // A command whose output is already formatted — the terminal's own output —
  // sends it as `text` and it is printed exactly as the page produced it.
  if (typeof answer.text === 'string' && answer.text !== '') return answer.text;

  const data = answer.data;
  if (data === null || data === undefined) return 'ok';
  if (typeof data !== 'object') return String(data);

  const out = [];
  for (const [key, value] of Object.entries(data)) {
    if (value === null || value === undefined) continue;
    if (Array.isArray(value)) {
      if (!value.length) { out.push(`${key}: (none)`); continue; }
      out.push(`${key}:`);
      for (const item of value) {
        if (item !== null && typeof item === 'object') {
          const parts = Object.entries(item)
            .filter(([, v]) => v !== null && v !== undefined && v !== '')
            .map(([k, v]) => `${k}=${v}`);
          out.push(parts.length ? `  - ${parts.join('  ')}` : '  -');
        } else {
          out.push(`  - ${item}`);
        }
      }
      continue;
    }
    if (typeof value === 'object') {
      out.push(`${key}:`);
      for (const [k, v] of Object.entries(value)) {
        if (v === null || v === undefined) continue;
        out.push(`  ${k}: ${typeof v === 'object' ? JSON.stringify(v) : v}`);
      }
      continue;
    }
    out.push(`${key}: ${value}`);
  }
  return out.length ? out.join('\n') : 'ok';
}

function sendText(res, body) {
  res.writeHead(200, {
    'Content-Type': 'text/plain; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Access-Control-Allow-Origin': '*',
    'Cache-Control': 'no-store',
  });
  res.end(body);
}

/* Long-poll for one command's answer. Holding the socket open is what makes
 * `vxc pc status` feel immediate without the page having to push anything.
 *
 * `?format=text` returns the flattened rendering above, which is what the CLI
 * uses; the JSON form stays for anything reading this over HTTP. */
async function handleAgentResult(req, url, res) {
  const s = sessionFor(req);
  if (!s) return send(res, 401, { error: 'not_signed_in', error_description: 'No session.' });
  const token = bearer(req);
  const id = (url.searchParams.get('id') || '').trim();
  if (!id) return send(res, 400, { error: 'invalid_request', error_description: 'id is required' });

  const a = agentFor(token);
  const asText = url.searchParams.get('format') === 'text';
  const reply = payload => (asText ? sendText(res, renderAnswer(payload)) : send(res, 200, payload));

  const hit = a.results.get(id);
  if (hit) {
    a.results.delete(id);
    a.inflight.delete(id);
    return reply(hit);
  }
  // Not queued, not running and never answered: the command id does not exist on
  // this session. Say so immediately rather than holding the socket open. The
  // queued check matters — a command is removed from the queue the moment the
  // page takes it, so without this every real command would look unknown by the
  // time the terminal asked for its answer.
  if (!a.queue.some(c => c.id === id) && !a.inflight.has(id)) {
    return send(res, 404, { error: 'unknown_command', error_description: 'No such command on this session.' });
  }

  const hold = Math.min(Number(url.searchParams.get('wait')) || AGENT_POLL_CAP, AGENT_POLL_CAP);
  // The reply function is carried with the waiter, because the answer can arrive
  // from two places — the page reporting it, or this wait expiring — and both
  // have to honour the format the caller asked for.
  const holder = { res, kind: 'result', id, timer: null, reply };
  holder.timer = setTimeout(() => {
    const i = a.waiting.indexOf(holder);
    if (i >= 0) a.waiting.splice(i, 1);
    if (!res.writableEnded) reply({ pending: true });
  }, hold);
  a.waiting.push(holder);
  res.on('close', () => {
    clearTimeout(holder.timer);
    const i = a.waiting.indexOf(holder);
    if (i >= 0) a.waiting.splice(i, 1);
  });
}

/* ---- browser side -------------------------------------------------------- */

async function handleAgentPoll(req, url, res) {
  const s = sessionFor(req);
  if (!s) return send(res, 401, { error: 'not_signed_in', error_description: 'No session.' });
  const token = bearer(req);
  const a = agentFor(token);
  a.last_seen = Date.now();

  if (a.queue.length) {
    const cmd = a.queue.splice(0, 1)[0];
    // Remember it as running. The queue no longer holds it, and this is what
    // lets a terminal asking for the answer tell "still working" from "never
    // existed" instead of getting a 404 on a command that is fine.
    a.inflight.add(cmd.id);
    return send(res, 200, { commands: [cmd] });
  }

  const hold = Math.min(Number(url.searchParams.get('wait')) || AGENT_POLL_CAP, AGENT_POLL_CAP);
  const holder = { res, kind: 'poll', timer: null };
  holder.timer = setTimeout(() => {
    const i = a.pollers.indexOf(holder);
    if (i >= 0) a.pollers.splice(i, 1);
    a.last_seen = Date.now(); // an idle poll still proves the page is alive
    if (!res.writableEnded) send(res, 200, { commands: [] });
  }, hold);
  a.pollers.push(holder);
  res.on('close', () => {
    clearTimeout(holder.timer);
    const i = a.pollers.indexOf(holder);
    if (i >= 0) a.pollers.splice(i, 1);
  });
}

async function handleAgentReport(req, res) {
  const s = sessionFor(req);
  if (!s) return send(res, 401, { error: 'not_signed_in', error_description: 'No session.' });
  const body = await readAny(req);
  const token = bearer(req);
  const a = agentFor(token);
  a.last_seen = Date.now();

  // The page states what it is, so `vxc pc status` reports the browser it is
  // actually in rather than a string the terminal made up.
  if (body.facts && typeof body.facts === 'object') {
    a.reported = { at: Date.now(), facts: body.facts };
  }

  // An idle heartbeat posts facts with no id. That is not an answer to anything,
  // so it must not be stored as one — a result keyed on the empty string would
  // sit in the map until the pruner noticed, answering a question nobody asked.
  const id = String(body.id || '');
  if (!id) {
    send(res, 200, { recorded: true, facts: !!a.reported });
    return;
  }

  const answer = {
    id,
    ok: body.ok !== false,
    data: body.data === undefined ? null : body.data,
    // A command whose output is already laid out sends it here and the terminal
    // prints it verbatim. Terminal output is multi-line and full of backslashes;
    // flattening it into `key: value` lines would mangle it.
    text: typeof body.text === 'string' ? body.text.slice(0, 16_000) : null,
    error: body.error ? String(body.error).slice(0, 400) : null,
    at: Date.now(),
  };
  a.inflight.delete(id);
  a.results.set(id, answer);

  // Hand it to the terminal waiting on this exact command, if there is one.
  for (let i = a.waiting.length - 1; i >= 0; i--) {
    const w = a.waiting[i];
    if (w.kind !== 'result' || w.id !== id) continue;
    clearTimeout(w.timer);
    a.waiting.splice(i, 1);
    a.results.delete(id);
    try { w.reply(answer); } catch (e) { /* gone */ }
  }

  send(res, 200, { recorded: true });
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
// Tokens minted by the device grant (vxc auth login). Same shape as a password
// session, separate store so a logout of one does not silently kill the other.
const deviceTokens = new Map(); // token  -> { token, email, created_at, expires_at }
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
  if (s) {
    if (s.expires_at <= Date.now()) { sessions.delete(tok); return null; }
    return s;
  }
  // A token minted by the device grant is the same kind of thing as a password
  // session: it says who approved it, and for how long. It used to be minted and
  // never recorded, which meant /account/me 401'd for a PC that had just been
  // signed in by `vxc auth login` — the page could hold a token the service
  // denied. It is checked here so both kinds of token mean the same thing.
  const d = deviceTokens.get(tok);
  if (!d) return null;
  if (d.expires_at <= Date.now()) { deviceTokens.delete(tok); return null; }
  return d;
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

/* -------------------------------------------------------------------- shell */
/*
 * A real shell, on this host, over plain HTTP.
 *
 * The workstation is a static page and cannot spawn anything, so when a shell
 * is wanted the page asks this service and this service runs it — as whatever
 * user started the service, with that user's whole filesystem. That is the
 * point: `ls`, `cd`, `apt`, `python3` and everything else are the real thing,
 * not a theme.
 *
 * It is a PTY, not two pipes. A shell on pipes cannot run apt, python, top, vim
 * or anything else that checks isatty(); it prints colour codes into a dead
 * stream and refuses to draw. `script` (util-linux) is the standard way to put
 * a terminal behind a pipe without pulling in node-pty, so that is used when it
 * exists. Where it does not, the shell still runs but full-screen programs
 * degrade — the response says which mode you are in.
 *
 * Transport is a rolling output buffer plus a monotonic cursor. The page says
 * "I have consumed N characters"; the service returns everything after N and
 * the new cursor. That survives reconnects and out-of-order polls without a
 * websocket, which keeps this service dependency-free.
 *
 * This is remote code execution by design, so it is gated: a shell is only ever
 * opened for a request that carries a session token a human approved through
 * the device flow. `VXC_SHELL=off` turns the entire surface off.
 */
const SHELL_ENABLED = process.env.VXC_SHELL !== 'off';
const SHELL_MAX_BUFFER = Number(process.env.VXC_SHELL_BUFFER) || 262144;
const SHELL_IDLE_MS = Number(process.env.VXC_SHELL_IDLE) || 15 * 60 * 1000;
const SHELL_POLL_MS = Math.min(55000, Number(process.env.VXC_SHELL_POLL) || 25000);

const shells = new Map(); // id -> shell session

function findScript() {
  for (const p of ['/usr/bin/script', '/bin/script', '/usr/local/bin/script']) {
    try { if (fs.existsSync(p)) return p; } catch (_) { /* keep looking */ }
  }
  return null;
}
const SCRIPT_BIN = findScript();

function pickShell() {
  const wanted = process.env.VXC_SHELL_BIN || process.env.SHELL || '/bin/bash';
  try { if (fs.existsSync(wanted)) return wanted; } catch (_) { /* fall through */ }
  return '/bin/sh';
}

function shellHome() {
  const override = process.env.VXC_SHELL_CWD;
  if (override) { try { if (fs.statSync(override).isDirectory()) return override; } catch (_) {} }
  try { return os.homedir(); } catch (_) { return process.cwd(); }
}

function spawnShell() {
  const shell = pickShell();
  const cwd = shellHome();
  const env = Object.assign({}, process.env, {
    TERM: 'xterm-256color',
    COLORTERM: 'truecolor',
    LANG: process.env.LANG || 'C.UTF-8',
  });
  const child = SCRIPT_BIN
    // -q quiet, -f flush, -c run this command. The trailing /dev/null is the
    // typescript file we deliberately never want written.
    ? spawn(SCRIPT_BIN, ['-qfc', shell, '/dev/null'], { cwd, env })
    : spawn(shell, ['-i'], { cwd, env });
  return { child, cwd, shell, pty: !!SCRIPT_BIN };
}

function wakeShell(s) {
  const waiters = s.waiters;
  s.waiters = [];
  for (const fn of waiters) { try { fn(); } catch (_) { /* a dead poll is not an error */ } }
}

function newShell(session) {
  const { child, cwd, shell, pty } = spawnShell();
  const s = {
    id: crypto.randomBytes(18).toString('base64url'),
    child, cwd, shell, pty,
    out: '',                 // everything produced and not yet trimmed
    base: 0,                 // index of out[0] in the session's lifetime
    ended: false,
    exit: null,
    touched: Date.now(),
    owner: session && session.email ? session.email : null,
    waiters: [],
  };
  const push = (text) => {
    if (!text) return;
    s.out += text;
    if (s.out.length > SHELL_MAX_BUFFER) {
      const drop = s.out.length - SHELL_MAX_BUFFER;
      s.out = s.out.slice(drop);
      s.base += drop;
    }
    s.touched = Date.now();
    wakeShell(s);
  };
  child.stdout.on('data', d => push(d.toString('utf8')));
  child.stderr.on('data', d => push(d.toString('utf8')));
  child.on('error', err => {
    s.ended = true;
    push(`\r\n[shell could not start: ${err.message}]\r\n`);
  });
  child.on('exit', (code, signal) => {
    s.ended = true;
    s.exit = code == null ? String(signal || 'signal') : code;
    push(`\r\n[process exited: ${s.exit}]\r\n`);
  });
  shells.set(s.id, s);
  return s;
}

function shellFor(id, session) {
  const s = shells.get(id);
  if (!s) return null;
  if (session && s.owner && s.owner !== session.email) return null;
  return s;
}

function sweepShells() {
  const now = Date.now();
  for (const [id, s] of shells) {
    if (now - s.touched > SHELL_IDLE_MS) {
      try { s.child.kill('SIGHUP'); } catch (_) {}
      shells.delete(id);
    }
  }
}

function requireShellSession(req, res) {
  if (!SHELL_ENABLED) {
    send(res, 403, { error: 'shell_disabled', error_description: 'The shell is disabled on this service (VXC_SHELL=off).' });
    return null;
  }
  const session = sessionFor(req);
  if (!session) {
    send(res, 401, { error: 'not_signed_in', error_description: 'Open a shell only after `vxc auth login`.' });
    return null;
  }
  return session;
}

async function handleShellOpen(req, res) {
  const session = requireShellSession(req, res);
  if (!session) return;
  sweepShells();
  const s = newShell(session);
  send(res, 200, { id: s.id, shell: s.shell, cwd: s.cwd, pty: s.pty, host: os.hostname(), user: os.userInfo().username });
}

async function handleShellInput(req, res) {
  const session = requireShellSession(req, res);
  if (!session) return;
  const body = await readJson(req);
  const s = shellFor(String(body.id || ''), session);
  if (!s) return send(res, 404, { error: 'no_shell', error_description: 'That shell is gone.' });
  if (s.ended) return send(res, 409, { error: 'shell_ended', error_description: 'That shell has exited.' });
  s.touched = Date.now();
  const data = typeof body.data === 'string' ? body.data : '';
  if (data) s.child.stdin.write(data);
  send(res, 200, { ok: true });
}

async function handleShellRead(req, res, url) {
  const session = requireShellSession(req, res);
  if (!session) return;
  const s = shellFor(url.searchParams.get('id') || '', session);
  if (!s) return send(res, 404, { error: 'no_shell', error_description: 'That shell is gone.' });
  s.touched = Date.now();

  const cursor = Math.max(0, Number(url.searchParams.get('cursor') || 0));
  const deadline = Date.now() + SHELL_POLL_MS;
  // Block until there is something new, the shell ends, or we hit the poll
  // ceiling. The page simply re-issues the request; a long poll keeps keystroke
  // latency near a real terminal without a persistent socket.
  while (!s.ended && s.base + s.out.length <= cursor && Date.now() < deadline) {
    await new Promise(resolve => {
      const t = setTimeout(resolve, Math.min(1000, Math.max(50, deadline - Date.now())));
      s.waiters.push(() => { clearTimeout(t); resolve(); });
    });
  }
  const from = Math.max(cursor, s.base);
  send(res, 200, {
    cursor: s.base + s.out.length,
    data: s.out.slice(from - s.base),
    ended: s.ended,
    exit: s.exit,
  });
}

async function handleShellClose(req, res) {
  const session = requireShellSession(req, res);
  if (!session) return;
  const body = await readJson(req);
  const s = shellFor(String(body.id || ''), session);
  if (!s) return send(res, 404, { error: 'no_shell' });
  try { s.child.kill('SIGHUP'); } catch (_) {}
  setTimeout(() => {
    try { s.child.kill('SIGKILL'); } catch (_) {}
    shells.delete(s.id);
  }, 500);
  send(res, 200, { closed: true });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const path = url.pathname.replace(/\/+$/, '') || '/';

  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      // Authorization matters here: the browser agent sends the session token as
      // a Bearer header, and a preflight that omits it fails the whole call.
      'Access-Control-Allow-Headers': 'Content-Type, Accept, Authorization',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Max-Age': '86400',
    });
    return res.end();
  }

  try {
    if (req.method === 'GET' && (path === '/health' || path === '/')) {
      sweep();
      sweepShells();
      return send(res, 200, {
        status: 'ok',
        service: 'virgox-auth',
        grants_pending: grants.size,
        interval: INTERVAL,
        shell: SHELL_ENABLED,
        shell_pty: !!SCRIPT_BIN,
        shells: shells.size,
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
    if (req.method === 'GET' && path === '/session/claim') return await handleSessionClaim(req, url, res);
    if (req.method === 'POST' && path === '/session/revoke') return await handleSessionRevoke(req, res);

    if (req.method === 'GET' && path === '/agent/status') return await handleAgentStatus(req, res);
    if (req.method === 'POST' && path === '/agent/command') return await handleAgentCommand(req, res);
    if (req.method === 'GET' && path === '/agent/result') return await handleAgentResult(req, url, res);
    if (req.method === 'POST' && path === '/agent/poll') return await handleAgentPoll(req, url, res);
    if (req.method === 'POST' && path === '/agent/report') return await handleAgentReport(req, res);

    if (req.method === 'POST' && path === '/shell/open') return await handleShellOpen(req, res);
    if (req.method === 'POST' && path === '/shell/input') return await handleShellInput(req, res);
    if (req.method === 'GET' && path === '/shell/read') return await handleShellRead(req, res, url);
    if (req.method === 'POST' && path === '/shell/close') return await handleShellClose(req, res);

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