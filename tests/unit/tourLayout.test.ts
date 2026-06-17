import { describe, expect, it } from 'vitest';
import {
    getVisibleTourAnchorRect,
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

    it('centers the card instead of pinning it top-left for a hidden zero-size anchor', () => {
        const layout = getTourCardLayout(
            { x: 0, y: 0, w: 0, h: 0 },
            { width: 1024, height: 768 },
        );

        expect(layout.left).toBe('50%');
        expect(layout.top).toBe('50%');
        expect(layout.transform).toBe('translate(-50%, -50%)');
    });

    it('uses the first visible matching tour anchor when hidden desktop/mobile duplicates exist', () => {
        document.body.innerHTML = `
            <button data-tour="tab-quiz" style="display:none">Hidden quiz tab</button>
            <button data-tour="tab-quiz">Visible quiz tab</button>
        `;

        const [hidden, visible] = Array.from(document.querySelectorAll('[data-tour="tab-quiz"]')) as HTMLElement[];
        hidden.getBoundingClientRect = () => ({
            left: 0,
            top: 0,
            width: 0,
            height: 0,
            right: 0,
            bottom: 0,
            x: 0,
            y: 0,
            toJSON: () => ({}),
        } as DOMRect);
        visible.getBoundingClientRect = () => ({
            left: 420,
            top: 64,
            width: 56,
            height: 44,
            right: 476,
            bottom: 108,
            x: 420,
            y: 64,
            toJSON: () => ({}),
        } as DOMRect);

        expect(getVisibleTourAnchorRect('[data-tour="tab-quiz"]', { width: 1024, height: 768 })).toEqual({
            x: 420,
            y: 64,
            w: 56,
            h: 44,
        });
    });
});
