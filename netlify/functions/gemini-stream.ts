import {
  keyPool,
  streamGeneratedText,
  extractMessage,
  getUserIdFromToken,
  checkTierLimit,
  tooManyRequestsByIp,
  ALLOWED_MODELS,
  MAX_TEXT_CHARS,
  STREAM_ERROR_SENTINEL,
} from './lib/shared';
import { routedStream } from './lib/router';

// Streaming Gemini proxy (Netlify Functions v2). Long generations — the
// document summary above all — blow past the 10s buffered-response limit
// and surface as 504s. Streaming starts the response as soon as the first
// token arrives, so the gateway never times out and the client can render
// text live.
//
// Protocol: plain text chunks. If the upstream fails AFTER streaming has
// begun (status already sent), the body ends with STREAM_ERROR_SENTINEL +
// message and the client throws. Pre-stream failures use real HTTP codes.

interface StreamRequest {
  model: string;
  contents: unknown;
  config?: { temperature?: number; responseMimeType?: string };
  task?: string;
}

export default async (req: Request): Promise<Response> => {
  if (req.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 });
  }
  if (keyPool.size() === 0) {
    return Response.json({ error: 'Server missing GEMINI_API_KEY' }, { status: 500 });
  }

  const ip =
    req.headers.get('x-nf-client-connection-ip') ||
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    'unknown';

  // Same auth + metering as the buffered proxy: a streamed generation is
  // still one counted AI action.
  const userId = await getUserIdFromToken(req.headers.get('authorization') ?? undefined);
  if (userId) {
    const { allowed, error } = await checkTierLimit(userId);
    if (!allowed) {
      return Response.json({ error: error ?? 'Daily AI limit reached. Upgrade to Pro.' }, { status: 429 });
    }
  } else if (tooManyRequestsByIp(ip)) {
    return Response.json({ error: 'Rate limit exceeded. Please sign in or try again later.' }, { status: 429 });
  }

  let parsed: StreamRequest;
  try {
    parsed = (await req.json()) as StreamRequest;
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  // Model is only validated for the non-routed path; routed tasks pick
  // their own (server-controlled) models from the route table.
  if (!parsed.task && !ALLOWED_MODELS.has(parsed.model)) {
    return Response.json({ error: `Unsupported model: ${String(parsed.model)}` }, { status: 400 });
  }
  if (typeof parsed.contents === 'string' && parsed.contents.length > MAX_TEXT_CHARS) {
    return Response.json({ error: 'Prompt too large' }, { status: 400 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const emit = (chunk: string) => { controller.enqueue(encoder.encode(chunk)); };
      try {
        if (parsed.task) {
          // Multi-provider routing (Gemini → Groq → Cerebras) by task type.
          await routedStream(
            parsed.task,
            {
              prompt: typeof parsed.contents === 'string' ? parsed.contents : String(parsed.contents),
              json: parsed.config?.responseMimeType === 'application/json',
              temperature: parsed.config?.temperature,
            },
            emit,
          );
        } else {
          await streamGeneratedText(
            parsed.model,
            { contents: parsed.contents, config: parsed.config },
            emit,
          );
        }
      } catch (err) {
        console.error('gemini-stream error', err);
        controller.enqueue(encoder.encode(STREAM_ERROR_SENTINEL + extractMessage(err)));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'content-type': 'text/plain; charset=utf-8',
      'cache-control': 'no-store',
    },
  });
};
