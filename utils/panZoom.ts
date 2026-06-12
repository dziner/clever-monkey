export interface Point {
    x: number;
    y: number;
}

export interface PanZoomTransform {
    zoom: number;
    pan: Point;
}

export interface PinchStart {
    startDistance: number;
    startZoom: number;
    contentPoint: Point;
}

export function clampValue(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value));
}

export function getZoomAtPointTransform(
    current: PanZoomTransform,
    point: Point,
    requestedZoom: number,
    minZoom: number,
    maxZoom: number,
): PanZoomTransform {
    const zoom = clampValue(requestedZoom, minZoom, maxZoom);
    const wx = (point.x - current.pan.x) / current.zoom;
    const wy = (point.y - current.pan.y) / current.zoom;
    return {
        zoom,
        pan: {
            x: point.x - wx * zoom,
            y: point.y - wy * zoom,
        },
    };
}

export function getPinchTransform(
    pinchStart: PinchStart,
    center: Point,
    distance: number,
    minZoom: number,
    maxZoom: number,
): PanZoomTransform {
    const startDistance = Math.max(1, pinchStart.startDistance);
    const zoom = clampValue(
        pinchStart.startZoom * (Math.max(1, distance) / startDistance),
        minZoom,
        maxZoom,
    );
    return {
        zoom,
        pan: {
            x: center.x - pinchStart.contentPoint.x * zoom,
            y: center.y - pinchStart.contentPoint.y * zoom,
        },
    };
}
