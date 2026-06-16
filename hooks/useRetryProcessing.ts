import * as React from 'react';
import { useDocuments } from '../contexts/DocumentContext';
import { useUser } from '../contexts/UserContext';
import { processDocument, BackgroundOcrRequired, triggerBackgroundOcr } from '../services/geminiService';
import { supabase } from '../services/supabaseClient';
import { uploadFileToStorage } from '../services/storageUpload';
import { getErrorMessage } from '../utils/errors';
import { isPasswordProtectedPdfError } from '../utils/pdfPassword';
import { t } from '../services/uiStrings';
import type { DocumentData, DocumentProcessingState, ProcessingModel } from '../types';

async function ensureStoredDocumentForRetry(doc: DocumentData, file: File): Promise<void> {
    if (!doc.storagePath || doc.uploadState === 'uploaded') return;

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError) throw userError;
    if (!user) throw new Error('로그인이 필요합니다.');

    if (doc.uploadState === 'failed' || doc.uploadState === 'pending') {
        await supabase.storage.from('docs').remove([doc.storagePath]).catch(() => undefined);
        await uploadFileToStorage('docs', doc.storagePath, file);
    }

    const { error: upsertError } = await supabase
        .from('documents')
        .upsert({
            id: doc.id,
            user_id: user.id,
            folder_id: doc.folderId,
            file_name: doc.fileName,
            file_size: file.size,
            file_mime: doc.fileMime ?? file.type,
            file_type: doc.fileType,
            storage_path: doc.storagePath,
            summary: doc.summary ?? '',
            chat_history: doc.chatHistory,
            preset_questions: doc.presetQuestions ?? null,
            token_count: doc.tokenCount ?? null,
            processing_state: 'reading',
            error_message: null,
            model: doc.model,
            answer_scope: doc.answerScope,
            monkey_mode: doc.monkeyMode,
            document_content: doc.documentContent ?? null,
        }, { onConflict: 'id' });

    if (upsertError) throw upsertError;
}

export const useRetryProcessing = () => {
    const { state, dispatch } = useDocuments();
    const { userProfile } = useUser();
    const language = userProfile?.language ?? null;
    const [retryingIds, setRetryingIds] = React.useState<Set<string>>(new Set());

    const retry = React.useCallback(async (docId: string) => {
        const doc = state.documents.find(d => d.id === docId);
        if (!doc || retryingIds.has(docId)) return;

        setRetryingIds(prev => new Set(prev).add(docId));
        dispatch({
            type: 'UPDATE_DOCUMENT',
            payload: { docId, updates: { processingState: 'reading', errorMessage: undefined } },
        });

        let file = doc.file;

        if (!file && doc.storagePath) {
            const { data, error } = await supabase.storage.from('docs').download(doc.storagePath);
            if (error || !data) {
                dispatch({ type: 'UPDATE_DOCUMENT', payload: { docId, updates: { processingState: 'error', errorMessage: 'Could not download file. Please re-upload.' } } });
                setRetryingIds(prev => { const s = new Set(prev); s.delete(docId); return s; });
                return;
            }
            file = new File([data], doc.fileName, { type: doc.fileMime || 'application/octet-stream' });
            dispatch({ type: 'UPDATE_DOCUMENT', payload: { docId, updates: { file } } });
        }

        if (!file) {
            dispatch({ type: 'UPDATE_DOCUMENT', payload: { docId, updates: { processingState: 'error', errorMessage: 'File not available. Please re-upload the document.' } } });
            setRetryingIds(prev => { const s = new Set(prev); s.delete(docId); return s; });
            return;
        }

        const onProgress = (progressState: DocumentProcessingState) => {
            dispatch({ type: 'UPDATE_DOCUMENT', payload: { docId, updates: { processingState: progressState } } });
        };

        // Live-update the summary as it streams in (throttled so a long
        // summary doesn't dispatch on every network chunk).
        let lastSummaryDispatch = 0;
        const onSummaryChunk = (partial: string) => {
            const now = Date.now();
            if (now - lastSummaryDispatch < 150) return;
            lastSummaryDispatch = now;
            dispatch({ type: 'UPDATE_DOCUMENT', payload: { docId, updates: { summary: partial } } });
        };

        try {
            await ensureStoredDocumentForRetry(doc, file);
            dispatch({ type: 'UPDATE_DOCUMENT', payload: { docId, updates: { uploadState: 'uploaded' } } });

            const model: ProcessingModel = doc.fileType === 'image' ? 'gemini-flash-latest' : doc.model as ProcessingModel;
            const { summary, presetQuestions, chat, tokenCount, documentContent } = await processDocument(
                file,
                model,
                onProgress,
                language,
                onSummaryChunk,
                doc.storagePath,
            );

            dispatch({
                type: 'UPDATE_DOCUMENT',
                payload: { docId, updates: { summary, presetQuestions, chat, tokenCount, documentContent, processingState: 'done' } },
            });

            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                await supabase.from('documents').update({
                    summary,
                    preset_questions: presetQuestions ?? null,
                    token_count: tokenCount ?? null,
                    document_content: documentContent ?? null,
                    processing_state: 'done',
                    error_message: null,
                }).eq('id', docId).eq('user_id', user.id);
            }
        } catch (err) {
            // Large scan → hand to background OCR (15-min limit) and park
            // in 'queued'; useBackgroundProcessing delivers the result.
            if (err instanceof BackgroundOcrRequired) {
                const ocrModel: ProcessingModel = doc.fileType === 'image' ? 'gemini-flash-latest' : doc.model as ProcessingModel;
                try {
                    await triggerBackgroundOcr({
                        documentId: docId,
                        storagePath: doc.storagePath!,
                        model: ocrModel,
                        mimeType: doc.fileMime || file.type || 'application/octet-stream',
                        fileName: doc.fileName,
                    });
                    dispatch({ type: 'UPDATE_DOCUMENT', payload: { docId, updates: { processingState: 'queued', errorMessage: undefined } } });
                    const { data: { user } } = await supabase.auth.getUser();
                    if (user) {
                        await supabase.from('documents').update({ processing_state: 'queued', error_message: null }).eq('id', docId).eq('user_id', user.id);
                    }
                } catch (bgErr) {
                    const bgMsg = getErrorMessage(bgErr);
                    dispatch({ type: 'UPDATE_DOCUMENT', payload: { docId, updates: { processingState: 'error', errorMessage: bgMsg } } });
                    const { data: { user } } = await supabase.auth.getUser();
                    if (user) {
                        await supabase.from('documents').update({ processing_state: 'error', error_message: bgMsg }).eq('id', docId).eq('user_id', user.id);
                    }
                }
                return;
            }
            // FILE_TOO_LARGE sentinel: callGemini raises it when our 4MB
            // body cap kicked in (e.g. a single big raw image). Swap in
            // localized guidance instead of leaking the raw HTTP code.
            const raw = err instanceof Error ? err.message : '';
            const msg = isPasswordProtectedPdfError(err)
                ? t('file.passwordProtectedPdf', language)
                : raw === 'FILE_TOO_LARGE'
                    ? t('file.tooLarge', language)
                    : getErrorMessage(err);
            dispatch({ type: 'UPDATE_DOCUMENT', payload: { docId, updates: { processingState: 'error', errorMessage: msg } } });
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                await supabase.from('documents').update({ processing_state: 'error', error_message: msg }).eq('id', docId).eq('user_id', user.id);
            }
        } finally {
            setRetryingIds(prev => { const s = new Set(prev); s.delete(docId); return s; });
        }
    }, [state.documents, dispatch, retryingIds, language]);

    return { retry, retryingIds };
};
