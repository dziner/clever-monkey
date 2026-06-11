import type { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';
import { getUserIdFromToken } from './lib/shared';

// Hard account deletion. Authenticates the caller from their JWT, then
// uses the service-role key to remove everything:
//   1. Storage objects under docs/<userId>/  (NOT covered by FK cascade)
//   2. The auth.users row — every app table (folders, documents,
//      annotations, quiz_sessions, wrong_answers, profile) references
//      auth.users(id) ON DELETE CASCADE, so this single delete clears
//      all of the user's data.
//
// Storage is deleted FIRST: removing the auth user while storage objects
// still reference it can trip Supabase's storage delete protections, so
// we empty the bucket prefix before touching auth.

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

function json(statusCode: number, body: unknown) {
  return {
    statusCode,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
    body: JSON.stringify(body),
  };
}

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });
  if (!SUPABASE_URL || !SERVICE_KEY) {
    return json(500, { error: 'Server is not configured for account deletion (missing SUPABASE_SERVICE_ROLE_KEY).' });
  }

  const userId = await getUserIdFromToken(event.headers['authorization']);
  if (!userId) return json(401, { error: 'Not authenticated' });

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    // 1) Remove the user's storage objects (paged, in case of many files).
    const paths: string[] = [];
    let offset = 0;
    const PAGE = 100;
    for (;;) {
      const { data: files, error } = await admin.storage.from('docs').list(userId, { limit: PAGE, offset });
      if (error || !files || files.length === 0) break;
      for (const f of files) paths.push(`${userId}/${f.name}`);
      if (files.length < PAGE) break;
      offset += PAGE;
    }
    if (paths.length > 0) {
      const { error: rmError } = await admin.storage.from('docs').remove(paths);
      if (rmError) console.error('[delete-account] storage remove failed', rmError);
      // Non-fatal: proceed to delete the auth user regardless so the
      // account itself is always removed even if a storage object lingers.
    }

    // 2) Delete the auth user — cascades to every app table.
    const { error } = await admin.auth.admin.deleteUser(userId);
    if (error) {
      console.error('[delete-account] auth deleteUser failed', error);
      return json(500, { error: 'Account deletion failed. Please contact support.' });
    }

    return json(200, { ok: true });
  } catch (err) {
    console.error('[delete-account] unexpected error', err);
    return json(500, { error: 'Account deletion failed. Please contact support.' });
  }
};
