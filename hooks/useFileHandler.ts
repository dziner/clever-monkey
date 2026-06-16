import * as React from 'react';
import { useDocuments } from '../contexts/DocumentContext';
import { useUser } from '../contexts/UserContext';
import { processDocument, BackgroundOcrRequired, triggerBackgroundOcr } from '../services/geminiService';
import { checkPdfPreflightLimits, SCANNED_PDF_PAGE_LIMIT, type PdfPreflightResult } from '../utils/pdfPreflightCheck';
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
import {
    isSupportedMimeType,
    sanitizeFileName,
    getUploadErrorMessage,
    getFileType,
} from '../utils/uploadValidation';
import { buildErrorDoc } from '../utils/buildErrorDoc';

function pdfPreflightDiagnosticContext(preflight: PdfPreflightResult): Record<string, unknown> {
    return {
        classification: preflight.classification,
        numPages: 'numPages' in preflight ? preflight.numPages : undefined,
        pagesScanned: 'pagesScanned' in preflight ? preflight.pagesScanned : undefined,
        textLayerChars: 'textLayerChars' in preflight ? preflight.textLayerChars : undefined,
        scannedPageLimit: SCANNED_PDF_PAGE_LIMIT,
    };
}

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
                dispatch({ type: 'ADD_DOCUMENT', payload: buildErrorDoc({
                    id: docId,
                    fileName: file.name,
                    fileSize: file.size,
                    folderId: null,
                    errorMessage: `게스트는 최대 ${GUEST_LIMITS.maxDocuments}개의 파일만 업로드할 수 있어요. 로그인하면 더 많이 올릴 수 있습니다.`,
                }) });
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
                dispatch({ type: 'ADD_DOCUMENT', payload: buildErrorDoc({
                    id: docId,
                    fileName: file.name,
                    fileSize: file.size,
                    folderId: null,
                    errorMessage: `게스트는 한 파일에 ${mb}MB까지 업로드할 수 있어요. 로그인하면 더 큰 파일도 가능합니다.`,
                }) });
                return;
            }
        }

        if (!isSupportedMimeType(file.type)) {
            logUploadDiagnostic({
                severity: 'warn',
                stage: 'upload.rejected.unsupported_type',
                message: 'Unsupported file type rejected',
            });
            dispatch({ type: 'ADD_DOCUMENT', payload: buildErrorDoc({
                id: docId,
                fileName: file.name,
                fileSize: file.size,
                folderId: targetFolderId,
                errorMessage: t('file.unsupportedType', language),
            }) });
            return;
        }

        const fileType = getFileType(file);
        logUploadDiagnostic({
            severity: 'info',
            stage: 'upload.accepted',
            message: 'File passed upload validation',
            fileType,
        });

        let pdfPreflightContext: Record<string, unknown> | undefined;

        if (fileType === 'pdf') {
            try {
                await assertPdfCanOpenWithoutPassword(file);
            } catch (error) {
                const isPasswordError = isPasswordProtectedPdfError(error);
                logUploadDiagnostic({
                    // Password rejection is a terminal user-facing failure
                    // (they see "Processing Failed"), so log it at 'error'
                    // level to surface in the admin feed. A non-password
                    // probe failure just continues to OCR — that's a 'warn'.
                    severity: isPasswordError ? 'error' : 'warn',
                    stage: isPasswordError
                        ? 'upload.rejected.password_protected_pdf'
                        : 'upload.pdf_probe_failed.continuing',
                    message: isPasswordError
                        ? 'Password-protected PDF rejected by policy'
                        : 'PDF openability probe failed before upload; continuing to storage and processing',
                    fileType,
                    error: createDiagnosticErrorInfo(error),
                });
                if (!isPasswordError) {
                    // Large or unusual PDFs can make the lightweight pdf.js probe fail.
                    // Only password-protected PDFs are rejected at upload policy level.
                    console.warn('PDF preflight probe failed; continuing upload:', error);
                } else {
                    dispatch({ type: 'ADD_DOCUMENT', payload: buildErrorDoc({
                        id: docId,
                        fileName: file.name,
                        fileSize: file.size,
                        fileType,
                        folderId: targetFolderId,
                        errorMessage: t('file.passwordProtectedPdf', language),
                    }) });
                    return;
                }
            }

            // Page-count ceiling for scanned PDFs (Gemini OCR + background
            // function budget). Catches the user before they wait minutes
            // on a 500-page scan that we already know won't finish cleanly.
            const preflight = await checkPdfPreflightLimits(file);
            pdfPreflightContext = pdfPreflightDiagnosticContext(preflight);
            logUploadDiagnostic({
                severity: 'info',
                stage: 'upload.pdf_preflight_checked',
                message: 'PDF preflight completed',
                fileType,
                context: { pdfPreflight: pdfPreflightContext },
            });
            if (preflight.ok === false) {
                const rejectReason = preflight.reason;
                logUploadDiagnostic({
                    severity: 'warn',
                    stage: 'upload.rejected.pdf_too_many_pages',
                    message: 'PDF with image-based page content rejected: exceeds page-count ceiling',
                    fileType,
                    context: {
                        reason: rejectReason,
                        pdfPreflight: pdfPreflightContext,
                    },
                });
                dispatch({ type: 'ADD_DOCUMENT', payload: buildErrorDoc({
                    id: docId,
                    fileName: file.name,
                    fileSize: file.size,
                    fileType,
                    folderId: targetFolderId,
                    errorMessage: rejectReason,
                }) });
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
            uploadState: isGuest ? 'uploaded' : 'pending',
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
                dispatch({
                    type: 'UPDATE_DOCUMENT',
                    payload: { docId, updates: { uploadState: 'uploaded' } },
                });
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
                            uploadState: 'failed',
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
                            uploadState: 'metadata_failed',
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
                        uploadState: 'failed',
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
            // Large scanned file: extraction bailed out asking for the
            // background OCR function (15-min limit) instead of a doomed
            // synchronous call. Fire it and park the doc in 'queued'; the
            // result arrives later via useBackgroundProcessing.
            if (error instanceof BackgroundOcrRequired) {
                const ocrModel = fileType === 'image' ? 'gemini-flash-latest' : newDoc.model;
                try {
                    const pageCount = typeof pdfPreflightContext?.numPages === 'number'
                        ? pdfPreflightContext.numPages
                        : undefined;
                    await triggerBackgroundOcr({
                        documentId: docId,
                        storagePath,
                        model: ocrModel,
                        mimeType: uploadFile.type || newDoc.fileMime || 'application/octet-stream',
                        fileName: newDoc.fileName,
                        pageCount,
                        preflight: pdfPreflightContext,
                    });
                    dispatch({ type: 'UPDATE_DOCUMENT', payload: { docId, updates: { processingState: 'queued', errorMessage: undefined } } });
                    if (!isGuest && user) {
                        await supabase.from('documents').update({ processing_state: 'queued', error_message: null }).eq('id', docId).eq('user_id', user.id);
                    }
                    logUploadDiagnostic({
                        severity: 'info',
                        stage: 'processing.background_ocr.queued',
                        message: 'Large scan handed to background OCR',
                        fileType,
                        storagePath,
                        model: ocrModel,
                        context: { pdfPreflight: pdfPreflightContext },
                    });
                } catch (bgErr) {
                    const bgMsg = getErrorMessage(bgErr);
                    dispatch({ type: 'UPDATE_DOCUMENT', payload: { docId, updates: { processingState: 'error', errorMessage: bgMsg } } });
                    if (!isGuest && user) {
                        await supabase.from('documents').update({ processing_state: 'error', error_message: bgMsg }).eq('id', docId).eq('user_id', user.id);
                    }
                    logUploadDiagnostic({
                        severity: 'error',
                        stage: 'processing.background_ocr.trigger_failed',
                        message: 'Background OCR could not start',
                        fileType,
                        storagePath,
                        model: ocrModel,
                        error: createDiagnosticErrorInfo(bgErr),
                    });
                }
                return;
            }
            console.error('Failed to process document:', error);
            // FILE_TOO_LARGE sentinel: callGemini raises it on 413 or our
            // own MAX_BODY_BYTES guard. Localize it like the password
            // case so the user gets actionable copy instead of a raw HTTP
            // status.
            const raw = error instanceof Error ? error.message : '';
            const errorMessage = isPasswordProtectedPdfError(error)
                ? t('file.passwordProtectedPdf', language)
                : raw === 'FILE_TOO_LARGE'
                    ? t('file.tooLarge', language)
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
