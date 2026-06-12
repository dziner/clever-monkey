import { describe, expect, it } from 'vitest';
import {
    STANDARD_UPLOAD_RELIABLE_LIMIT_BYTES,
    TUS_CHUNK_SIZE_BYTES,
    buildTusUploadMetadata,
    getDirectStorageUploadEndpoint,
} from '../../utils/storageUploadConfig';

describe('storage upload config', () => {
    it('uses the 6MB Supabase-recommended boundary and TUS chunk size', () => {
        expect(STANDARD_UPLOAD_RELIABLE_LIMIT_BYTES).toBe(6 * 1024 * 1024);
        expect(TUS_CHUNK_SIZE_BYTES).toBe(6 * 1024 * 1024);
    });

    it('uses the direct storage hostname for hosted Supabase projects', () => {
        expect(getDirectStorageUploadEndpoint('https://abc123.supabase.co')).toBe(
            'https://abc123.storage.supabase.co/storage/v1/upload/resumable',
        );
    });

    it('preserves custom/self-hosted origins', () => {
        expect(getDirectStorageUploadEndpoint('https://storage.example.com')).toBe(
            'https://storage.example.com/storage/v1/upload/resumable',
        );
    });

    it('encodes TUS metadata expected by Supabase Storage', () => {
        const metadata = buildTusUploadMetadata({
            bucketName: 'docs',
            objectName: 'user-1/file.pdf',
            contentType: 'application/pdf',
        });

        expect(metadata).toContain('bucketName ZG9jcw==');
        expect(metadata).toContain('objectName dXNlci0xL2ZpbGUucGRm');
        expect(metadata).toContain('contentType YXBwbGljYXRpb24vcGRm');
        expect(metadata).toContain('cacheControl MzYwMA==');
    });
});
