import { createClient } from '@supabase/supabase-js';

const FIXTURE_KEY = 'river-city';
const PAGE_SIZE = 200;

function requiredEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error('Missing required environment variable: ' + name);
  }
  return value;
}

function readAnonKey() {
  const value = process.env.SUPABASE_ANON_KEY?.trim()
    || process.env.SUPABASE_PUBLISHABLE_KEY?.trim();

  if (!value) {
    throw new Error(
      'Missing SUPABASE_ANON_KEY (or SUPABASE_PUBLISHABLE_KEY).',
    );
  }

  return value;
}

async function findUserByEmail(adminClient, normalizedEmail) {
  for (let page = 1; page <= 1000; page += 1) {
    const { data, error } = await adminClient.auth.admin.listUsers({
      page,
      perPage: PAGE_SIZE,
    });

    if (error) {
      throw new Error('Could not list Supabase Auth users: ' + error.message);
    }

    const users = data?.users ?? [];
    const match = users.find(
      (candidate) => candidate.email?.toLowerCase() === normalizedEmail,
    );

    if (match) return match;
    if (users.length < PAGE_SIZE) return null;
  }

  throw new Error('Stopped after scanning 200,000 Auth users without a match.');
}

async function ensureDemoAuthUser(
  adminClient,
  email,
  password,
  displayName,
) {
  const existing = await findUserByEmail(adminClient, email);

  if (
    existing
    && existing.app_metadata?.is_demo !== true
  ) {
    throw new Error(
      'An existing non-demo Auth user already owns ' + email + '. Refusing '
        + 'to convert or reset that account. Use a fresh, dedicated demo email.',
    );
  }

  const userMetadata = {
    ...(existing?.user_metadata ?? {}),
    full_name: displayName,
  };
  const appMetadata = {
    ...(existing?.app_metadata ?? {}),
    is_demo: true,
    demo_fixture: FIXTURE_KEY,
  };

  if (existing) {
    const { data, error } = await adminClient.auth.admin.updateUserById(
      existing.id,
      {
        password,
        email_confirm: true,
        user_metadata: userMetadata,
        app_metadata: appMetadata,
      },
    );

    if (error || !data.user) {
      throw new Error(
        'Could not update the demo Auth user: '
          + (error?.message ?? 'missing user response'),
      );
    }

    return data.user;
  }

  const { data, error } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: userMetadata,
    app_metadata: appMetadata,
  });

  if (error || !data.user) {
    throw new Error(
      'Could not create the demo Auth user: '
        + (error?.message ?? 'missing user response'),
    );
  }

  return data.user;
}

async function provision() {
  if (process.env.VITE_SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error(
      'Refusing VITE_SUPABASE_SERVICE_ROLE_KEY. Use the server-only '
        + 'SUPABASE_SERVICE_ROLE_KEY environment variable.',
    );
  }

  const supabaseUrl = requiredEnv('SUPABASE_URL');
  const serviceRoleKey = requiredEnv('SUPABASE_SERVICE_ROLE_KEY');
  const anonKey = readAnonKey();
  const email = requiredEnv('DEMO_ACCOUNT_EMAIL').toLowerCase();
  const password = requiredEnv('DEMO_ACCOUNT_PASSWORD');
  const displayName = process.env.DEMO_ACCOUNT_DISPLAY_NAME?.trim()
    || 'Adpadz River City Demo';
  const captchaToken = process.env.DEMO_ACCOUNT_CAPTCHA_TOKEN?.trim();

  if (password.length < 12) {
    throw new Error('DEMO_ACCOUNT_PASSWORD must contain at least 12 characters.');
  }

  if (serviceRoleKey === anonKey) {
    throw new Error('The service-role key and public/anon key must be different.');
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  });

  const user = await ensureDemoAuthUser(
    adminClient,
    email,
    password,
    displayName,
  );

  const registryPayload = {
    user_id: user.id,
    email,
    fixture_key: FIXTURE_KEY,
    is_active: true,
    updated_at: new Date().toISOString(),
  };

  const { error: registryError } = await adminClient
    .from('demo_accounts')
    .upsert(registryPayload, { onConflict: 'user_id' });

  if (registryError) {
    throw new Error(
      'Could not register the private demo account. Apply the demo migration '
        + 'first. Supabase returned: ' + registryError.message,
    );
  }

  const demoClient = createClient(supabaseUrl, anonKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  });

  let resetResult;
  try {
    const signInCredentials = {
      email,
      password,
      ...(captchaToken ? { options: { captchaToken } } : {}),
    };
    const { error: signInError } = await demoClient.auth.signInWithPassword(
      signInCredentials,
    );

    if (signInError) {
      throw new Error(
        'The demo Auth user was registered but could not sign in: '
          + signInError.message
          + (captchaToken
            ? ''
            : ' If Auth CAPTCHA is enabled, provide a fresh '
              + 'DEMO_ACCOUNT_CAPTCHA_TOKEN.'),
      );
    }

    const { data, error: resetError } = await demoClient.rpc(
      'reset_demo_workspace',
    );

    if (resetError) {
      throw new Error(
        'The demo account signed in, but its workspace reset failed: '
          + resetError.message,
      );
    }

    resetResult = data;
  } finally {
    await demoClient.auth.signOut();
  }

  const output = {
    ok: true,
    user_id: user.id,
    email,
    fixture_key: FIXTURE_KEY,
    credentials_exposed: false,
    workspace: resetResult,
  };

  process.stdout.write(JSON.stringify(output, null, 2) + '\n');
}

provision().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write('Demo provisioning failed: ' + message + '\n');
  process.exitCode = 1;
});
