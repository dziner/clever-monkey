import * as React from 'react';
import {
    UploadIcon, CleverMonkeyIcon,
    ChatIcon, AssignmentIcon, StyleIcon, AccountTreeIcon, HeadphonesIcon,
    SpaceDashboardIcon, LockIcon,
} from './icons';
import { Button } from './ui/Button';
import { DoodleStar, DoodleSparkle, DoodleArrow, DoodleSwoosh, DoodleUnderline } from './Doodles';

interface IdleStateViewProps {
    onFileSelected: (file: File) => void;
    userEmail?: string | null;
    onSignInClick?: () => void;
}

const FEATURES = [
    { icon: SpaceDashboardIcon, label: 'Overview',   blurb: '얼마나 했나 한눈에' },
    { icon: ChatIcon,           label: 'Chat',       blurb: '같이 떠들기' },
    { icon: AssignmentIcon,     label: 'Quiz',       blurb: '머리 굴리기' },
    { icon: StyleIcon,          label: 'Flashcards', blurb: '외울 때까지 들이기' },
    { icon: AccountTreeIcon,    label: 'Mind Map',   blurb: '머리 정리' },
    { icon: HeadphonesIcon,     label: 'Podcast',    blurb: '걸으며 듣기' },
];

const STEPS = [
    { num: '01', title: '뭐 하나 가져와',   desc: 'PDF든 사진이든 텍스트든. 던져봐.' },
    { num: '02', title: '원숭이가 다 읽어', desc: '요약, 퀴즈, 카드 — 알아서 다 만들어.' },
    { num: '03', title: '시험만 잘 봐',     desc: '오답은 카드로 다시 줄게. 외워질 때까지.' },
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
                    <Button variant="raised-ghost" size="sm" onClick={onSignInClick}>로그인</Button>
                )}
            </header>

            <main className="relative z-10 max-w-5xl mx-auto px-6 pt-10 pb-20">
                {/* Hero */}
                <div className="text-center max-w-3xl mx-auto">
                    {/* Mascot — flanked by hand-drawn sparkles */}
                    <div className="relative inline-block mb-6">
                        <DoodleSparkle className="absolute -top-3 -right-6 w-7 h-7 text-warning-500" />
                        <DoodleStar    className="absolute -top-1 -left-8 w-6 h-6 text-brand-400 tilt-2r" />
                        <CleverMonkeyIcon className="w-28 h-28 md:w-32 md:h-32 text-brand-500 drop-shadow-[0_8px_16px_rgba(124,58,237,0.25)] animate-fade-in" />
                        <DoodleStar    className="absolute -bottom-2 -right-8 w-5 h-5 text-brand-300 tilt-1" />
                    </div>

                    {/* Crayon headline — handwritten, slightly tilted, with wobbly underline */}
                    <div className="relative inline-block">
                        <h1 className="font-handwritten font-bold text-ink-900 leading-none tracking-tight
                                       text-[3rem] sm:text-[4rem] md:text-[5rem]
                                       -rotate-[1.5deg]">
                            My monkey is{' '}
                            <span className="relative inline-block text-brand-600">
                                cleverer
                                <DoodleUnderline className="absolute left-0 right-0 -bottom-3 w-full h-4 text-warning-500" />
                            </span>
                            <br className="hidden sm:block" />
                            <span className="sm:ml-0"> than yours.</span>
                        </h1>
                    </div>

                    <p className="mt-7 text-body-lg text-ink-600 max-w-xl mx-auto">
                        어차피 공부할 거잖아.{' '}
                        <span className="relative inline-block">
                            똑똑한 친구
                            <DoodleSwoosh className="absolute -bottom-2 left-0 w-full h-3 text-brand-300 opacity-70" />
                        </span>
                        {' '}하나 끼워줄게.
                    </p>
                </div>

                {/* Upload card — chunky drop zone */}
                <div className="mt-12 max-w-2xl mx-auto relative">
                    {/* Doodle arrow pointing into the zone */}
                    <DoodleArrow className="hidden md:block absolute -left-16 -top-6 w-16 h-12 text-ink-400 tilt-1 opacity-80" />

                    <div
                        onClick={handleClick}
                        role="button"
                        tabIndex={0}
                        className={[
                            'relative group cursor-pointer rounded-3xl bg-white border-[3px] border-dashed',
                            'transition-all duration-200',
                            isDragging
                                ? 'border-brand-500 bg-brand-50/60 shadow-shelf-brand -translate-y-1'
                                : 'border-ink-200 hover:border-brand-400 hover:-translate-y-1 hover:shadow-shelf-brand',
                        ].join(' ')}
                    >
                        <div className="p-10 md:p-12 flex flex-col items-center text-center">
                            <div className={[
                                'w-20 h-20 rounded-3xl flex items-center justify-center transition-all duration-200 border-[3px]',
                                isDragging
                                    ? 'bg-brand-500 border-brand-700 shadow-shelf-brand scale-110'
                                    : 'bg-brand-50 border-brand-200 group-hover:bg-brand-500 group-hover:border-brand-700',
                            ].join(' ')}>
                                <UploadIcon className={[
                                    'text-4xl transition-colors duration-200',
                                    isDragging ? 'text-white' : 'text-brand-600 group-hover:text-white',
                                ].join(' ')} />
                            </div>
                            <p className="mt-6 font-handwritten font-bold text-3xl text-ink-800">
                                뭐 가져왔어? 던져봐.
                            </p>
                            <p className="mt-2 text-body text-ink-500">
                                PDF · 이미지 · TXT · MD — 다 됨.
                            </p>
                            <div className="mt-5 flex items-center gap-1.5 text-caption text-ink-400">
                                <LockIcon className="text-sm" />
                                <span>비밀로 할게. 원숭이 약속.</span>
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
                        <p className="mt-4 text-center text-caption text-ink-500">
                            로그인하면 어디서든 이어서 할 수 있어.{' '}
                            <button type="button" onClick={onSignInClick} className="font-extrabold text-brand-600 hover:text-brand-700 underline-offset-2 hover:underline">
                                지금 들어가기 →
                            </button>
                        </p>
                    )}
                </div>

                {/* How it works — polaroid-tilted steps */}
                <section className="mt-24">
                    <div className="text-center mb-10">
                        <p className="text-eyebrow text-brand-600">대충 이런 식임</p>
                        <h2 className="mt-2 font-handwritten font-bold text-4xl md:text-5xl text-ink-900 -rotate-1 inline-block">
                            어쩌다가 이게 다 돼요
                        </h2>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                        {STEPS.map((s, i) => {
                            const tilt = ['tilt-1', '', 'tilt-1r'][i];
                            return (
                                <div key={s.num} className={`surface-chunky p-6 transition-transform hover:-translate-y-1 hover:rotate-0 ${tilt}`}>
                                    <p className="font-handwritten font-bold text-5xl text-brand-600 leading-none -rotate-3 inline-block">{s.num}</p>
                                    <p className="mt-3 text-h3 text-ink-800">{s.title}</p>
                                    <p className="mt-1 text-body text-ink-500">{s.desc}</p>
                                </div>
                            );
                        })}
                    </div>
                </section>

                {/* Features grid */}
                <section className="mt-20">
                    <div className="text-center mb-10">
                        <p className="text-eyebrow text-brand-600">Toolbox</p>
                        <h2 className="mt-2 font-handwritten font-bold text-4xl md:text-5xl text-ink-900 rotate-1 inline-block">
                            원숭이가 할 줄 아는 것들
                        </h2>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                        {FEATURES.map(({ icon: Icon, label, blurb }, i) => {
                            const tilts = ['tilt-1', '', 'tilt-1r', 'tilt-1r', '', 'tilt-1'];
                            return (
                                <div key={label} className={`surface-chunky p-5 transition-transform hover:-translate-y-1 hover:rotate-0 ${tilts[i]}`}>
                                    <div className="w-11 h-11 rounded-2xl bg-brand-100 border-2 border-brand-200 flex items-center justify-center">
                                        <Icon className="text-xl text-brand-600" />
                                    </div>
                                    <p className="mt-3 text-h4 text-ink-800">{label}</p>
                                    <p className="mt-0.5 text-body-sm text-ink-500">{blurb}</p>
                                </div>
                            );
                        })}
                    </div>
                </section>

                {/* Closing kitsch quote */}
                <section className="mt-20 text-center">
                    <p className="font-handwritten font-bold text-2xl text-ink-700 -rotate-1 inline-block">
                        "공부 못 하는 거 아냐. 도구가 후진 거지."
                    </p>
                    <p className="mt-2 text-caption text-ink-400">— 원숭이</p>
                </section>
            </main>
        </div>
    );
};
