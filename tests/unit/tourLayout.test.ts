import { describe, expect, it } from 'vitest';
import {
    getTourCardLayout,
    TOUR_CARD_MARGIN,
} from '../../utils/tourLayout';

describe('getTourCardLayout', () => {
    it('keeps the intro card inside a 320px mobile viewport', () => {
        const layout = getTourCardLayout(null, { width: 320, height: 568 });

        expect(layout.left).toBe('50%');
        expect(layout.top).toBe('50%');
        expect(layout.transform).toBe('translate(-50%, -50%)');
        expect(layout.width).toBe(320 - TOUR_CARD_MARGIN * 2);
        expect(layout.maxWidth).toBe('calc(100vw - 32px)');
        expect(layout.maxHeight).toBe('calc(100dvh - 32px)');
    });

    it('clamps an anchored card so it cannot overflow horizontally on mobile', () => {
        const layout = getTourCardLayout(
            { x: 250, y: 72, w: 48, h: 44 },
            { width: 320, height: 568 },
        );

        expect(typeof layout.left).toBe('number');
        const left = layout.left as number;
        expect(left).toBeGreaterThanOrEqual(TOUR_CARD_MARGIN);
        expect(left + layout.width).toBeLessThanOrEqual(320 - TOUR_CARD_MARGIN);
    });

    it('keeps an anchored card visible in short mobile viewports', () => {
        const layout = getTourCardLayout(
            { x: 12, y: 220, w: 72, h: 44 },
            { width: 360, height: 280 },
        );

        expect(typeof layout.top).toBe('number');
        expect(layout.top as number).toBeGreaterThanOrEqual(TOUR_CARD_MARGIN);
        expect(layout.maxHeight).toBe('calc(100dvh - 32px)');
    });
});
