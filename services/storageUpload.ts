import { supabase, supabaseProjectUrl } from './supabaseClient';
import {
    STANDARD_UPLOAD_RELIABLE_LIMIT_BYTES,
    TUS_CHUNK_SIZE_BYTES,
    buildTusUploadMetadata,
    getDirectStorageUploadEndpoint,
} from '../utils/storageUploadConfig';

const RETRYABLE_UPLOAD_STATUSES = new Set([0, 408, 409, 429, 500, 502, 503, 504]);
const TUS_RETRY_DELAYS_MS = [0, 3000, 5000, 10000, 20000];

export interface StorageUploadErrorDetails {
    method?: 'standard' | 'tus';
    phase?: string;
    attempt?: number;
    offset?: number;
    chunkSize?: number;
    fileSize?: number;
    endpoint?: string;
}

export class StorageUploadError extends Error {
    status?: number;
    details?: StorageUploadErrorDetails;

    constructor(message: string, status?: number, details?: StorageUploadErrorDetails) {
        super(message);
        this.name = 'StorageUploadError';
        this.status = status;
        this.details = details;
    }
}

function statusFromError(error: unknown): number {
    const candidate = error as { status?: number | string; statusCode?: number | string } | null;
    const raw = candidate?.status ?? candidate?.statusCode ?? 0;
    const status = typeof raw === 'string' ? Number(raw) : raw;
    return Number.isFinite(status) ? status : 0;
}

function messageFromError(error: unknown): string {
    if (error instanceof Error) return error.message;
    const candidate = error as { message?: string; error?: string } | null;
    return candidate?.message ?? candidate?.error ?? 'Storage upload failed';
}

function toStorageUploadError(error: unknown, details?: StorageUploadErrorDetails): StorageUploadError {
    if (error instanceof StorageUploadError) {
        return new StorageUploadError(error.message, error.status, { ...details, ...error.details });
    }
    return new StorageUploadError(messageFromError(error), statusFromError(error), details);
}

async function responseToUploadError(
    response: Response,
    fallbackMessage: string,
    details?: StorageUploadErrorDetails,
): Promise<StorageUploadError> {
    const text = await response.text().catch(() => '');
    let message = text.trim();
    if (message.startsWith('{')) {
        try {
            const parsed = JSON.parse(message) as { error?: string; message?: string };
            message = parsed.error ?? parsed.message ?? message;
        } catch {
            // Keep raw text.
        }
    }
    return new StorageUploadError(message || fallbackMessage, response.status, details);
}

async function getAccessToken(): Promise<string> {
    const { data, error } = await supabase.auth.getSession();
    if (error) throw new StorageUploadError(error.message, statusFromError(error), { phase: 'auth_session' });
    const token = data.session?.access_token;
    if (!token) throw new StorageUploadError('로그인이 필요합니다.', 401);
    return token;
}

async function uploadWithStandardRequest(bucketName: string, objectName: string, file: File): Promise<void> {
    let uploadError: unknown = null;
    let finalAttempt = 0;
    for (let attempt = 1; attempt <= 3; attempt += 1) {
        finalAttempt = attempt;
        const { error } = await supabase.storage
            .from(bucketName)
            .upload(objectName, file, { contentType: file.type || 'application/octet-stream' });
        if (!error) return;

        uploadError = error;
        const status = statusFromError(error);
        if (!RETRYABLE_UPLOAD_STATUSES.has(status) || attempt === 3) break;
        // Quadratic backoff (0.8s, 3.2s) so retries for large uploads
        // don't all stampede before the network actually recovers. The
        // earlier 400/800ms steps were quicker than a 30MB scan PDF
        // could realistically finish on a flaky link.
        await new Promise(resolve => setTimeout(resolve, 800 * attempt * attempt));
    }
    throw toStorageUploadError(uploadError, {
        method: 'standard',
        phase: 'standard_request',
        attempt: finalAttempt,
        fileSize: file.size,
    });
}

async function createTusUpload(
    endpoint: string,
    token: string,
    bucketName: string,
    objectName: string,
    file: File,
): Promise<string> {
    const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
            authorization: `Bearer ${token}`,
            'Tus-Resumable': '1.0.0',
            'Upload-Length': String(file.size),
            'Upload-Metadata': buildTusUploadMetadata({
                bucketName,
                objectName,
                contentType: file.type || 'application/octet-stream',
            }),
            'x-upsert': 'false',
        },
    });

    if (!response.ok) {
        throw await responseToUploadError(response, '대용량 업로드를 시작하지 못했습니다.', {
            method: 'tus',
            phase: 'create',
            fileSize: file.size,
            endpoint,
        });
    }

    const location = response.headers.get('location');
    if (!location) {
        throw new StorageUploadError('대용량 업로드 URL을 받지 못했습니다.', 0, {
            method: 'tus',
            phase: 'create',
            fileSize: file.size,
            endpoint,
        });
    }

    return new URL(location, endpoint).toString();
}

async function readTusOffset(uploadUrl: string, token: string): Promise<number> {
    const response = await fetch(uploadUrl, {
        method: 'HEAD',
        headers: {
            authorization: `Bearer ${token}`,
            'Tus-Resumable': '1.0.0',
        },
    });

    if (!response.ok) {
        throw await responseToUploadError(response, '대용량 업로드 위치를 확인하지 못했습니다.', {
            method: 'tus',
            phase: 'head_offset',
        });
    }

    const offset = Number(response.headers.get('upload-offset') ?? 0);
    if (!Number.isFinite(offset) || offset < 0) {
        throw new StorageUploadError('대용량 업로드 위치가 올바르지 않습니다.', 0, {
            method: 'tus',
            phase: 'head_offset',
        });
    }
    return offset;
}

async function patchTusChunk(uploadUrl: string, token: string, file: File, offset: number): Promise<number> {
    const chunk = file.slice(offset, Math.min(offset + TUS_CHUNK_SIZE_BYTES, file.size));
    const response = await fetch(uploadUrl, {
        method: 'PATCH',
        headers: {
            authorization: `Bearer ${token}`,
            'Tus-Resumable': '1.0.0',
            'Content-Type': 'application/offset+octet-stream',
            'Upload-Offset': String(offset),
        },
        body: chunk,
    });

    if (response.status === 409) {
        return readTusOffset(uploadUrl, token);
    }

    if (!response.ok) {
        throw await responseToUploadError(response, '대용량 파일 조각 업로드에 실패했습니다.', {
            method: 'tus',
            phase: 'patch_chunk',
            offset,
            chunkSize: chunk.size,
            fileSize: file.size,
        });
    }

    const nextOffset = Number(response.headers.get('upload-offset') ?? offset + chunk.size);
    if (!Number.isFinite(nextOffset) || nextOffset < offset) {
        throw new StorageUploadError('대용량 업로드 진행 상태가 올바르지 않습니다.', 0, {
            method: 'tus',
            phase: 'patch_offset',
            offset,
            chunkSize: chunk.size,
            fileSize: file.size,
        });
    }
    return nextOffset;
}

async function uploadWithTus(bucketName: string, objectName: string, file: File): Promise<void> {
    const token = await getAccessToken();
    const endpoint = getDirectStorageUploadEndpoint(supabaseProjectUrl);
    const uploadUrl = await createTusUpload(endpoint, token, bucketName, objectName, file);

    let offset = 0;
    while (offset < file.size) {
        let uploaded = false;
        let lastError: unknown = null;

        for (let attempt = 0; attempt < TUS_RETRY_DELAYS_MS.length; attempt += 1) {
            const delay = TUS_RETRY_DELAYS_MS[attempt];
            if (delay > 0) await new Promise(resolve => setTimeout(resolve, delay));

            try {
                const nextOffset = await patchTusChunk(uploadUrl, token, file, offset);
                if (nextOffset === offset && offset < file.size) {
                    throw new StorageUploadError('대용량 업로드가 진행되지 않았습니다.', 0);
                }
                offset = nextOffset;
                uploaded = true;
                break;
            } catch (error) {
                lastError = error;
            }
        }

        if (!uploaded) {
            throw toStorageUploadError(lastError, {
                method: 'tus',
                phase: 'chunk_retry_exhausted',
                offset,
                fileSize: file.size,
            });
        }
    }
}

export async function uploadFileToStorage(bucketName: string, objectName: string, file: File): Promise<void> {
    if (file.size > STANDARD_UPLOAD_RELIABLE_LIMIT_BYTES) {
        await uploadWithTus(bucketName, objectName, file);
        return;
    }

    await uploadWithStandardRequest(bucketName, objectName, file);
}
