import type { FullConfig } from '@playwright/test';
import { localHealthChecks, waitForServices } from './health';

export default async function globalSetup(config: FullConfig) {
  const apiUrl = process.env.RC_SUPABASE_URL;
  const anonKey = process.env.RC_SUPABASE_ANON_KEY;
  const frontendUrl = String(config.projects[0]?.use.baseURL || 'http://127.0.0.1:5173');
  if (!apiUrl || !anonKey) throw new Error('RC Supabase environment is unavailable.');
  const results = await waitForServices(localHealthChecks({ apiUrl, anonKey, frontendUrl }));
  for (const result of results) console.log(`[health ${result.checkedAt}] ${result.name}: ${result.ok ? `HTTP ${result.status}` : result.error}`);
  const failures = results.filter(result => !result.ok);
  if (failures.length > 0) throw new Error(`RC services did not become healthy: ${failures.map(result => `${result.name} (${result.error})`).join(', ')}`);
}
