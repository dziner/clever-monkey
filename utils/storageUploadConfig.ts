export const STANDARD_UPLOAD_RELIABLE_LIMIT_BYTES = 6 * 1024 * 1024;
export const TUS_CHUNK_SIZE_BYTES = 6 * 1024 * 1024;

export function getDirectStorageUploadEndpoint(projectUrl: string): string {
    const url = new URL(projectUrl);
    if (url.hostname.endsWith('.supabase.co')) {
        const projectRef = url.hostname.split('.')[0];
        url.hostname = `${projectRef}.storage.supabase.co`;
    }
    return `${url.origin}/storage/v1/upload/resumable`;
}

export function base64MetadataValue(value: string): string {
    const bytes = new TextEncoder().encode(value);
    let binary = '';
    for (const byte of bytes) {
        binary += String.fromCharCode(byte);
    }
    return btoa(binary);
}

export function buildTusUploadMetadata(params: {
    bucketName: string;
    objectName: string;
    contentType: string;
    cacheControl?: string;
}): string {
    const entries = {
        bucketName: params.bucketName,
        objectName: params.objectName,
        contentType: params.contentType || 'application/octet-stream',
        cacheControl: params.cacheControl ?? '3600',
    };

    return Object.entries(entries)
        .map(([key, value]) => `${key} ${base64MetadataValue(value)}`)
        .join(',');
}
