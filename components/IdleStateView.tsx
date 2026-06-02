import * as React from 'react';
import {
    UploadIcon, CleverMonkeyIcon,
    ChatIcon, AssignmentIcon, StyleIcon, AccountTreeIcon, HeadphonesIcon,
    SpaceDashboardIcon, BoltIcon, LockIcon,
} from './icons';
import { Button } from './ui/Button';
import { DoodleStar, DoodleSparkle, DoodleUnderline } from './Doodles';

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
    { num: '01', title: '문서 업로드', desc: 'PDF·이미지·텍스트 무엇이든.' },
    { num: '02', title: 'AI가 분석',    desc: '요약·핵심 개념·예시 추출.' },
    { num: '03', title: '체화·복습',    desc: '퀴즈·플래시카드로 마스터.' },
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
                    <CleverMonkeyIcon className="w-10 h-10 text-brand-500" />
                    <span className="text-h2 text-ink-900">Clever Monkey</span>
                </div>
                {!userEmail && onSignInClick && (
                    <Button variant="outline" size="sm" onClick={onSignInClick}>Sign in</Button>
                )}
            </header>

            <main className="relative z-10 max-w-5xl mx-auto px-6 pt-10 pb-20">
                {/* Hero — the one personality moment kept from Tier 1 */}
                <div className="text-center max-w-3xl mx-auto">
                    {/* Mascot flanked by hand-drawn sparkles */}
                    <div className="relative inline-block mb-6">
                        <DoodleSparkle className="absolute -top-3 -right-6 w-7 h-7 text-warning-500" />
                        <DoodleStar    className="absolute -top-1 -left-8 w-6 h-6 text-brand-400 rotate-12" />
                        <CleverMonkeyIcon className="w-28 h-28 md:w-32 md:h-32 text-brand-500 animate-fade-in" />
                        <DoodleStar    className="absolute -bottom-2 -right-8 w-5 h-5 text-brand-300 -rotate-6" />
                    </div>

                    {/* Crayon headline — handwritten, slightly tilted, wobbly underline */}
                    <h1 className="font-handwritten font-bold text-ink-900 leading-none tracking-tight
                                   text-[3rem] sm:text-[4rem] md:text-[5rem]
                                   -rotate-[1.5deg] inline-block">
                        My monkey is{' '}
                        <span className="relative inline-block text-brand-600">
                            cleverer
                            <DoodleUnderline className="absolute left-0 right-0 -bottom-3 w-full h-4 text-warning-500" />
                        </span>
                        <br className="hidden sm:block" />
                        <span className="sm:ml-0"> than yours.</span>
                    </h1>

                    <p className="mt-8 text-body-lg text-ink-500 max-w-xl mx-auto">
                        문서를 올리면 AI 튜터가 함께합니다.
                        <br className="hidden sm:block" />
                        요약·퀴즈·플래시카드·마인드맵·팟캐스트로 체화될 때까지.
                    </p>
                </div>

                {/* Upload card */}
                <div className="mt-10 max-w-2xl mx-auto">
                    <div
                        onClick={handleClick}
                        role="button"
                        tabIndex={0}
                        className={[
                            'relative group cursor-pointer rounded-2xl bg-white border border-dashed',
                            'transition-[transform,border-color,background-color] duration-200 ease-out active:scale-[0.99]',
                            isDragging
                                ? 'border-brand-500 bg-brand-50'
                                : 'border-ink-250 hover:border-brand-400',
                        ].join(' ')}
                    >
                        <div className="p-10 md:p-12 flex flex-col items-center text-center">
                            <div className={[
                                'w-16 h-16 rounded-2xl flex items-center justify-center transition-colors duration-200',
                                isDragging
                                    ? 'bg-brand-500'
                                    : 'bg-brand-100 group-hover:bg-brand-500',
                            ].join(' ')}>
                                <UploadIcon className={[
                                    'text-3xl transition-colors duration-200',
                                    isDragging ? 'text-white' : 'text-brand-700 group-hover:text-white',
                                ].join(' ')} />
                            </div>
                            <p className="mt-5 text-h2">
                                파일을 끌어놓거나 클릭해서 업로드
                            </p>
                            <p className="mt-2 text-body text-ink-500">
                                PDF · 이미지(JPG/PNG/WebP/HEIC) · TXT · MD 지원
                            </p>
                            <div className="mt-5 flex items-center gap-2 text-caption text-ink-500">
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
                        <div className="mt-4 flex items-center justify-center gap-2 text-caption text-ink-500">
                            <BoltIcon className="text-sm text-brand-500" />
                            <span>로그인하면 문서와 학습 진척이 기기 간 동기화됩니다.</span>
                            <button type="button" onClick={onSignInClick} className="font-semibold text-brand-700 hover:text-brand-800 transition-colors duration-200">
                                지금 로그인 →
                            </button>
                        </div>
                    )}
                </div>

                {/* How it works */}
                <section className="mt-20">
                    <div className="text-center mb-8">
                        <p className="text-eyebrow text-brand-700">How it works</p>
                        <h2 className="mt-2 text-display-xl">3단계로 시작합니다</h2>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {STEPS.map(s => (
                            <div key={s.num} className="bg-white rounded-lg border border-ink-200 p-5 shadow-card">
                                <p className="text-2xl font-extrabold text-brand-500 leading-none tabular-nums">{s.num}</p>
                                <p className="mt-3 text-h3">{s.title}</p>
                                <p className="mt-1 text-body text-ink-500">{s.desc}</p>
                            </div>
                        ))}
                    </div>
                </section>

                {/* Features grid */}
                <section className="mt-16">
                    <div className="text-center mb-8">
                        <p className="text-eyebrow text-brand-700">Tools</p>
                        <h2 className="mt-2 text-display-xl">업로드 후 열리는 학습 도구</h2>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                        {FEATURES.map(({ icon: Icon, label, blurb }) => (
                            <div key={label} className="bg-white rounded-lg border border-ink-200 p-4 shadow-card">
                                <div className="w-10 h-10 rounded-lg bg-brand-100 flex items-center justify-center">
                                    <Icon className="text-xl text-brand-700" />
                                </div>
                                <p className="mt-3 text-h4">{label}</p>
                                <p className="mt-1 text-body-sm text-ink-500">{blurb}</p>
                            </div>
                        ))}
                    </div>
                </section>
            </main>
        </div>
    );
};

