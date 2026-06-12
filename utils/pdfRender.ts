export const PDF_RENDER_MAX_CANVAS_SIDE = 4096;
export const PDF_RENDER_MAX_CANVAS_PIXELS = 12_000_000;

export function getSafePdfRenderScale(
    pageWidth: number,
    pageHeight: number,
    desiredScale: number,
): number {
    if (
        !Number.isFinite(pageWidth) ||
        !Number.isFinite(pageHeight) ||
        !Number.isFinite(desiredScale) ||
        pageWidth <= 0 ||
        pageHeight <= 0 ||
        desiredScale <= 0
    ) {
        return 1;
    }

    const sideScale = Math.min(
        PDF_RENDER_MAX_CANVAS_SIDE / pageWidth,
        PDF_RENDER_MAX_CANVAS_SIDE / pageHeight,
    );
    const pixelScale = Math.sqrt(PDF_RENDER_MAX_CANVAS_PIXELS / (pageWidth * pageHeight));
    return Math.max(0.1, Math.min(desiredScale, sideScale, pixelScale));
}
