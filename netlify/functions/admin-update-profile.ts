import type { Handler } from '@netlify/functions';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { getUserIdFromToken } from './lib/shared';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DEFAULT_ADMIN_EMAILS = ['voicemakesme@gmail.com'];

type AdminPatch = {
  userId: string;
  tier?: 'free' | 'pro';
  role?: 'user' | 'admin';
};

type ProfileGateRow = {
  role?: string | null;
  email?: string | null;
  account_status?: string | null;
};

type JsonResult =
  | { ok: true; value: AdminPatch }
  | { ok: false; status: number; error: string };

function json(statusCode: number, body: unknown) {
  return {
    statusCode,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
    body: JSON.stringify(body),
  };
}

function getHeader(eventHeaders: Record<string, string | undefined>, name: string): string | undefined {
  return eventHeaders[name] ?? eventHeaders[name.toLowerCase()];
}

export function adminEmailAllowlist(env = process.env): string[] {
  const configured = `${env.ADMIN_EMAILS ?? ''},${env.VITE_ADMIN_EMAILS ?? ''}`;
  return [
    ...new Set([
      ...DEFAULT_ADMIN_EMAILS,
      ...configured.split(',').map(email => email.trim()).filter(Boolean),
    ].map(email => email.toLowerCase())),
  ];
}

export function canUpdateProfilesAsAdmin(profile: ProfileGateRow | null, authEmail: string | null): boolean {
  if (profile?.account_status === 'inactive') return false;
  if (profile?.role === 'admin') return true;
  return Boolean(authEmail && adminEmailAllowlist().includes(authEmail.toLowerCase()));
}

export function parseAdminUpdatePayload(raw: string | null): JsonResult {
  let body: unknown;
  try {
    body = JSON.parse(raw || '{}');
  } catch {
    return { ok: false, status: 400, error: 'Invalid JSON' };
  }

  if (!body || typeof body !== 'object') {
    return { ok: false, status: 400, error: 'Invalid request body' };
  }

  const candidate = body as Record<string, unknown>;
  const userId = typeof candidate.userId === 'string' ? candidate.userId : '';
  const tier = candidate.tier;
  const role = candidate.role;
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  if (!uuidPattern.test(userId)) {
    return { ok: false, status: 400, error: 'Invalid user id' };
  }
  if (tier !== undefined && tier !== 'free' && tier !== 'pro') {
    return { ok: false, status: 400, error: 'Invalid tier' };
  }
  if (role !== undefined && role !== 'user' && role !== 'admin') {
    return { ok: false, status: 400, error: 'Invalid role' };
  }
  if (tier === undefined && role === undefined) {
    return { ok: false, status: 400, error: 'No profile update requested' };
  }

  return {
    ok: true,
    value: {
      userId,
      ...(tier === 'free' || tier === 'pro' ? { tier } : {}),
      ...(role === 'user' || role === 'admin' ? { role } : {}),
    },
  };
}

async function readProfileGate(admin: SupabaseClient, userId: string): Promise<ProfileGateRow | null> {
  const withStatus = await admin
    .from('profiles')
    .select('role,email,account_status')
    .eq('id', userId)
    .maybeSingle();

  if (!withStatus.error) return withStatus.data as ProfileGateRow | null;
  if (!/account_status|schema cache|column/i.test(withStatus.error.message)) {
    throw new Error(withStatus.error.message);
  }

  const legacy = await admin
    .from('profiles')
    .select('role,email')
    .eq('id', userId)
    .maybeSingle();

  if (legacy.error) throw new Error(legacy.error.message);
  return legacy.data as ProfileGateRow | null;
}

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });
  if (!SUPABASE_URL || !SERVICE_KEY) {
    return json(500, { error: 'Server missing Supabase service credentials' });
  }

  const parsed = parseAdminUpdatePayload(event.body);
  if (parsed.ok === false) return json(parsed.status, { error: parsed.error });

  const authHeader = getHeader(event.headers, 'authorization');
  const callerId = await getUserIdFromToken(authHeader);
  if (!callerId) return json(401, { error: 'Not authenticated' });
  if (parsed.value.role && parsed.value.userId === callerId) {
    return json(400, { error: 'Admins cannot change their own role from this endpoint' });
  }

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    const [{ data: authUser }, callerProfile] = await Promise.all([
      admin.auth.admin.getUserById(callerId),
      readProfileGate(admin, callerId),
    ]);
    const authEmail = authUser.user?.email ?? callerProfile?.email ?? null;
    if (!canUpdateProfilesAsAdmin(callerProfile, authEmail)) {
      return json(403, { error: 'Access denied: admin role required' });
    }

    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (parsed.value.tier) patch.tier = parsed.value.tier;
    if (parsed.value.role) patch.role = parsed.value.role;

    const { data, error } = await admin
      .from('profiles')
      .update(patch)
      .eq('id', parsed.value.userId)
      .select('id')
      .maybeSingle();

    if (error) {
      console.error('[admin-update-profile] update failed', error);
      return json(500, { error: error.message });
    }
    if (!data) return json(404, { error: 'Profile not found' });

    return json(200, { ok: true });
  } catch (error) {
    console.error('[admin-update-profile] unexpected failure', error);
    return json(500, { error: error instanceof Error ? error.message : 'Admin update failed' });
  }
};
