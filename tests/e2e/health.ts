type ServiceCheck = { name: string; url: string; headers?: Record<string, string> };
export type HealthResult = { name: string; url: string; ok: boolean; status: number | null; error: string | null; checkedAt: string };

export function localHealthChecks(input: { apiUrl: string; anonKey: string; frontendUrl?: string }): ServiceCheck[] {
  const headers = { apikey: input.anonKey };
  return [
    { name: 'Supabase API gateway', url: `${input.apiUrl}/auth/v1/health`, headers },
    { name: 'Supabase Auth', url: `${input.apiUrl}/auth/v1/health`, headers },
    { name: 'PostgREST', url: `${input.apiUrl}/rest/v1/`, headers },
    { name: 'Storage', url: `${input.apiUrl}/storage/v1/status`, headers },
    ...(input.frontendUrl ? [{ name: 'Frontend', url: input.frontendUrl }] : []),
  ];
}

export async function checkService(check: ServiceCheck): Promise<HealthResult> {
  const checkedAt = new Date().toISOString();
  try {
    const response = await fetch(check.url, { headers: check.headers, signal: AbortSignal.timeout(3_000) });
    return { name: check.name, url: check.url, ok: response.ok, status: response.status, error: response.ok ? null : `HTTP ${response.status}`, checkedAt };
  } catch (error) {
    return { name: check.name, url: check.url, ok: false, status: null, error: error instanceof Error ? error.message : String(error), checkedAt };
  }
}

export async function waitForServices(checks: ServiceCheck[], options: { attempts?: number; intervalMs?: number } = {}): Promise<HealthResult[]> {
  const attempts = options.attempts ?? 20;
  const intervalMs = options.intervalMs ?? 500;
  let results: HealthResult[] = [];
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    results = await Promise.all(checks.map(checkService));
    if (results.every(result => result.ok)) return results;
    if (attempt < attempts) await new Promise(resolve => setTimeout(resolve, intervalMs));
  }
  return results;
}
