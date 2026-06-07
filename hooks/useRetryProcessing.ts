import * as React from 'react';
import { useDocuments } from '../contexts/DocumentContext';
import { useUser } from '../contexts/UserContext';
import { processDocument } from '../services/geminiService';
import { supabase } from '../services/supabaseClient';
import { getErrorMessage } from '../utils/errors';
import type { DocumentProcessingState, ProcessingModel } from '../types';

export const useRetryProcessing = () => {
    const { state, dispatch } = useDocuments();
    const { userProfile } = useUser();
    const language = userProfile?.language ?? null;
    const [retryingIds, setRetryingIds] = React.useState<Set<string>>(new Set());

    const retry = React.useCallback(async (docId: string) => {
        const doc = state.documents.find(d => d.id === docId);
        if (!doc || retryingIds.has(docId)) return;

        setRetryingIds(prev => new Set(prev).add(docId));

        let file = doc.file;

        if (!file && doc.storagePath) {
            dispatch({ type: 'UPDATE_DOCUMENT', payload: { docId, updates: { processingState: 'reading' } } });
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

        dispatch({ type: 'UPDATE_DOCUMENT', payload: { docId, updates: { processingState: 'reading', errorMessage: undefined } } });

        const onProgress = (progressState: DocumentProcessingState) => {
            dispatch({ type: 'UPDATE_DOCUMENT', payload: { docId, updates: { processingState: progressState } } });
        };

        try {
            const model: ProcessingModel = doc.fileType === 'image' ? 'gemini-flash-latest' : doc.model as ProcessingModel;
            const { summary, presetQuestions, chat, tokenCount, documentContent } = await processDocument(file, model, onProgress, language);

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
            const msg = getErrorMessage(err);
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
