const { createClient } = require('@supabase/supabase-js');

let supabase;
let connected = false;

async function connectDatabase({ supabaseUrl, supabaseServiceRoleKey }) {
  if (!supabaseUrl || !supabaseServiceRoleKey) {
    throw new Error('Supabase connection failed: set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.');
  }

  supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
  const { error } = await supabase.from('users').select('id').limit(1);
  if (error) {
    connected = false;
    supabase = null;
    throw new Error(`Supabase connection failed: ${error.message}`);
  }
  connected = true;
  return supabase;
}

function getDatabase() {
  if (!supabase || !connected) throw new Error('Supabase is not connected.');
  return supabase;
}

function isDatabaseConnected() {
  return connected;
}

module.exports = { connectDatabase, getDatabase, isDatabaseConnected };
