const { createClient } = require('@supabase/supabase-js');
const env = require('./env');

const isPlaceholder = (value) => {
  const normalized = value.trim().toLowerCase();

  return (
    !normalized ||
    normalized.includes('your_') ||
    normalized.includes('placeholder') ||
    normalized.includes('dummy')
  );
};

const hasValidSupabaseConfig = () => {
  if (isPlaceholder(env.supabaseUrl) || isPlaceholder(env.supabaseServiceRoleKey)) {
    return false;
  }

  try {
    const url = new URL(env.supabaseUrl);
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
};

let supabase = null;

if (hasValidSupabaseConfig()) {
  try {
    supabase = createClient(env.supabaseUrl, env.supabaseServiceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  } catch {
    // Invalid development credentials must not prevent the API from starting.
    supabase = null;
  }
}

module.exports = supabase;
