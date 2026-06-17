export interface TourAnchorRect {
    x: number;
    y: number;
    w: number;
    h: number;
}

export interface TourViewport {
    width: number;
    height: number;
}

export interface TourCardLayout {
    position: 'fixed';
    left: number | '50%';
    top: number | '50%';
    transform?: 'translate(-50%, -50%)';
    width: number;
    maxWidth: string;
    maxHeight: string;
    zIndex: number;
}

export const TOUR_CARD_MAX_WIDTH = 320;
export const TOUR_CARD_MARGIN = 16;
export const TOUR_CARD_GAP = 12;
export const TOUR_CARD_ESTIMATED_HEIGHT = 260;

function clamp(value: number, min: number, max: number): number {
    if (max < min) return min;
    return Math.max(min, Math.min(max, value));
}

function getCardWidth(viewportWidth: number): number {
    const availableWidth = Math.max(0, viewportWidth - TOUR_CARD_MARGIN * 2);
    return Math.min(TOUR_CARD_MAX_WIDTH, availableWidth);
}

function getEstimatedCardHeight(viewportHeight: number): number {
    const availableHeight = Math.max(0, viewportHeight - TOUR_CARD_MARGIN * 2);
    return Math.min(TOUR_CARD_ESTIMATED_HEIGHT, availableHeight);
}

export function isUsableTourAnchor(
    anchor: TourAnchorRect | null,
    viewport: TourViewport,
): anchor is TourAnchorRect {
    if (!anchor) return false;
    if (anchor.w <= 0 || anchor.h <= 0) return false;
    if (anchor.x + anchor.w <= 0 || anchor.y + anchor.h <= 0) return false;
    if (anchor.x >= viewport.width || anchor.y >= viewport.height) return false;
    return true;
}

export function getVisibleTourAnchorRect(
    selector: string,
    viewport: TourViewport,
    root: ParentNode = document,
): TourAnchorRect | null {
    const ownerWindow = root.ownerDocument?.defaultView ?? window;
    const candidates = Array.from(root.querySelectorAll(selector)) as HTMLElement[];

    for (const el of candidates) {
        const style = ownerWindow.getComputedStyle(el);
        if (style.display === 'none' || style.visibility === 'hidden') continue;

        const r = el.getBoundingClientRect();
        const anchor = { x: r.left, y: r.top, w: r.width, h: r.height };
        if (isUsableTourAnchor(anchor, viewport)) return anchor;
    }

    return null;
}

export function getTourCardLayout(
    anchor: TourAnchorRect | null,
    viewport: TourViewport,
): TourCardLayout {
    const width = getCardWidth(viewport.width);
    const estimatedHeight = getEstimatedCardHeight(viewport.height);
    const maxWidth = `calc(100vw - ${TOUR_CARD_MARGIN * 2}px)`;
    const maxHeight = `calc(100dvh - ${TOUR_CARD_MARGIN * 2}px)`;

    if (!isUsableTourAnchor(anchor, viewport)) {
        return {
            position: 'fixed',
            left: '50%',
            top: '50%',
            transform: 'translate(-50%, -50%)',
            width,
            maxWidth,
            maxHeight,
            zIndex: 250,
        };
    }

    const showBelow = anchor.y + anchor.h + TOUR_CARD_GAP + estimatedHeight < viewport.height - TOUR_CARD_MARGIN;
    const idealLeft = anchor.x + anchor.w / 2 - width / 2;
    const idealTop = showBelow
        ? anchor.y + anchor.h + TOUR_CARD_GAP
        : anchor.y - TOUR_CARD_GAP - estimatedHeight;

    return {
        position: 'fixed',
        left: clamp(idealLeft, TOUR_CARD_MARGIN, viewport.width - width - TOUR_CARD_MARGIN),
        top: clamp(idealTop, TOUR_CARD_MARGIN, viewport.height - estimatedHeight - TOUR_CARD_MARGIN),
        width,
        maxWidth,
        maxHeight,
        zIndex: 250,
    };
}
