import * as React from 'react';
import {
    UploadIcon, CleverMonkeyIcon,
    ChatIcon, AssignmentIcon, StyleIcon, AccountTreeIcon, HeadphonesIcon,
    SpaceDashboardIcon, BoltIcon, LockIcon, AutoAwesomeIcon,
} from './icons';
import { Button } from './ui/Button';
import { Badge } from './ui/Badge';

interface IdleStateViewProps {
    onFileSelected: (file: File) => void;
    userEmail?: string | null;
    onSignInClick?: () => void;
}

const FEATURES = [
    { icon: SpaceDashboardIcon, label: 'Overview',   blurb: '한눈에 보는 학습 진척' },
    { icon: ChatIcon,           label: 'Chat',       blurb: '문서 기반 AI 대화' },
    { icon: AssignmentIcon,     label: 'Quiz',       blurb: '즉석 문제 생성·평가' },
    { icon: StyleIcon,          label: 'Flashcards', blurb: '간격 반복 암기' },
    { icon: AccountTreeIcon,    label: 'Mind Map',   blurb: '개념 구조화' },
    { icon: HeadphonesIcon,     label: 'Podcast',    blurb: '걸으며 듣는 학습' },
];

const STEPS = [
    { num: '01', title: '문서 업로드',  desc: 'PDF·이미지·텍스트 무엇이든.' },
    { num: '02', title: 'AI가 분석',     desc: '요약·핵심 개념·예시 추출.' },
    { num: '03', title: '체화·복습',     desc: '퀴즈·플래시카드로 마스터.' },
];

export const IdleStateView: React.FC<IdleStateViewProps> = ({ onFileSelected, userEmail, onSignInClick }) => {
    const [isDragging, setIsDragging] = React.useState(false);
    const inputRef = React.useRef<HTMLInputElement>(null);

    const stopDefault = (e: React.DragEvent<HTMLDivElement>) => { e.preventDefault(); e.stopPropagation(); };
    const handleDragEnter = (e: React.DragEvent<HTMLDivElement>) => { stopDefault(e); setIsDragging(true); };
    const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => { stopDefault(e); setIsDragging(false); };
    const handleDragOver  = (e: React.DragEvent<HTMLDivElement>) => { stopDefault(e); };
    const handleDrop = React.useCallback((e: React.DragEvent<HTMLDivElement>) => {
        stopDefault(e);
        setIsDragging(false);
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            onFileSelected(e.dataTransfer.files[0]);
            e.dataTransfer.clearData();
        }
    }, [onFileSelected]);

    const handleClick = () => inputRef.current?.click();
    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) onFileSelected(e.target.files[0]);
    };

    return (
        <div
            className="relative min-h-dvh w-full bg-grid bg-ink-50 overflow-y-auto pb-safe"
            onDrop={handleDrop} onDragOver={handleDragOver} onDragEnter={handleDragEnter} onDragLeave={handleDragLeave}
        >
            {/* Brand glow background */}
            <div className="absolute inset-0 bg-brand-glow pointer-events-none" aria-hidden="true" />

            {/* Top bar */}
            <header className="relative z-10 max-w-5xl mx-auto px-6 pt-8 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center shadow-brand">
                        <CleverMonkeyIcon className="w-5 h-5 text-white" />
                    </div>
                    <span className="font-display font-bold text-ink-900 text-lg tracking-tight">Clever Monkey</span>
                </div>
                {!userEmail && onSignInClick && (
                    <Button variant="outline" size="sm" onClick={onSignInClick}>Sign in</Button>
                )}
            </header>

            <main className="relative z-10 max-w-5xl mx-auto px-6 pt-12 pb-20">
                {/* Hero */}
                <div className="text-center max-w-2xl mx-auto">
                    <Badge tone="brand" variant="soft" size="md" className="mx-auto">
                        <AutoAwesomeIcon className="text-[14px] mr-0.5" />
                        AI Study Companion
                    </Badge>
                    <h1 className="mt-5 text-4xl md:text-5xl font-display font-bold tracking-tight text-ink-900">
                        문서를 올리면,<br className="hidden sm:block" />
                        AI 튜터가 함께합니다.
                    </h1>
                    <p className="mt-4 text-base md:text-lg text-ink-500 leading-relaxed">
                        PDF·강의노트·교재를 업로드하면 요약·퀴즈·플래시카드·마인드맵·팟캐스트로
                        <br className="hidden sm:block" />
                        체화될 때까지 학습을 안내합니다.
                    </p>
                </div>

                {/* Upload card */}
                <div className="mt-10 max-w-2xl mx-auto">
                    <div
                        onClick={handleClick}
                        role="button"
                        tabIndex={0}
                        className={[
                            'relative group cursor-pointer rounded-3xl bg-white border-2 border-dashed',
                            'transition-all duration-300',
                            isDragging
                                ? 'border-brand-500 bg-brand-50/60 shadow-brand scale-[1.01]'
                                : 'border-ink-200 hover:border-brand-400 hover:shadow-lift',
                        ].join(' ')}
                    >
                        <div className="p-10 md:p-12 flex flex-col items-center text-center">
                            <div className={[
                                'w-16 h-16 rounded-2xl flex items-center justify-center transition-all duration-300',
                                isDragging
                                    ? 'bg-gradient-to-br from-brand-500 to-brand-700 shadow-brand scale-110'
                                    : 'bg-brand-50 group-hover:bg-gradient-to-br group-hover:from-brand-500 group-hover:to-brand-700',
                            ].join(' ')}>
                                <UploadIcon className={[
                                    'text-3xl transition-colors duration-300',
                                    isDragging ? 'text-white' : 'text-brand-600 group-hover:text-white',
                                ].join(' ')} />
                            </div>
                            <p className="mt-5 text-lg md:text-xl font-semibold text-ink-800">
                                파일을 끌어놓거나 클릭해서 업로드
                            </p>
                            <p className="mt-1.5 text-sm text-ink-500">
                                PDF · 이미지(JPG/PNG/WebP/HEIC) · TXT · MD 지원
                            </p>
                            <div className="mt-5 flex items-center gap-2 text-xs text-ink-400">
                                <LockIcon className="text-sm" />
                                <span>업로드한 파일은 본인만 볼 수 있습니다.</span>
                            </div>
                        </div>
                        <input
                            ref={inputRef}
                            type="file"
                            className="hidden"
                            accept="application/pdf,image/jpeg,image/png,image/webp,image/heic,image/heif,text/plain,text/markdown,.txt,.md"
                            onChange={handleFileChange}
                        />
                    </div>

                    {!userEmail && onSignInClick && (
                        <div className="mt-4 flex items-center justify-center gap-2 text-xs text-ink-500">
                            <BoltIcon className="text-sm text-brand-500" />
                            <span>로그인하면 문서와 학습 진척이 기기 간 동기화됩니다.</span>
                            <button type="button" onClick={onSignInClick} className="font-semibold text-brand-600 hover:text-brand-700">
                                지금 로그인 →
                            </button>
                        </div>
                    )}
                </div>

                {/* How it works */}
                <section className="mt-20">
                    <div className="text-center mb-8">
                        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-brand-600">How it works</p>
                        <h2 className="mt-2 text-2xl md:text-3xl font-display font-bold text-ink-900 tracking-tight">3단계로 시작합니다</h2>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {STEPS.map(s => (
                            <div key={s.num} className="relative bg-white rounded-2xl border border-ink-200 p-6 shadow-soft hover:shadow-card transition-shadow">
                                <p className="font-display text-3xl font-bold text-brand-600 leading-none">{s.num}</p>
                                <p className="mt-3 text-base font-bold text-ink-800">{s.title}</p>
                                <p className="mt-1 text-sm text-ink-500 leading-relaxed">{s.desc}</p>
                            </div>
                        ))}
                    </div>
                </section>

                {/* Features grid */}
                <section className="mt-16">
                    <div className="text-center mb-8">
                        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-brand-600">Tools</p>
                        <h2 className="mt-2 text-2xl md:text-3xl font-display font-bold text-ink-900 tracking-tight">업로드 후 열리는 학습 도구</h2>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                        {FEATURES.map(({ icon: Icon, label, blurb }) => (
                            <div key={label} className="bg-white rounded-2xl border border-ink-200 p-5 shadow-soft hover:shadow-card hover:border-brand-200 transition-all">
                                <div className="w-10 h-10 rounded-xl bg-brand-50 flex items-center justify-center">
                                    <Icon className="text-xl text-brand-600" />
                                </div>
                                <p className="mt-3 text-sm font-bold text-ink-800">{label}</p>
                                <p className="mt-0.5 text-xs text-ink-500 leading-relaxed">{blurb}</p>
                            </div>
                        ))}
                    </div>
                </section>
            </main>
        </div>
    );
};
