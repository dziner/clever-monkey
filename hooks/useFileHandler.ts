// Fix: Use namespace import for React for consistency.
import * as React from 'react';
import { useDocuments } from '../contexts/DocumentContext';
import { processDocument } from '../services/geminiService';
import { supabase } from '../services/supabaseClient';
import { getErrorMessage } from '../utils/errors';
import { initialBotMessage } from '../constants';
import type { DocumentData, DocumentProcessingState, ProcessingModel } from '../types';

const SUPPORTED_MIME_TYPES = [
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/heic',
    'image/heif',
    'text/plain',
    'text/markdown',
];

const getFileType = (file: File): 'pdf' | 'image' | 'text' => {
    if (file.type === 'application/pdf') return 'pdf';
    if (file.type.startsWith('image/')) return 'image';
    return 'text';
};

export const useFileHandler = () => {
    const { state, dispatch } = useDocuments();

    return React.useCallback(async (file: File) => {
        if (!file) return;

        const { data: { user }, error: userError } = await supabase.auth.getUser();
        if (userError) {
            console.error('사용자 정보를 불러오지 못했습니다:', userError);
        }
        if (!user) {
            console.error('로그인이 필요합니다.');
            return;
        }
        
        const docId = `${file.name}-${Date.now()}`;
        
        let targetFolderId: string | null = state.activeFolderId;
        if (!targetFolderId && state.folders.length > 0) {
            targetFolderId = state.folders[0].id;
        }

        if (!SUPPORTED_MIME_TYPES.includes(file.type)) {
            const errorDoc: DocumentData = {
                id: docId,
                file: null,
                fileName: file.name,
                fileSize: file.size,
                fileType: 'pdf', // Fallback type for error display
                summary: '',
                chat: null,
                chatHistory: [],
                processingState: 'error',
                errorMessage: `Unsupported file type: '${file.type}'. Please upload a PDF, a supported image (JPEG, PNG, WEBP, HEIC, HEIF), or a text/markdown file.`,
                model: 'gemini-2.5-flash',
                answerScope: 'document',
                monkeyMode: false,
                folderId: targetFolderId,
            };
            dispatch({ type: 'ADD_DOCUMENT', payload: errorDoc });
            return;
        }
        
        const fileType = getFileType(file);
        const storagePath = `${user.id}/${file.name}`;
        
        const newDoc: DocumentData = {
            id: docId,
            file,
            fileName: file.name,
            fileSize: file.size,
            fileMime: file.type,
            fileType,
            storagePath,
            imageUrl: fileType === 'image' ? URL.createObjectURL(file) : undefined,
            summary: '',
            chat: null,
            chatHistory: [initialBotMessage],
            processingState: 'reading',
            model: 'gemini-2.5-flash',
            answerScope: 'document',
            monkeyMode: false,
            folderId: targetFolderId,
        };

        dispatch({ type: 'ADD_DOCUMENT', payload: newDoc });

        try {
            const { error: insertError } = await supabase
                .from('documents')
                .insert({
                    id: docId,
                    user_id: user.id,
                    folder_id: targetFolderId,
                    file_name: file.name,
                    file_size: file.size,
                    file_mime: file.type,
                    file_type: fileType,
                    storage_path: storagePath,
                    summary: '',
                    chat_history: [initialBotMessage],
                    processing_state: 'reading',
                    model: newDoc.model,
                    answer_scope: newDoc.answerScope,
                    monkey_mode: newDoc.monkeyMode,
                    document_content: null,
                });

            if (insertError) {
                console.error('문서 메타데이터 저장에 실패했습니다:', insertError);
                dispatch({
                    type: 'UPDATE_DOCUMENT',
                    payload: {
                        docId,
                        updates: {
                            processingState: 'error',
                            errorMessage: '문서 메타데이터 저장에 실패했습니다.'
                        }
                    }
                });
                return;
            }

            const { error: uploadError } = await supabase.storage
                .from('docs')
                .upload(storagePath, file, { upsert: true });

            if (uploadError) {
                console.error('업로드 실패:', uploadError);
                await supabase
                    .from('documents')
                    .update({
                        processing_state: 'error',
                        error_message: '업로드에 실패했습니다.'
                    })
                    .eq('id', docId)
                    .eq('user_id', user.id);
                dispatch({
                    type: 'UPDATE_DOCUMENT',
                    payload: {
                        docId,
                        updates: {
                            processingState: 'error',
                            errorMessage: '업로드에 실패했습니다.'
                        }
                    }
                });
                return;
            }
        } catch (error) {
            console.error('업로드 처리 중 오류가 발생했습니다:', error);
            dispatch({
                type: 'UPDATE_DOCUMENT',
                payload: {
                    docId,
                    updates: {
                        processingState: 'error',
                        errorMessage: '업로드 처리 중 오류가 발생했습니다.'
                    }
                }
            });
            return;
        }
        
        const onProgress = (state: DocumentProcessingState) => {
            dispatch({
                type: 'UPDATE_DOCUMENT',
                payload: { docId, updates: { processingState: state } }
            });
        };

        try {
            const modelForProcessing: ProcessingModel = fileType === 'image' ? 'gemini-flash-latest' : newDoc.model;
            const { summary, presetQuestions, chat, tokenCount, documentContent } = await processDocument(file, modelForProcessing, onProgress);
            dispatch({
                type: 'UPDATE_DOCUMENT',
                payload: {
                    docId,
                    updates: {
                        summary,
                        presetQuestions,
                        chat,
                        tokenCount,
                        documentContent,
                        processingState: 'done'
                    }
                }
            });

            const { error: updateError } = await supabase
                .from('documents')
                .update({
                    summary,
                    preset_questions: presetQuestions ?? null,
                    chat_history: newDoc.chatHistory,
                    token_count: tokenCount ?? null,
                    document_content: documentContent ?? null,
                    processing_state: 'done',
                    error_message: null,
                })
                .eq('id', docId)
                .eq('user_id', user.id);

            if (updateError) {
                console.error('문서 처리 결과 저장에 실패했습니다:', updateError);
            }
        } catch (error) {
            console.error('Failed to process document:', error);
            dispatch({
                type: 'UPDATE_DOCUMENT',
                payload: {
                    docId,
                    updates: {
                        processingState: 'error',
                        errorMessage: getErrorMessage(error)
                    }
                }
            });

            await supabase
                .from('documents')
                .update({
                    processing_state: 'error',
                    error_message: getErrorMessage(error),
                })
                .eq('id', docId)
                .eq('user_id', user.id);
        }
    }, [dispatch, state.activeFolderId, state.folders]);
};
