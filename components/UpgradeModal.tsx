import * as React from 'react';
import { XIcon, WorkspacePremiumIcon, BoltIcon, LockIcon } from './icons';

interface UpgradeModalProps {
    isOpen: boolean;
    onClose: () => void;
    reason?: 'documents' | 'ai_actions' | 'generic';
}

const PRO_FEATURES = [
    { icon: '📄', text: '무제한 문서 업로드' },
    { icon: '⚡', text: 'AI 기능 무제한 사용 (요약, 퀴즈, 마인드맵, 슬라이드, 팟캐스트)' },
    { icon: '🧠', text: 'Gemini Pro 모델 (고성능 AI)' },
    { icon: '💬', text: '무제한 AI 채팅' },
    { icon: '🎯', text: '우선 처리 및 빠른 응답' },
];

const REASON_COPY = {
    documents: {
        title: '문서 한도에 도달했습니다',
        desc: 'Free 플랜은 최대 5개의 문서를 지원합니다. Pro로 업그레이드하면 무제한으로 업로드할 수 있습니다.',
    },
    ai_actions: {
        title: '오늘의 AI 사용량을 모두 소진했습니다',
        desc: 'Free 플랜은 하루 20회 AI 기능을 사용할 수 있습니다. Pro로 업그레이드하면 제한 없이 사용할 수 있습니다.',
    },
    generic: {
        title: 'Pro 플랜으로 업그레이드',
        desc: '더 많은 기능과 무제한 사용을 원한다면 Pro 플랜을 이용하세요.',
    },
};

export const UpgradeModal: React.FC<UpgradeModalProps> = ({ isOpen, onClose, reason = 'generic' }) => {
    const copy = REASON_COPY[reason];

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/50">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
                {/* Header */}
                <div className="relative bg-gradient-to-br from-blue-600 to-violet-600 px-6 pt-8 pb-6 text-white">
                    <button
                        type="button"
                        onClick={onClose}
                        className="absolute top-4 right-4 p-1.5 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors"
                    >
                        <XIcon className="text-xl" />
                    </button>
                    <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center mb-4">
                        <WorkspacePremiumIcon className="text-3xl text-yellow-300" />
                    </div>
                    <h2 className="text-xl font-bold">{copy.title}</h2>
                    <p className="text-blue-100 text-sm mt-1 leading-relaxed">{copy.desc}</p>
                </div>

                {/* Features */}
                <div className="px-6 py-5">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Pro 플랜 혜택</p>
                    <ul className="space-y-2.5">
                        {PRO_FEATURES.map(f => (
                            <li key={f.text} className="flex items-start gap-3">
                                <span className="text-lg leading-none mt-0.5 flex-shrink-0">{f.icon}</span>
                                <span className="text-sm text-slate-700">{f.text}</span>
                            </li>
                        ))}
                    </ul>

                    {/* CTA */}
                    <div className="mt-6 space-y-2">
                        <button
                            type="button"
                            onClick={() => {
                                window.open('mailto:support@clevermonkey.app?subject=Pro Plan Upgrade', '_blank');
                            }}
                            className="w-full py-3 bg-gradient-to-r from-blue-600 to-violet-600 text-white rounded-xl font-bold text-sm hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
                        >
                            <BoltIcon className="text-base" />
                            Pro로 업그레이드
                        </button>
                        <button
                            type="button"
                            onClick={onClose}
                            className="w-full py-2.5 text-slate-500 text-sm font-medium hover:text-slate-700 transition-colors"
                        >
                            나중에 하기
                        </button>
                    </div>

                    <p className="text-center text-xs text-slate-400 mt-3">
                        업그레이드 문의: <a href="mailto:support@clevermonkey.app" className="text-blue-500 hover:underline">support@clevermonkey.app</a>
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
