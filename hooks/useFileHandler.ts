import * as React from 'react';
import { useDocuments } from '../contexts/DocumentContext';
import { useUser } from '../contexts/UserContext';
import { processDocument } from '../services/geminiService';
import { supabase } from '../services/supabaseClient';
import { getErrorMessage } from '../utils/errors';
import { initialBotMessage } from '../constants';
import { maybeCompressPdf } from '../utils/pdfCompression';
import { GUEST_LIMITS } from '../types';
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

const RETRYABLE_UPLOAD_STATUSES = new Set([0, 408, 409, 429, 500, 502, 503, 504]);

const sanitizeFileName = (name: string) => {
    const extensionMatch = name.match(/\.([a-zA-Z0-9]+)$/);
    const extension = extensionMatch ? `.${extensionMatch[1].toLowerCase()}` : '';
    const baseName = extensionMatch ? name.slice(0, -extension.length) : name;
    const asciiOnly = baseName.normalize('NFKD').replace(/[^\x00-\x7F]/g, '');
    const cleaned = asciiOnly.replace(/[^a-zA-Z0-9._-]+/g, '_').replace(/^_+|_+$/g, '');
    const finalBase = cleaned || 'file';
    return `${finalBase}${extension}`;
};

const getUploadErrorMessage = (error: { status?: number; message?: string }) => {
    const status = error.status ?? 0;
    if (status === 413) return '파일이 너무 큽니다. 업로드 용량 제한을 확인해주세요.';
    if (status === 401 || status === 403) return '업로드 권한이 없습니다. 로그인 상태와 권한을 확인해주세요.';
    if (status === 409) return '같은 이름의 파일이 이미 있습니다. 이름을 변경하거나 잠시 후 다시 시도해주세요.';
    if (status === 0) return '네트워크 오류가 발생했습니다. 다시 시도해주세요.';
    return error.message || '업로드에 실패했습니다.';
};

const getFileType = (file: File): 'pdf' | 'image' | 'text' => {
    if (file.type === 'application/pdf') return 'pdf';
    if (file.type.startsWith('image/')) return 'image';
    return 'text';
};

/**
 * File upload handler.
 *
 * Guest path (no signed-in user):
 *   - Cap docs at GUEST_LIMITS.maxDocuments and per-file size at
 *     GUEST_LIMITS.maxFileSizeBytes.
 *   - Skip Supabase storage / metadata writes — documents live in
 *     memory only and disappear on refresh (matches the spec for
 *     "session-bound, no account sync").
 *   - Gemini-backed processing still works (the Netlify proxy
 *     falls back to IP rate limiting when no auth header is sent).
 *
 * Authed path: unchanged — uploads to storage, inserts metadata,
 * runs processing, then writes the result back.
 */
export const useFileHandler = (_onAuthRequired?: () => void) => {
    const { state, dispatch } = useDocuments();
    const { userProfile } = useUser();
    const language = userProfile?.language ?? null;

    return React.useCallback(async (file: File) => {
        if (!file) return;

        const { data: { user }, error: userError } = await supabase.auth.getUser();
        if (userError) {
            console.error('사용자 정보를 불러오지 못했습니다:', userError);
        }
        const isGuest = !user;

        const safeFileName = sanitizeFileName(file.name);
        const safeExtensionMatch = safeFileName.match(/\.([a-zA-Z0-9]+)$/);
        const safeExtension = safeExtensionMatch ? `.${safeExtensionMatch[1].toLowerCase()}` : '';
        const safeBaseName = safeExtensionMatch ? safeFileName.slice(0, -safeExtension.length) : safeFileName;
        const storageName = `${safeBaseName}-${Date.now()}${safeExtension}`;
        const docId = storageName;

        let targetFolderId: string | null = state.activeFolderId;
        if (!targetFolderId && state.folders.length > 0) {
            targetFolderId = state.folders[0].id;
        }

        // ── Guest-specific gating ─────────────────────────────────────────────
        if (isGuest) {
            if (state.documents.length >= GUEST_LIMITS.maxDocuments) {
                const errorDoc: DocumentData = {
                    id: docId,
                    file: null,
                    fileName: file.name,
                    fileSize: file.size,
                    fileType: 'pdf',
                    summary: '',
                    chat: null,
                    chatHistory: [],
                    processingState: 'error',
                    errorMessage: `게스트는 최대 ${GUEST_LIMITS.maxDocuments}개의 파일만 업로드할 수 있어요. 로그인하면 더 많이 올릴 수 있습니다.`,
                    model: 'gemini-2.5-flash',
                    answerScope: 'document',
                    monkeyMode: false,
                    folderId: null,
                    currentPage: 1,
                };
                dispatch({ type: 'ADD_DOCUMENT', payload: errorDoc });
                return;
            }
            if (file.size > GUEST_LIMITS.maxFileSizeBytes) {
                const mb = (GUEST_LIMITS.maxFileSizeBytes / (1024 * 1024)).toFixed(0);
                const errorDoc: DocumentData = {
                    id: docId,
                    file: null,
                    fileName: file.name,
                    fileSize: file.size,
                    fileType: 'pdf',
                    summary: '',
                    chat: null,
                    chatHistory: [],
                    processingState: 'error',
                    errorMessage: `게스트는 한 파일에 ${mb}MB까지 업로드할 수 있어요. 로그인하면 더 큰 파일도 가능합니다.`,
                    model: 'gemini-2.5-flash',
                    answerScope: 'document',
                    monkeyMode: false,
                    folderId: null,
                    currentPage: 1,
                };
                dispatch({ type: 'ADD_DOCUMENT', payload: errorDoc });
                return;
            }
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
                currentPage: 1,
            };
            dispatch({ type: 'ADD_DOCUMENT', payload: errorDoc });
            return;
        }

        const fileType = getFileType(file);
        const { file: uploadFile } = await maybeCompressPdf(file);
        const storagePath = isGuest ? '' : `${user.id}/${storageName}`;
        
        const newDoc: DocumentData = {
            id: docId,
            file: uploadFile,
            fileName: file.name,
            fileSize: uploadFile.size,
            fileMime: uploadFile.type,
            fileType,
            storagePath,
            imageUrl: fileType === 'image' ? URL.createObjectURL(uploadFile) : undefined,
            summary: '',
            chat: null,
            chatHistory: [initialBotMessage],
            processingState: 'reading',
            model: 'gemini-2.5-flash',
            answerScope: 'document',
            monkeyMode: false,
            folderId: targetFolderId,
            currentPage: 1,
        };

        dispatch({ type: 'ADD_DOCUMENT', payload: newDoc });

        // Guests skip the Supabase storage upload + metadata insert entirely.
        // Their document lives in memory only and is processed via the
        // unauthenticated Gemini path (IP-rate-limited by the Netlify proxy).
        if (!isGuest) try {
            let uploadError: { status?: number; message?: string } | null = null;
            for (let attempt = 1; attempt <= 3; attempt += 1) {
                const { error } = await supabase.storage
                    .from('docs')
                    .upload(storagePath, uploadFile, { contentType: uploadFile.type });
                if (!error) {
                    uploadError = null;
                    break;
                }
                uploadError = error;
                const status = (error as { status?: number }).status ?? 0;
                if (!RETRYABLE_UPLOAD_STATUSES.has(status) || attempt === 3) {
                    break;
                }
                await new Promise(resolve => setTimeout(resolve, 400 * attempt));
            }

            if (uploadError) {
                console.error('업로드 실패:', uploadError);
                dispatch({
                    type: 'UPDATE_DOCUMENT',
                    payload: {
                        docId,
                        updates: {
                            processingState: 'error',
                            errorMessage: getUploadErrorMessage(uploadError)
                        }
                    }
                });
                return;
            }

            const { error: insertError } = await supabase
                .from('documents')
                .insert({
                    id: docId,
                    user_id: user!.id,
                    folder_id: targetFolderId,
                    file_name: file.name,
                    file_size: uploadFile.size,
                    file_mime: uploadFile.type,
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
            const { summary, presetQuestions, chat, tokenCount, documentContent } = await processDocument(uploadFile, modelForProcessing, onProgress, language);
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

            if (!isGuest) {
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
                    .eq('user_id', user!.id);

                if (updateError) {
                    console.error('문서 처리 결과 저장에 실패했습니다:', updateError);
                }
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

            if (!isGuest) {
                await supabase
                    .from('documents')
                    .update({
                        processing_state: 'error',
                        error_message: getErrorMessage(error),
                    })
                    .eq('id', docId)
                    .eq('user_id', user!.id);
            }
        }
    }, [dispatch, state.activeFolderId, state.folders, language]);
};
