import * as React from 'react';
import { XIcon, WorkspacePremiumIcon, BoltIcon, CheckIcon } from './icons';

interface UpgradeModalProps {
    isOpen: boolean;
    onClose: () => void;
    reason?: 'documents' | 'ai_actions' | 'generic';
}

const PRO_FEATURES = [
    '무제한 문서 업로드',
    'AI 기능 무제한 (요약·퀴즈·마인드맵·플래시카드·팟캐스트)',
    'Gemini Pro 모델 (고성능 AI)',
    '무제한 AI 채팅',
    '우선 처리 및 빠른 응답',
];

const REASON_COPY = {
    documents: {
        title: '문서 한도에 도달했습니다',
        desc: 'Free 플랜은 최대 5개의 문서를 지원합니다. Pro로 업그레이드하면 무제한으로 업로드할 수 있습니다.',
    },
    ai_actions: {
        title: '오늘의 AI 사용량을 모두 썼습니다',
        desc: 'Free 플랜은 하루 20회 AI 기능을 사용할 수 있습니다. Pro로 업그레이드하면 제한 없이 사용할 수 있습니다.',
    },
    generic: {
        title: 'Pro 플랜으로 업그레이드',
        desc: '더 많은 기능과 무제한 사용을 원한다면 Pro를 이용하세요.',
    },
};

export const UpgradeModal: React.FC<UpgradeModalProps> = ({ isOpen, onClose, reason = 'generic' }) => {
    const copy = REASON_COPY[reason];
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-ink-900/50 backdrop-blur-sm animate-fade-in" onClick={onClose} aria-hidden="true" />
            <div className="relative bg-white rounded-2xl shadow-sheet w-full max-w-md overflow-hidden animate-scale-in">
                {/* Header */}
                <div className="relative bg-ink-900 px-7 pt-8 pb-7 text-white overflow-hidden">
                    <div className="absolute -top-20 -right-20 w-64 h-64 bg-brand-500/30 rounded-full blur-3xl pointer-events-none" />
                    <button
                        type="button"
                        onClick={onClose}
                        className="absolute top-4 right-4 p-1.5 rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-colors"
                        aria-label="Close"
                    >
                        <XIcon className="text-xl" />
                    </button>
                    <div className="relative">
                        <div className="w-12 h-12 bg-white/15 backdrop-blur-sm rounded-2xl flex items-center justify-center mb-4 ring-1 ring-white/20">
                            <WorkspacePremiumIcon className="text-2xl text-warning-100" />
                        </div>
                        <h2 className="text-xl font-display font-bold tracking-tight">{copy.title}</h2>
                        <p className="text-brand-100/90 text-sm mt-1.5 leading-relaxed">{copy.desc}</p>
                    </div>
                </div>

                {/* Features */}
                <div className="px-7 py-6">
                    <p className="text-[11px] font-bold text-ink-400 uppercase tracking-[0.14em] mb-3">Pro 플랜 혜택</p>
                    <ul className="space-y-2.5">
                        {PRO_FEATURES.map(f => (
                            <li key={f} className="flex items-start gap-2.5">
                                <span className="mt-0.5 w-5 h-5 rounded-full bg-brand-100 flex items-center justify-center flex-shrink-0">
                                    <CheckIcon className="text-sm text-brand-700" />
                                </span>
                                <span className="text-sm text-ink-700">{f}</span>
                            </li>
                        ))}
                    </ul>

                    <div className="mt-6 space-y-2">
                        <button
                            type="button"
                            onClick={() => {
                                window.open('mailto:support@clevermonkey.app?subject=Pro Plan Upgrade', '_blank');
                            }}
                            className="w-full inline-flex items-center justify-center gap-2 h-14 bg-brand-500 hover:bg-brand-600 active:bg-brand-800 text-white rounded-2xl font-bold text-base transition-[transform,background-color] duration-200 active:scale-[0.98] shadow-brand"
                        >
                            <BoltIcon className="text-base" />
                            Pro로 업그레이드
                        </button>
                        <button
                            type="button"
                            onClick={onClose}
                            className="w-full py-2 text-ink-500 text-sm font-medium hover:text-ink-700 transition-colors"
                        >
                            나중에 하기
                        </button>
                    </div>

                    <p className="text-center text-xs text-ink-400 mt-4">
                        문의: <a href="mailto:support@clevermonkey.app" className="text-brand-600 hover:underline font-medium">support@clevermonkey.app</a>
                    </p>
                </div>
            </div>
        </div>
    );
};

// ─── Hook for easy usage ──────────────────────────────────────────────────────

export function useUpgradeModal() {
    const [isOpen, setIsOpen] = React.useState(false);
    const [reason, setReason] = React.useState<UpgradeModalProps['reason']>('generic');

    const openUpgrade = React.useCallback((r: UpgradeModalProps['reason'] = 'generic') => {
        setReason(r);
        setIsOpen(true);
    }, []);

    return {
        isOpen,
        reason,
        openUpgrade,
        closeUpgrade: () => setIsOpen(false),
    };
}
