-- Run this in Supabase SQL Editor (Dashboard → SQL Editor → New Query)

-- Accounts table
CREATE TABLE IF NOT EXISTS accounts (
  email TEXT PRIMARY KEY,
  salt TEXT NOT NULL,
  hash TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Sessions table
CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  email TEXT NOT NULL REFERENCES accounts(email) ON DELETE CASCADE,
  type TEXT DEFAULT 'session', -- 'session', 'claim', 'shell', 'agent_cmd'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  data JSONB,
  buffer TEXT
);

-- Device codes table (for device flow)
CREATE TABLE IF NOT EXISTS device_codes (
  device_code TEXT PRIMARY KEY,
  user_code TEXT NOT NULL UNIQUE,
  client_id TEXT NOT NULL,
  scope TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  approved BOOLEAN DEFAULT FALSE,
  account_email TEXT REFERENCES accounts(email) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_sessions_email ON sessions(email);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_device_codes_user_code ON device_codes(user_code);
CREATE INDEX IF NOT EXISTS idx_device_codes_expires ON device_codes(expires_at);

-- Enable Row Level Security (optional - for extra safety)
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE device_codes ENABLE ROW LEVEL SECURITY;

-- Policies: service_role bypasses RLS, anon can only access via our API endpoints
-- (Our serverless functions use service_role key, so they have full access)

-- Helpful: auto-cleanup expired sessions/device_codes
-- You can schedule this via pg_cron or a daily cron job:
-- DELETE FROM sessions WHERE expires_at < NOW();
-- DELETE FROM device_codes WHERE expires_at < NOW();
