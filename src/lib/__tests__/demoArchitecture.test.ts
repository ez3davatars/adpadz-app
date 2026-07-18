import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const selfContainedDemoFiles = [
  'src/lib/demoWorkspace.ts',
  'src/lib/demoPresets.ts',
  'src/lib/demoRouting.ts',
  'src/pages/DemoWorkspace.tsx',
  'src/pages/DemoShowcase.tsx',
  'src/components/demo/DemoBusinessSelector.tsx',
  'src/components/demo/DemoAuditPanel.tsx',
];

describe('self-contained demo architecture', () => {
  it('does not import Supabase or issue database writes from demo modules', () => {
    for (const relativePath of selfContainedDemoFiles) {
      const source = readFileSync(resolve(process.cwd(), relativePath), 'utf8');
      expect(source, relativePath).not.toMatch(/from\s+['"].*supabase/i);
      expect(source, relativePath).not.toMatch(/supabase\s*\.\s*from\s*\(/i);
      expect(source, relativePath).not.toMatch(/\.(insert|update|upsert|delete)\s*\(/);
      expect(source, relativePath).not.toMatch(/auth\.(signIn|signUp|signOut)/);
    }
  });
});
