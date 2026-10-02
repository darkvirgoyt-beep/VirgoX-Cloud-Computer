/**
 * Security Headers & Middleware for Vercel Serverless Functions
 */

export function securityHeaders(res) {
  // Prevent MIME sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');
  // Prevent clickjacking
  res.setHeader('X-Frame-Options', 'DENY');
  // XSS protection (legacy but harmless)
  res.setHeader('X-XSS-Protection', '1; mode=block');
  // Referrer policy
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  // Permissions policy (restrict features)
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');
  // HSTS (only on HTTPS)
  const proto = process.env.VERCEL_URL ? 'https' : 'http';
  if (proto === 'https') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  }
  // Content Security Policy
  res.setHeader('Content-Security-Policy', [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' https://accounts.google.com https://apis.google.com",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: https:",
    "connect-src 'self' https://*.supabase.co https://api.github.com https://www.googleapis.com https://accounts.google.com",
    "frame-src https://accounts.google.com",
    "form-action 'self'",
    "base-uri 'self'",
    "object-src 'none'"
  ].join('; '));

  // CORS - handled per-endpoint but set safe defaults
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization,X-Requested-With');
  res.setHeader('Access-Control-Max-Age', '86400');
}

export function cors(res, origin = '*') {
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization,X-Requested-With');
  res.setHeader('Access-Control-Max-Age', '86400');
}

export function handleOptions(req, res) {
  if (req.method === 'OPTIONS') {
    cors(res, req.headers.origin || '*');
    securityHeaders(res);
    res.status(204).end();
    return true;
  }
  return false;
}

// Input validation helpers
export function validateEmail(email) {
  if (!email || typeof email !== 'string') return false;
  const normalized = email.trim().toLowerCase();
  // RFC 5322 compliant enough for our use
  return /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/.test(normalized);
}

export function validatePassword(password) {
  if (!password || typeof password !== 'string') return { valid: false, reason: 'Password required' };
  if (password.length < 10) return { valid: false, reason: 'Password must be at least 10 characters' };
  // Require 3 of 4: lowercase, uppercase, number, symbol
  const hasLower = /[a-z]/.test(password);
  const hasUpper = /[A-Z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSymbol = /[^a-zA-Z0-9]/.test(password);
  const categories = [hasLower, hasUpper, hasNumber, hasSymbol].filter(Boolean).length;
  if (categories < 3) return { valid: false, reason: 'Password must contain 3 of: lowercase, uppercase, number, symbol' };
  return { valid: true };
}

export function validateCode(code) {
  if (!code || typeof code !== 'string') return false;
  const cleaned = code.replace(/[^A-Z0-9]/gi, '').toUpperCase();
  return cleaned.length === 8 && /^[A-Z0-9]{8}$/.test(cleaned);
}

export function sanitizeInput(input, maxLength = 500) {
  if (!input || typeof input !== 'string') return '';
  return input.slice(0, maxLength).trim();
}

// Auth token extraction
export function extractToken(req) {
  const auth = req.headers.authorization || '';
  if (auth.startsWith('Bearer ')) return auth.slice(7);
  return null;
}

// Request size check (Vercel handles body parsing, but we can check)
export function checkBodySize(req, maxBytes = 1024 * 1024) { // 1MB default
  const contentLength = req.headers['content-length'];
  if (contentLength && parseInt(contentLength) > maxBytes) {
    return false;
  }
  return true;
}
