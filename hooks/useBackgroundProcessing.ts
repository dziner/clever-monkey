import * as React from 'react';
import { useDocuments } from '../contexts/DocumentContext';
import { useUser } from '../contexts/UserContext';
import { supabase } from '../services/supabaseClient';
import { summarizeExtractedText } from '../services/geminiService';
import { logDiagnosticEvent } from '../services/diagnostics';
import { getErrorMessage } from '../utils/errors';
import type { DiagnosticFileInfo } from '../utils/diagnostics';
import type { DocumentData, ProcessingModel } from '../types';

// Drives the background-OCR lifecycle on the client:
//
//   queued      → poll the documents row until the background function
//                 flips it to 'ocr_ready' (text extracted) or 'error'.
//   ocr_ready   → run the fast summary + preset-question step locally
//                 (same code the synchronous path uses) → 'done'.
//
// Both phases are reload-safe: state lives on the documents row, so a
// user can close the tab during a multi-minute OCR and come back to a
// finished document. Mounted once, at the App level.

const POLL_INTERVAL_MS = 5000;
// Background functions cap at 15 min; stop polling a little after that so
// a job that genuinely died doesn't spin forever.
const MAX_BACKGROUND_AGE_MS = 16 * 60 * 1000;

function documentDiagnosticFile(doc: DocumentData | undefined): DiagnosticFileInfo | undefined {
  if (!doc) return undefined;
  const extensionMatch = doc.fileName.match(/\.([a-zA-Z0-9]+)$/);
  return {
    name: doc.fileName,
    sizeBytes: doc.fileSize,
    mimeType: doc.fileMime || 'application/octet-stream',
    extension: extensionMatch?.[1]?.toLowerCase() ?? '',
    fileType: doc.fileType,
  };
}

export function useBackgroundProcessing(): void {
  const { state, dispatch } = useDocuments();
  const { userProfile } = useUser();
  const language = userProfile?.language ?? null;

  const finalizingRef = React.useRef<Set<string>>(new Set());
  const pollStartRef = React.useRef<Map<string, number>>(new Map());
  const documentsRef = React.useRef(state.documents);

  React.useEffect(() => {
    documentsRef.current = state.documents;
  }, [state.documents]);

  // ── Phase 1: poll 'queued' docs for the OCR result ──────────────────
  const queuedKey = state.documents
    .filter(d => d.processingState === 'queued')
    .map(d => d.id)
    .sort()
    .join(',');

  React.useEffect(() => {
    if (!queuedKey) return;
    const ids = queuedKey.split(',');
    const startNow = Date.now();
    ids.forEach(id => { if (!pollStartRef.current.has(id)) pollStartRef.current.set(id, startNow); });

    let cancelled = false;
    const poll = async () => {
      for (const id of ids) {
        const startedAt = pollStartRef.current.get(id) ?? startNow;
        if (Date.now() - startedAt > MAX_BACKGROUND_AGE_MS) {
          const queuedForMs = Date.now() - startedAt;
          const doc = documentsRef.current.find(d => d.id === id);
          const timeoutMessage = '문서 처리가 예상보다 오래 걸려요. 다시 시도해 주세요.';
          pollStartRef.current.delete(id);
          dispatch({ type: 'UPDATE_DOCUMENT', payload: { docId: id, updates: { processingState: 'error', errorMessage: timeoutMessage } } });
          void supabase
            .from('documents')
            .update({ processing_state: 'error', error_message: timeoutMessage })
            .eq('id', id);
          void logDiagnosticEvent({
            severity: 'error',
            stage: 'processing.background_ocr.poll_timeout',
            message: 'Background OCR did not finish before client poll timeout',
            documentId: id,
            file: documentDiagnosticFile(doc),
            storagePath: doc?.storagePath,
            model: doc?.fileType === 'image' ? 'gemini-flash-latest' : doc?.model,
            processingState: 'error',
            error: {
              name: 'BackgroundOcrPollTimeout',
              message: timeoutMessage,
            },
            context: {
              queuedForMs,
              maxBackgroundAgeMs: MAX_BACKGROUND_AGE_MS,
              pollIntervalMs: POLL_INTERVAL_MS,
              previousProcessingState: 'queued',
            },
          });
          continue;
        }
        const { data, error } = await supabase
          .from('documents')
          .select('processing_state, document_content, token_count, error_message')
          .eq('id', id)
          .maybeSingle();
        if (cancelled || error || !data) continue;
        const ps = data.processing_state as string | null;
        if (ps === 'ocr_ready') {
          pollStartRef.current.delete(id);
          dispatch({ type: 'UPDATE_DOCUMENT', payload: { docId: id, updates: {
            processingState: 'ocr_ready',
            documentContent: (data.document_content as string | null) ?? undefined,
            tokenCount: (data.token_count as number | null) ?? undefined,
          } } });
        } else if (ps === 'error') {
          pollStartRef.current.delete(id);
          dispatch({ type: 'UPDATE_DOCUMENT', payload: { docId: id, updates: { processingState: 'error', errorMessage: (data.error_message as string | null) ?? '문서 처리에 실패했어요.' } } });
        }
      }
    };
    void poll(); // check immediately, then on an interval
    const interval = setInterval(poll, POLL_INTERVAL_MS);
    return () => { cancelled = true; clearInterval(interval); };
  }, [queuedKey, dispatch]);

  // ── Phase 2: finalize 'ocr_ready' docs (summary + preset) ───────────
  React.useEffect(() => {
    const ready = state.documents.filter(d =>
      d.processingState === 'ocr_ready' &&
      !!d.documentContent &&
      !finalizingRef.current.has(d.id),
    );

    for (const doc of ready) {
      finalizingRef.current.add(doc.id);
      dispatch({ type: 'UPDATE_DOCUMENT', payload: { docId: doc.id, updates: { processingState: 'summarizing' } } });

      let lastDispatch = 0;
      const onSummaryChunk = (partial: string) => {
        const now = Date.now();
        if (now - lastDispatch < 150) return;
        lastDispatch = now;
        dispatch({ type: 'UPDATE_DOCUMENT', payload: { docId: doc.id, updates: { summary: partial } } });
      };

      void (async () => {
        try {
          const model = (doc.fileType === 'image' ? 'gemini-flash-latest' : doc.model) as ProcessingModel;
          const { summary, presetQuestions } = await summarizeExtractedText(doc.documentContent!, model, language, onSummaryChunk);
          dispatch({ type: 'UPDATE_DOCUMENT', payload: { docId: doc.id, updates: { summary, presetQuestions, processingState: 'done' } } });
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            await supabase.from('documents').update({
              summary,
              preset_questions: presetQuestions ?? null,
              processing_state: 'done',
              error_message: null,
            }).eq('id', doc.id).eq('user_id', user.id);
          }
        } catch (err) {
          const msg = getErrorMessage(err);
          dispatch({ type: 'UPDATE_DOCUMENT', payload: { docId: doc.id, updates: { processingState: 'error', errorMessage: msg } } });
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            await supabase.from('documents').update({ processing_state: 'error', error_message: msg }).eq('id', doc.id).eq('user_id', user.id);
          }
        } finally {
          finalizingRef.current.delete(doc.id);
        }
      })();
    }
  }, [state.documents, language, dispatch]);
}
