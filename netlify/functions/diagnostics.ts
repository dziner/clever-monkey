import type { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';
import { extractMessage, getUserIdFromToken, tooManyRequestsByIp } from './lib/shared';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const MAX_BODY_BYTES = 64 * 1024;

type Severity = 'info' | 'warn' | 'error';

interface DiagnosticPayload {
  severity?: Severity;
  stage?: string;
  message?: string;
  clientSessionId?: string;
  documentId?: string;
  file?: {
    name?: string;
    sizeBytes?: number;
    mimeType?: string;
    extension?: string;
    fileType?: string;
  };
  storagePath?: string;
  model?: string;
  processingState?: string;
  isGuest?: boolean;
  error?: {
    name?: string;
    message?: string;
    stack?: string;
    status?: number;
    code?: string | number;
  };
  context?: Record<string, unknown>;
  userAgent?: string;
  urlPath?: string;
  occurredAt?: string;
}

function json(statusCode: number, body: unknown) {
  return {
    statusCode,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
    body: JSON.stringify(body),
  };
}

function text(value: unknown, fallback = '', maxLength = 1000): string {
  const raw = typeof value === 'string' ? value : fallback;
  return raw.length > maxLength ? `${raw.slice(0, maxLength - 1)}...` : raw;
}

function numberOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function sanitize(payload: DiagnosticPayload, userId: string | null) {
  const severity: Severity = payload.severity === 'info' || payload.severity === 'warn' || payload.severity === 'error'
    ? payload.severity
    : 'error';

  return {
    source: 'client',
    severity,
    stage: text(payload.stage, 'unknown', 120),
    message: text(payload.message, 'No diagnostic message', 1000),
    user_id: userId,
    client_session_id: text(payload.clientSessionId, '', 120) || null,
    document_id: text(payload.documentId, '', 180) || null,
    file_name: text(payload.file?.name, '', 240) || null,
    file_size: numberOrNull(payload.file?.sizeBytes),
    file_mime: text(payload.file?.mimeType, '', 120) || null,
    file_extension: text(payload.file?.extension, '', 40) || null,
    file_type: text(payload.file?.fileType, '', 40) || null,
    storage_path: text(payload.storagePath, '', 320) || null,
    model: text(payload.model, '', 120) || null,
    processing_state: text(payload.processingState, '', 80) || null,
    is_guest: Boolean(payload.isGuest),
    error_name: text(payload.error?.name, '', 160) || null,
    error_message: text(payload.error?.message, '', 1000) || null,
    error_stack: text(payload.error?.stack, '', 3000) || null,
    error_status: numberOrNull(payload.error?.status),
    error_code: payload.error?.code === undefined ? null : text(String(payload.error.code), '', 120),
    context: payload.context && typeof payload.context === 'object' ? payload.context : {},
    user_agent: text(payload.userAgent, '', 400) || null,
    url_path: text(payload.urlPath, '', 300) || null,
    occurred_at: text(payload.occurredAt, '', 80) || null,
  };
}

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });

  const ip =
    event.headers['x-nf-client-connection-ip'] ||
    event.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    'unknown';
  if (tooManyRequestsByIp(`diag:${ip}`)) return json(429, { error: 'Too many diagnostic events' });

  const raw = event.body || '';
  if (Buffer.byteLength(raw, 'utf8') > MAX_BODY_BYTES) return json(413, { error: 'Diagnostic event too large' });

  let parsed: DiagnosticPayload;
  try {
    parsed = JSON.parse(raw) as DiagnosticPayload;
  } catch {
    return json(400, { error: 'Invalid JSON' });
  }

  const userId = await getUserIdFromToken(event.headers['authorization']);
  const row = sanitize(parsed, userId);

  if (!SUPABASE_URL || !SERVICE_KEY) {
    console.warn('[diagnostics] Supabase service key missing; event not persisted', row);
    return json(202, { ok: true, persisted: false });
  }

  try {
    const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { error } = await admin.from('diagnostic_events').insert(row);
    if (error) {
      console.error('[diagnostics] insert failed; table may be missing', error, row);
      return json(202, { ok: true, persisted: false });
    }
    return json(200, { ok: true, persisted: true });
  } catch (error) {
    console.error('[diagnostics] unexpected failure', extractMessage(error), row);
    return json(202, { ok: true, persisted: false });
  }
};
