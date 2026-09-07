const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const env = {};
fs.readFileSync('.env', 'utf8').split(/\r?\n/).forEach(l => {
  const m = l.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (m) env[m[1]] = (m[2] || '').trim().replace(/^["']|["']$/g, '');
});
const supabase = createClient(env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
async function check() {
  const { data, error } = await supabase.rpc('exec_sql', { query: 'SELECT 1;' });
  console.log('exec_sql:', { data, error: error ? error.message : null });
}
check();
