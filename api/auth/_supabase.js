import { createClient } from '@supabase/supabase-js';

let _supabase = null;
let _supabaseAdmin = null;

function getSupabase() {
  if (!_supabase) {
    const url = process.env.SUPABASE_URL;
    const anon = process.env.SUPABASE_ANON_KEY;
    if (!url || !anon) throw new Error('SUPABASE_URL and SUPABASE_ANON_KEY must be set');
    _supabase = createClient(url, anon);
  }
  return _supabase;
}

function getSupabaseAdmin() {
  if (!_supabaseAdmin) {
    const url = process.env.SUPABASE_URL;
    const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !service) throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set');
    _supabaseAdmin = createClient(url, service);
  }
  return _supabaseAdmin;
}

export const supabase = new Proxy({}, {
  get(_, prop) { return getSupabase()[prop]; }
});

export const supabaseAdmin = new Proxy({}, {
  get(_, prop) { return getSupabaseAdmin()[prop]; }
});
