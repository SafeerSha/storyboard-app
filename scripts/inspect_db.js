const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const envText = fs.readFileSync('.env', 'utf8');
const env = {};
envText.split(/\r?\n/).forEach(line => {
  const m = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (m) {
    let v = m[2] || '';
    if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1);
    env[m[1]] = v.trim();
  }
});

const url = env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(url, key);

async function run() {
  const { data: fps, error: e1 } = await supabase.from('freelancer_profiles').select('id, name, email, role, status');
  console.log('FREELANCERS:', JSON.stringify(fps, null, 2));

  const { data: tus, error: e2 } = await supabase.from('team_users').select('id, name, username, role, status');
  console.log('TEAM_USERS:', JSON.stringify(tus, null, 2));

  const { data: items, error: e3 } = await supabase.from('project_inbox_items').select('id, title, owner_id');
  console.log('INBOX_ITEMS:', JSON.stringify(items, null, 2));

  // Check if project_inbox_members or project_inbox_insights exist
  const { data: mTest, error: e4 } = await supabase.from('project_inbox_members').select('*').limit(1);
  console.log('MEMBERS_TABLE_EXISTS:', !e4, e4 ? e4.message : 'OK');

  const { data: iTest, error: e5 } = await supabase.from('project_inbox_insights').select('*').limit(1);
  console.log('INSIGHTS_TABLE_EXISTS:', !e5, e5 ? e5.message : 'OK');

  const { data: cTest, error: e6 } = await supabase.from('project_inbox_conversations').select('*').limit(1);
  console.log('CONVERSATIONS_TABLE_EXISTS:', !e6, e6 ? e6.message : 'OK');

  const { data: aTest, error: e7 } = await supabase.from('project_inbox_ai_threads').select('*').limit(1);
  console.log('AI_THREADS_TABLE_EXISTS:', !e7, e7 ? e7.message : 'OK');
}

run();
