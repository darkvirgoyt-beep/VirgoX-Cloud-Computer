import { supabase, supabaseAdmin } from './_supabase.js';
import crypto from 'crypto';

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
  for (let i = 0; i < 8; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

async function cleanExpired(table, key = 'expires') {
  const now = new Date().toISOString();
  await supabaseAdmin.from(table).delete().lt(key, now);
}

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
}

// ===== ACCOUNTS =====
export async function getAccounts() {
  const { data, error } = await supabaseAdmin.from('accounts').select('*');
  if (error) throw error;
  const map = {};
  for (const row of data || []) map[row.email] = row;
  return map;
}

export async function saveAccounts(accounts) {
  const rows = Object.values(accounts);
  if (rows.length === 0) return;
  const { error } = await supabaseAdmin.from('accounts').upsert(rows, { onConflict: 'email' });
  if (error) throw error;
}

// ===== SESSIONS =====
export async function getSessions() {
  const { data, error } = await supabaseAdmin.from('sessions').select('*');
  if (error) throw error;
  const map = {};
  for (const row of data || []) map[row.token] = row;
  return map;
}

export async function saveSessions(sessions) {
  const rows = Object.values(sessions);
  if (rows.length === 0) return;
  const { error } = await supabaseAdmin.from('sessions').upsert(rows, { onConflict: 'token' });
  if (error) throw error;
}

// ===== DEVICE CODES =====
export async function getDeviceCodes() {
  const { data, error } = await supabaseAdmin.from('device_codes').select('*');
  if (error) throw error;
  const map = {};
  for (const row of data || []) map[row.device_code] = row;
  return map;
}

export async function saveDeviceCodes(codes) {
  const rows = Object.values(codes);
  if (rows.length === 0) return;
  const { error } = await supabaseAdmin.from('device_codes').upsert(rows, { onConflict: 'device_code' });
  if (error) throw error;
}

export { hashPassword, genSalt, genToken, genCode, cleanExpired, cors };
