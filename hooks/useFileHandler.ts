import * as React from 'react';
import { useDocuments } from '../contexts/DocumentContext';
import { useUser } from '../contexts/UserContext';
import { processDocument } from '../services/geminiService';
import { supabase } from '../services/supabaseClient';
import { StorageUploadError, uploadFileToStorage } from '../services/storageUpload';
import { getErrorMessage } from '../utils/errors';
import { assertPdfCanOpenWithoutPassword, isPasswordProtectedPdfError } from '../utils/pdfPassword';
import {
    createDiagnosticErrorInfo,
    createFileDiagnosticInfo,
    type DiagnosticEvent,
    type DiagnosticFileInfo,
} from '../utils/diagnostics';
import { logDiagnosticEvent } from '../services/diagnostics';
import { buildInitialBotMessage } from '../constants';
import { t } from '../services/uiStrings';
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

    // Snapshot the welcome message at the time of upload so a language
    // change while a file is still processing doesn't rewrite a chat the
    // user has already seen.
    const welcomeMessage = React.useMemo(() => buildInitialBotMessage(language), [language]);

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
        const storagePath = isGuest ? '' : `${user.id}/${storageName}`;

        let targetFolderId: string | null = state.activeFolderId;
        if (!targetFolderId && state.folders.length > 0) {
            targetFolderId = state.folders[0].id;
        }

        const logUploadDiagnostic = (
            event: Omit<DiagnosticEvent, 'documentId' | 'file' | 'isGuest' | 'storagePath'> & {
                fileType?: DiagnosticFileInfo['fileType'];
                storagePath?: string;
            },
        ) => {
            const { fileType: diagnosticFileType, context, ...rest } = event;
            void logDiagnosticEvent({
                ...rest,
                documentId: docId,
                file: createFileDiagnosticInfo(file, diagnosticFileType),
                storagePath: (event.storagePath ?? storagePath) || undefined,
                isGuest,
                context: {
                    safeFileName,
                    storageName,
                    targetFolderId,
                    activeFolderId: state.activeFolderId,
                    ...context,
                },
            });
        };

        logUploadDiagnostic({
            severity: 'info',
            stage: 'upload.selected',
            message: 'File selected for upload',
        });

        if (userError) {
            logUploadDiagnostic({
                severity: 'warn',
                stage: 'auth.user_lookup_failed',
                message: 'Supabase user lookup failed before upload',
                error: createDiagnosticErrorInfo(userError),
            });
        }

        // ── Guest-specific gating ─────────────────────────────────────────────
        if (isGuest) {
            if (state.documents.length >= GUEST_LIMITS.maxDocuments) {
                logUploadDiagnostic({
                    severity: 'warn',
                    stage: 'upload.rejected.guest_document_limit',
                    message: 'Guest document count limit reached',
                    context: {
                        currentDocumentCount: state.documents.length,
                        maxDocuments: GUEST_LIMITS.maxDocuments,
                    },
                });
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
                logUploadDiagnostic({
                    severity: 'warn',
                    stage: 'upload.rejected.guest_file_size',
                    message: 'Guest file size limit reached',
                    context: {
                        maxFileSizeBytes: GUEST_LIMITS.maxFileSizeBytes,
                    },
                });
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
            logUploadDiagnostic({
                severity: 'warn',
                stage: 'upload.rejected.unsupported_type',
                message: 'Unsupported file type rejected',
            });
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
                errorMessage: t('file.unsupportedType', language),
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
        logUploadDiagnostic({
            severity: 'info',
            stage: 'upload.accepted',
            message: 'File passed upload validation',
            fileType,
        });

        if (fileType === 'pdf') {
            try {
                await assertPdfCanOpenWithoutPassword(file);
            } catch (error) {
                logUploadDiagnostic({
                    severity: isPasswordProtectedPdfError(error) ? 'warn' : 'error',
                    stage: isPasswordProtectedPdfError(error)
                        ? 'upload.rejected.password_protected_pdf'
                        : 'upload.pdf_probe_failed',
                    message: isPasswordProtectedPdfError(error)
                        ? 'Password-protected PDF rejected by policy'
                        : 'PDF openability probe failed',
                    fileType,
                    error: createDiagnosticErrorInfo(error),
                });
                const errorDoc: DocumentData = {
                    id: docId,
                    file: null,
                    fileName: file.name,
                    fileSize: file.size,
                    fileType,
                    summary: '',
                    chat: null,
                    chatHistory: [],
                    processingState: 'error',
                    errorMessage: isPasswordProtectedPdfError(error)
                        ? t('file.passwordProtectedPdf', language)
                        : getErrorMessage(error),
                    model: 'gemini-2.5-flash',
                    answerScope: 'document',
                    monkeyMode: false,
                    folderId: targetFolderId,
                    currentPage: 1,
                };
                dispatch({ type: 'ADD_DOCUMENT', payload: errorDoc });
                return;
            }
        }

        const uploadFile = file;

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
            chatHistory: [welcomeMessage],
            processingState: 'reading',
            model: 'gemini-2.5-flash',
            answerScope: 'document',
            monkeyMode: false,
            folderId: targetFolderId,
            currentPage: 1,
        };

        dispatch({ type: 'ADD_DOCUMENT', payload: newDoc });
        logUploadDiagnostic({
            severity: 'info',
            stage: 'upload.document_created',
            message: 'Document added to client state',
            fileType,
            storagePath,
        });

        // Guests skip the Supabase storage upload + metadata insert entirely.
        // Their document lives in memory only and is processed via the
        // unauthenticated Gemini path (IP-rate-limited by the Netlify proxy).
        if (!isGuest) try {
            try {
                await uploadFileToStorage('docs', storagePath, uploadFile);
                logUploadDiagnostic({
                    severity: 'info',
                    stage: 'upload.storage_completed',
                    message: 'File uploaded to storage',
                    fileType,
                    storagePath,
                });
            } catch (uploadError) {
                const errorInfo = uploadError as { status?: number; message?: string };
                console.error('업로드 실패:', uploadError);
                logUploadDiagnostic({
                    severity: 'error',
                    stage: 'upload.storage_failed',
                    message: 'Storage upload failed',
                    fileType,
                    storagePath,
                    error: createDiagnosticErrorInfo(uploadError),
                    context: uploadError instanceof StorageUploadError
                        ? { storageUpload: uploadError.details }
                        : undefined,
                });
                dispatch({
                    type: 'UPDATE_DOCUMENT',
                    payload: {
                        docId,
                        updates: {
                            processingState: 'error',
                            errorMessage: getUploadErrorMessage(errorInfo)
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
                    chat_history: [welcomeMessage],
                    processing_state: 'reading',
                    model: newDoc.model,
                    answer_scope: newDoc.answerScope,
                    monkey_mode: newDoc.monkeyMode,
                    document_content: null,
                });

            if (insertError) {
                console.error('문서 메타데이터 저장에 실패했습니다:', insertError);
                logUploadDiagnostic({
                    severity: 'error',
                    stage: 'upload.metadata_failed',
                    message: 'Document metadata insert failed',
                    fileType,
                    storagePath,
                    error: createDiagnosticErrorInfo(insertError),
                });
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
            logUploadDiagnostic({
                severity: 'info',
                stage: 'upload.metadata_created',
                message: 'Document metadata inserted',
                fileType,
                storagePath,
            });
        } catch (error) {
            console.error('업로드 처리 중 오류가 발생했습니다:', error);
            logUploadDiagnostic({
                severity: 'error',
                stage: 'upload.pipeline_failed',
                message: 'Unexpected upload pipeline failure',
                fileType,
                storagePath,
                error: createDiagnosticErrorInfo(error),
            });
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

        let lastProcessingState: DocumentProcessingState = 'reading';
        const onProgress = (state: DocumentProcessingState) => {
            lastProcessingState = state;
            dispatch({
                type: 'UPDATE_DOCUMENT',
                payload: { docId, updates: { processingState: state } }
            });
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
            const modelForProcessing: ProcessingModel = fileType === 'image' ? 'gemini-flash-latest' : newDoc.model;
            logUploadDiagnostic({
                severity: 'info',
                stage: 'processing.started',
                message: 'Document processing started',
                fileType,
                storagePath,
                model: modelForProcessing,
            });
            const { summary, presetQuestions, chat, tokenCount, documentContent } = await processDocument(
                uploadFile,
                modelForProcessing,
                onProgress,
                language,
                onSummaryChunk,
                storagePath || undefined,
            );
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
            logUploadDiagnostic({
                severity: 'info',
                stage: 'processing.completed',
                message: 'Document processing completed',
                fileType,
                storagePath,
                model: modelForProcessing,
                context: {
                    tokenCount,
                    summaryLength: summary.length,
                    documentContentLength: documentContent.length,
                    presetQuestionCount: presetQuestions?.length ?? 0,
                },
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
                    logUploadDiagnostic({
                        severity: 'error',
                        stage: 'processing.result_update_failed',
                        message: 'Processed document update failed',
                        fileType,
                        storagePath,
                        model: modelForProcessing,
                        error: createDiagnosticErrorInfo(updateError),
                    });
                }
            }
        } catch (error) {
            console.error('Failed to process document:', error);
            const errorMessage = isPasswordProtectedPdfError(error)
                ? t('file.passwordProtectedPdf', language)
                : getErrorMessage(error);
            logUploadDiagnostic({
                severity: 'error',
                stage: `processing.${lastProcessingState}.failed`,
                message: 'Document processing failed',
                fileType,
                storagePath,
                model: fileType === 'image' ? 'gemini-flash-latest' : newDoc.model,
                processingState: lastProcessingState,
                error: createDiagnosticErrorInfo(error),
            });
            dispatch({
                type: 'UPDATE_DOCUMENT',
                payload: {
                    docId,
                    updates: {
                        processingState: 'error',
                        errorMessage,
                    }
                }
            });

            if (!isGuest) {
                await supabase
                    .from('documents')
                    .update({
                        processing_state: 'error',
                        error_message: errorMessage,
                    })
                    .eq('id', docId)
                    .eq('user_id', user!.id);
            }
        }
    }, [dispatch, state.activeFolderId, state.folders, language]);
};
