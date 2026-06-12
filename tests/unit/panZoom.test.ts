import { describe, expect, it } from 'vitest';
import { getPinchTransform, getZoomAtPointTransform } from '../../utils/panZoom';

describe('pan/zoom gesture math', () => {
    it('keeps the pointed content location fixed when zooming', () => {
        const point = { x: 200, y: 120 };
        const current = { zoom: 1, pan: { x: 40, y: 20 } };
        const before = {
            x: (point.x - current.pan.x) / current.zoom,
            y: (point.y - current.pan.y) / current.zoom,
        };

        const next = getZoomAtPointTransform(current, point, 2, 0.2, 3);
        const after = {
            x: (point.x - next.pan.x) / next.zoom,
            y: (point.y - next.pan.y) / next.zoom,
        };

        expect(after).toEqual(before);
    });

    it('uses pinch distance to zoom around the finger midpoint', () => {
        const next = getPinchTransform(
            {
                startDistance: 100,
                startZoom: 1,
                contentPoint: { x: 120, y: 80 },
            },
            { x: 250, y: 180 },
            150,
            0.2,
            3,
        );

        expect(next.zoom).toBe(1.5);
        expect(next.pan).toEqual({ x: 70, y: 60 });
    });

    it('clamps pinch zoom to configured limits', () => {
        expect(getPinchTransform(
            { startDistance: 100, startZoom: 1, contentPoint: { x: 0, y: 0 } },
            { x: 0, y: 0 },
            1000,
            0.2,
            3,
        ).zoom).toBe(3);

        expect(getPinchTransform(
            { startDistance: 100, startZoom: 1, contentPoint: { x: 0, y: 0 } },
            { x: 0, y: 0 },
            1,
            0.2,
            3,
        ).zoom).toBe(0.2);
    });
});
