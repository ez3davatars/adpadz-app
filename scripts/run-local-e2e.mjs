import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const status = spawnSync('supabase', ['status', '-o', 'json'], {
  encoding: 'utf8',
});
if (status.status !== 0) {
  console.error('Local Supabase must be running before E2E verification.');
  process.exit(status.status ?? 1);
}
const local = JSON.parse(status.stdout);
const checks = [
  ['Supabase API gateway', `${local.API_URL}/auth/v1/health`],
  ['Supabase Auth', `${local.API_URL}/auth/v1/health`],
  ['PostgREST', `${local.API_URL}/rest/v1/`],
  ['Storage', `${local.API_URL}/storage/v1/status`],
];
let health = [];
for (let attempt = 1; attempt <= 20; attempt += 1) {
  health = await Promise.all(checks.map(async ([name, url]) => {
    const checkedAt = new Date().toISOString();
    try {
      const response = await fetch(url, { headers: { apikey: local.ANON_KEY }, signal: AbortSignal.timeout(3000) });
      return { name, url, ok: response.ok, status: response.status, error: response.ok ? null : `HTTP ${response.status}`, checkedAt };
    } catch (error) {
      return { name, url, ok: false, status: null, error: error instanceof Error ? error.message : String(error), checkedAt };
    }
  }));
  if (health.every(result => result.ok)) break;
  if (attempt < 20) await new Promise(resolve => setTimeout(resolve, 500));
}
for (const result of health) console.log(`[health ${result.checkedAt}] ${result.name}: ${result.ok ? `HTTP ${result.status}` : result.error}`);
if (health.some(result => !result.ok)) {
  console.error('Local Supabase services did not become healthy before E2E verification.');
  process.exit(1);
}
const result = spawnSync(process.execPath, ['node_modules/@playwright/test/cli.js', 'test', ...process.argv.slice(2)], {
  stdio: 'inherit',
  env: {
    ...process.env,
    PLAYWRIGHT_ARTIFACT_ROOT: process.env.PLAYWRIGHT_ARTIFACT_ROOT ?? join(tmpdir(), 'adpadz-e2e'),
    VITE_SUPABASE_URL: local.API_URL,
    VITE_SUPABASE_ANON_KEY: local.ANON_KEY,
    VITE_PUBLIC_APP_URL: 'http://127.0.0.1:5173',
    RC_SUPABASE_URL: local.API_URL,
    RC_SUPABASE_ANON_KEY: local.ANON_KEY,
  },
});
if (result.error) console.error(result.error);
process.exit(result.status ?? 1);