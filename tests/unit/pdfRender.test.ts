import { describe, expect, it } from 'vitest';
import {
    getSafePdfRenderScale,
    PDF_RENDER_MAX_CANVAS_PIXELS,
    PDF_RENDER_MAX_CANVAS_SIDE,
} from '../../utils/pdfRender';

describe('getSafePdfRenderScale', () => {
    it('keeps ordinary text PDF pages sharp', () => {
        expect(getSafePdfRenderScale(612, 792, 2)).toBe(2);
    });

    it('clamps large scanned pages below browser canvas limits', () => {
        const scale = getSafePdfRenderScale(3000, 4200, 2);

        expect(scale).toBeLessThan(2);
        expect(3000 * scale).toBeLessThanOrEqual(PDF_RENDER_MAX_CANVAS_SIDE);
        expect(4200 * scale).toBeLessThanOrEqual(PDF_RENDER_MAX_CANVAS_SIDE);
        expect(3000 * scale * 4200 * scale).toBeLessThanOrEqual(PDF_RENDER_MAX_CANVAS_PIXELS);
    });
});
