import { spawnSync } from 'node:child_process';
const status=spawnSync('supabase',['status','-o','json'],{encoding:'utf8',shell:process.platform==='win32'});
if(status.status!==0){console.error('Local Supabase must be running before E2E verification.');process.exit(status.status??1)}
const local=JSON.parse(status.stdout); const result=spawnSync('npx',['playwright','test',...process.argv.slice(2)],{stdio:'inherit',shell:process.platform==='win32',env:{...process.env,VITE_SUPABASE_URL:local.API_URL,VITE_SUPABASE_ANON_KEY:local.ANON_KEY,VITE_PUBLIC_APP_URL:'http://127.0.0.1:5173'}}); process.exit(result.status??1);
