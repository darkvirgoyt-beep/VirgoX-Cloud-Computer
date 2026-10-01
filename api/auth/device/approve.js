import { cors, getDeviceCodes, saveDeviceCodes, getAccounts, hashPassword, genSalt, genToken, getSessions, saveSessions  } from '../_shared.js';

module.exports = async (req, res) => {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });

  const { user_code, email, password, action } = req.body || {};
  if (!user_code) return res.status(400).json({ error: 'missing_user_code' });

  const codes = getDeviceCodes();
  const entry = Object.values(codes).find(c => c.user_code === user_code);
  if (!entry) return res.status(404).json({ error: 'invalid_code' });
  if (entry.expires < Date.now()) return res.status(400).json({ error: 'code_expired' });
  if (entry.approved) return res.status(400).json({ error: 'already_approved' });

  if (action === 'deny') {
    delete codes[Object.keys(codes).find(k => codes[k].user_code === user_code)];
    saveDeviceCodes(codes);
    return res.status(200).json({ status: 'denied' });
  }

  // Register or login
  const accounts = getAccounts();
  let account = accounts[email];
  if (!account) {
    if (!password || password.length < 10) {
      return res.status(400).json({ error: 'weak_password' });
    }
    const salt = genSalt();
    account = { email, salt, hash: hashPassword(password, salt), created_at: new Date().toISOString() };
    accounts[email] = account;
    saveAccounts(accounts);
  } else {
    if (hashPassword(password, account.salt) !== account.hash) {
      return res.status(401).json({ error: 'invalid_credentials' });
    }
  }

  entry.approved = true;
  entry.account_email = email;
  saveDeviceCodes(codes);

  const session_token = genToken();
  const sessions = getSessions();
  sessions[session_token] = { email, created: Date.now(), expires: Date.now() + 30*24*60*60*1000 };
  saveSessions(sessions);

  res.status(200).json({ status: 'approved', session_token, email });
};
