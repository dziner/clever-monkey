import * as React from 'react';
import { useUser } from '../contexts/UserContext';
import { t, type UiKey } from '../services/uiStrings';
import { getTourCardLayout, type TourAnchorRect, type TourViewport } from '../utils/tourLayout';

const STORAGE_KEY = 'cm.tour.completed.v1';

// We anchor to elements that already exist in the layout via
// data-tour="..." attributes. A null selector means the step is a
// centered modal card (no spotlight) — used for the kick-off step
// before tabs have been visited.
interface Step {
    selector: string | null;
    titleKey: UiKey;
    bodyKey: UiKey;
}

const STEPS: Step[] = [
    { selector: null,                  titleKey: 'tour.step1.title', bodyKey: 'tour.step1.body' },
    { selector: '[data-tour="tab-chat"]',     titleKey: 'tour.step2.title', bodyKey: 'tour.step2.body' },
    { selector: '[data-tour="tab-quiz"]',     titleKey: 'tour.step3.title', bodyKey: 'tour.step3.body' },
    { selector: '[data-tour="tab-mindmap"]',  titleKey: 'tour.step4.title', bodyKey: 'tour.step4.body' },
];

/** True after the user has seen (or dismissed) the tour. */
export function tourCompleted(): boolean {
    try { return localStorage.getItem(STORAGE_KEY) === '1'; }
    catch { return true; }      // private mode → don't pester
}
export function markTourCompleted(): void {
    try { localStorage.setItem(STORAGE_KEY, '1'); } catch { /* ignore */ }
}

interface OnboardingTourProps {
    isOpen: boolean;
    onClose: () => void;
}

/**
 * Spotlight tour that walks a first-time user through the three highest-
 * value tabs (Chat, Quiz, Mind Map). Anchors via data-tour attributes,
 * so layout changes don't break it as long as the attribute name lives.
 */
export const OnboardingTour: React.FC<OnboardingTourProps> = ({ isOpen, onClose }) => {
    const { userProfile } = useUser();
    const lang = userProfile?.language;
    const [stepIdx, setStepIdx] = React.useState(0);
    const [anchor, setAnchor] = React.useState<TourAnchorRect | null>(null);
    const [viewport, setViewport] = React.useState<TourViewport>(() => ({
        width: typeof window === 'undefined' ? 1024 : window.innerWidth,
        height: typeof window === 'undefined' ? 768 : window.innerHeight,
    }));

    const step = STEPS[stepIdx];

    React.useEffect(() => {
        if (!isOpen) return;
        const updateViewport = () => {
            setViewport({ width: window.innerWidth, height: window.innerHeight });
        };
        updateViewport();
        window.addEventListener('resize', updateViewport);
        window.visualViewport?.addEventListener('resize', updateViewport);
        return () => {
            window.removeEventListener('resize', updateViewport);
            window.visualViewport?.removeEventListener('resize', updateViewport);
        };
    }, [isOpen]);

    // Measure the anchor (and re-measure on resize / scroll) so the
    // spotlight follows it. A missing element collapses the spotlight
    // to "centered card" so the user never gets stuck on a viewport
    // that doesn't expose this tab.
    React.useEffect(() => {
        if (!isOpen) return;
        if (!step.selector) { setAnchor(null); return; }
        const measure = () => {
            const el = document.querySelector(step.selector!);
            if (!el) { setAnchor(null); return; }
            const r = (el as HTMLElement).getBoundingClientRect();
            setAnchor({ x: r.left, y: r.top, w: r.width, h: r.height });
        };
        measure();
        window.addEventListener('resize', measure);
        window.addEventListener('scroll', measure, true);
        return () => {
            window.removeEventListener('resize', measure);
            window.removeEventListener('scroll', measure, true);
        };
    }, [isOpen, stepIdx, step.selector]);

    // Reset position when the tour reopens.
    React.useEffect(() => { if (isOpen) setStepIdx(0); }, [isOpen]);

    React.useEffect(() => {
        if (!isOpen) return;
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') finish(); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen]);

    const finish = React.useCallback(() => {
        markTourCompleted();
        onClose();
    }, [onClose]);

    const next = () => {
        if (stepIdx + 1 >= STEPS.length) finish();
        else setStepIdx(stepIdx + 1);
    };

    if (!isOpen) return null;

    const cardStyle: React.CSSProperties = getTourCardLayout(anchor, viewport);

    const progress = t('tour.progress', lang)
        .replace('{n}', String(stepIdx + 1))
        .replace('{total}', String(STEPS.length));
    const isLast = stepIdx + 1 >= STEPS.length;

    return (
        <>
            {/* Backdrop with a soft spotlight cut around the anchor (CSS
                box-shadow trick: a thin ring + huge spread that paints
                the rest of the screen as a tinted overlay). */}
            <div
                aria-hidden="true"
                onClick={finish}
                className="fixed inset-0 z-[240]"
                style={anchor ? {
                    background: 'transparent',
                    boxShadow: `0 0 0 9999px rgba(15, 23, 42, 0.55)`,
                    borderRadius: 12,
                    left: anchor.x - 6,
                    top: anchor.y - 6,
                    width: anchor.w + 12,
                    height: anchor.h + 12,
                    position: 'fixed',
                } : { background: 'rgba(15, 23, 42, 0.55)' }}
            />
            <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="tour-title"
                style={{ ...cardStyle, WebkitOverflowScrolling: 'touch', touchAction: 'pan-y' }}
                className="overflow-y-auto overscroll-contain rounded-2xl bg-white p-4 shadow-sheet animate-scale-in sm:p-5"
            >
                <p className="text-[11px] font-semibold uppercase tracking-wide text-brand-600 mb-1">{progress}</p>
                <h3 id="tour-title" className="text-base font-bold text-ink-900 mb-1.5 break-keep">
                    {t(step.titleKey, lang)}
                </h3>
                <p className="text-sm text-ink-600 leading-relaxed">{t(step.bodyKey, lang)}</p>
                <div className="mt-4 flex items-center justify-between gap-3">
                    <button
                        type="button"
                        onClick={finish}
                        className="min-h-9 text-xs font-semibold text-ink-400 hover:text-ink-700 transition-colors"
                    >
                        {t('tour.skip', lang)}
                    </button>
                    <button
                        type="button"
                        onClick={next}
                        className="min-h-9 px-4 py-2 bg-brand-600 hover:bg-brand-700 active:bg-brand-800 active:scale-[0.98] text-white rounded-xl text-sm font-semibold transition-all shadow-brand shrink-0"
                    >
                        {t(isLast ? 'tour.done' : 'tour.next', lang)}
                    </button>
                </div>
            </div>
        </>
    );
};
