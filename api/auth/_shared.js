import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

const STORE_DIR = process.env.VERCEL ? '/tmp' : process.cwd();
const ACCOUNTS_FILE = path.join(STORE_DIR, 'accounts.json');
const SESSIONS_FILE = path.join(STORE_DIR, 'sessions.json');
const DEVICE_CODES_FILE = path.join(STORE_DIR, 'device_codes.json');

function readJSON(file, fallback = {}) {
  try {
    if (fs.existsSync(file)) {
      return JSON.parse(fs.readFileSync(file, 'utf8'));
    }
  } catch (e) {}
  return fallback;
}

function writeJSON(file, data) {
  try {
    fs.writeFileSync(file, JSON.stringify(data, null, 2));
  } catch (e) {}
}

function hashPassword(password, salt) {
  return crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('base64');
}

function genSalt() {
  return crypto.randomBytes(32).toString('base64');
}

function genToken() {
  return crypto.randomBytes(32).toString('hex');
}

function genCode() {
  const chars = 'BCDFGHJKLMNPQRSTVWXZ23456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

function getAccounts() { return readJSON(ACCOUNTS_FILE); }
function saveAccounts(accounts) { writeJSON(ACCOUNTS_FILE, accounts); }
function getSessions() { return readJSON(SESSIONS_FILE); }
function saveSessions(sessions) { writeJSON(SESSIONS_FILE, sessions); }
function getDeviceCodes() { return readJSON(DEVICE_CODES_FILE); }
function saveDeviceCodes(codes) { writeJSON(DEVICE_CODES_FILE, codes); }

function cleanExpired(obj, key = 'expires') {
  const now = Date.now();
  for (const k of Object.keys(obj)) {
    if (obj[k][key] && obj[k][key] < now) delete obj[k];
  }
}

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
}

export { readJSON, writeJSON, hashPassword, genSalt, genToken, genCode,
  getAccounts, saveAccounts, getSessions, saveSessions,
  getDeviceCodes, saveDeviceCodes, cleanExpired, cors };
