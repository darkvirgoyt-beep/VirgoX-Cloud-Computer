import { cors, getDeviceCodes, saveDeviceCodes, genToken, getSessions, saveSessions  } from '_shared.js';

module.exports = async (req, res) => {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });

  const { device_code, grant_type } = req.body || {};
  if (grant_type !== 'urn:ietf:params:oauth:grant-type:device_code') {
    return res.status(400).json({ error: 'unsupported_grant_type' });
  }

  const codes = getDeviceCodes();
  const entry = codes[device_code];
  if (!entry) return res.status(400).json({ error: 'invalid_device_code' });
  if (entry.expires < Date.now()) {
    delete codes[device_code];
    saveDeviceCodes(codes);
    return res.status(400).json({ error: 'expired_token' });
  }
  if (!entry.approved) {
    return res.status(400).json({ error: 'authorization_pending' });
  }

  const access_token = genToken();
  const refresh_token = genToken();
  const sessions = getSessions();
  sessions[access_token] = { email: entry.account_email, created: Date.now(), expires: Date.now() + 30*24*60*60*1000 };
  saveSessions(sessions);

  res.status(200).json({
    access_token,
    token_type: 'Bearer',
    expires_in: 30*24*60*60,
    refresh_token,
    scope: entry.scope
  });
};
