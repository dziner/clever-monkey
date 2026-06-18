import * as React from 'react';
import {
    UploadIcon, CleverMonkeyIcon,
    ChatIcon, AssignmentIcon, StyleIcon, AccountTreeIcon, HeadphonesIcon,
    SpaceDashboardIcon, BoltIcon, LockIcon, CheckIcon,
    AutoAwesomeIcon, PlayArrowIcon, BarChartIcon, TextSnippetIcon,
} from './icons';
import { Button } from './ui/Button';
import { LegalFooter } from './LegalFooter';

interface IdleStateViewProps {
    onFileSelected: (file: File) => void;
    userEmail?: string | null;
    onSignInClick?: () => void;
}

type IconComponent = React.FC<React.HTMLAttributes<HTMLSpanElement>>;

interface WorkflowStep {
    num: string;
    label: string;
    title: string;
    desc: string;
    bullets: string[];
}

interface FeatureStory {
    icon: IconComponent;
    label: string;
    title: string;
    body: string;
    metric: string;
    accent: 'brand' | 'info' | 'success' | 'warning';
}

interface ToolCard {
    icon: IconComponent;
    label: string;
    title: string;
    outcome: string;
    tags: string[];
}

const WORKFLOW_STEPS: WorkflowStep[] = [
    {
        num: '01',
        label: 'Upload',
        title: '자료를 올립니다',
        desc: 'PDF, 이미지, 메모를 올리면 바로 읽을 수 있는 학습 작업공간이 만들어집니다.',
        bullets: ['PDF와 이미지 OCR', '문서별 개인 보관', '업로드 즉시 분석 준비'],
    },
    {
        num: '02',
        label: 'Analyze',
        title: '핵심을 구조화합니다',
        desc: '긴 문서를 요약, 개념, 질문 단위로 나누고 오늘 볼 순서를 먼저 제안합니다.',
        bullets: ['핵심 요약', '개념 묶음', '문서 기반 대화'],
    },
    {
        num: '03',
        label: 'Review',
        title: '복습 루프를 돌립니다',
        desc: '퀴즈, 플래시카드, 마인드맵, 팟캐스트로 이해와 기억을 함께 끌어올립니다.',
        bullets: ['퀴즈와 채점', '암기 카드', '오디오 복습'],
    },
];

const FEATURE_STORIES: FeatureStory[] = [
    {
        icon: SpaceDashboardIcon,
        label: 'Overview',
        title: '먼저 오늘 봐야 할 것만 정리합니다',
        body: '업로드한 자료를 한 번에 훑고, 핵심 개념과 예상 난이도를 먼저 보여줍니다.',
        metric: '7 min read',
        accent: 'brand',
    },
    {
        icon: AssignmentIcon,
        label: 'Quiz',
        title: '읽은 척을 바로 걸러냅니다',
        body: '객관식과 서술형 문제로 실제로 이해했는지 확인하고, 틀린 부분은 다시 연결합니다.',
        metric: '12 checks',
        accent: 'info',
    },
    {
        icon: AccountTreeIcon,
        label: 'Map',
        title: '흩어진 내용을 기억 구조로 바꿉니다',
        body: '마인드맵과 플래시카드가 용어, 원인, 결과를 묶어 오래 남는 구조를 만듭니다.',
        metric: '24 cards',
        accent: 'success',
    },
    {
        icon: HeadphonesIcon,
        label: 'Podcast',
        title: '책상 밖에서도 이어서 복습합니다',
        body: '핵심 요약을 들을 수 있는 흐름으로 바꿔 이동 중에도 학습 리듬을 끊지 않습니다.',
        metric: '9 min audio',
        accent: 'warning',
    },
];

const TOOL_CARDS: ToolCard[] = [
    {
        icon: SpaceDashboardIcon,
        label: 'Overview',
        title: '긴 자료의 첫 화면',
        outcome: '핵심 주장, 섹션별 요약, 오늘의 우선순위를 먼저 정리합니다.',
        tags: ['Summary', 'Priority'],
    },
    {
        icon: ChatIcon,
        label: 'Chat',
        title: '자료를 아는 튜터',
        outcome: '업로드한 문서 안에서 근거를 찾고, 모르는 문장을 다시 설명합니다.',
        tags: ['Grounded', 'Ask'],
    },
    {
        icon: AssignmentIcon,
        label: 'Quiz',
        title: '이해도 점검',
        outcome: '객관식, 단답형, 서술형 질문으로 빈틈을 빠르게 확인합니다.',
        tags: ['MCQ', 'FRQ'],
    },
    {
        icon: StyleIcon,
        label: 'Flashcards',
        title: '반복 암기 카드',
        outcome: '정의, 공식, 사례를 카드로 바꾸고 헷갈리는 것만 다시 봅니다.',
        tags: ['Recall', 'Review'],
    },
    {
        icon: AccountTreeIcon,
        label: 'Mind Map',
        title: '개념 관계 지도',
        outcome: '용어와 개념 사이의 연결을 시각화해 큰 구조부터 잡습니다.',
        tags: ['Structure', 'Map'],
    },
    {
        icon: HeadphonesIcon,
        label: 'Podcast',
        title: '듣는 복습',
        outcome: '요약을 오디오 흐름으로 바꿔 이동 시간에도 이어서 공부합니다.',
        tags: ['Audio', 'Mobile'],
    },
];

const HERO_STATS = [
    { value: '6 tools', label: '요약부터 오디오까지' },
    { value: '3 steps', label: '업로드 후 바로 복습' },
    { value: 'Private', label: '내 자료는 내 계정에' },
];

const accentClasses: Record<FeatureStory['accent'], string> = {
    brand: 'bg-brand-100 text-brand-700 border-brand-200',
    info: 'bg-info-50 text-info-700 border-info-100',
    success: 'bg-success-50 text-success-700 border-success-100',
    warning: 'bg-warning-50 text-warning-700 border-warning-100',
};

export const IdleStateView: React.FC<IdleStateViewProps> = ({ onFileSelected, userEmail, onSignInClick }) => {
    const [isDragging, setIsDragging] = React.useState(false);
    const [activeStep, setActiveStep] = React.useState(0);
    const [activeStory, setActiveStory] = React.useState(0);
    const inputRef = React.useRef<HTMLInputElement>(null);
    const storyRefs = React.useRef<Array<HTMLDivElement | null>>([]);

    React.useEffect(() => {
        if (typeof window === 'undefined') return;
        const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
        if (motion.matches) return;
        const timer = window.setInterval(() => {
            setActiveStep(current => (current + 1) % WORKFLOW_STEPS.length);
        }, 4200);
        return () => window.clearInterval(timer);
    }, []);

    React.useEffect(() => {
        if (typeof IntersectionObserver === 'undefined') return;

        const observer = new IntersectionObserver(
            entries => {
                const visible = entries
                    .filter(entry => entry.isIntersecting)
                    .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
                if (!visible) return;

                const index = Number((visible.target as HTMLElement).dataset.storyIndex);
                if (Number.isFinite(index)) setActiveStory(index);
            },
            { rootMargin: '-25% 0px -35% 0px', threshold: [0.35, 0.55, 0.75] },
        );

        storyRefs.current.forEach(node => {
            if (node) observer.observe(node);
        });
        return () => observer.disconnect();
    }, []);

    const stopDefault = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
    };
    const handleDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
        stopDefault(e);
        setIsDragging(true);
    };
    const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
        stopDefault(e);
        setIsDragging(false);
    };
    const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
        stopDefault(e);
    };
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

    const activeWorkflow = WORKFLOW_STEPS[activeStep];
    const activeFeature = FEATURE_STORIES[activeStory];

    return (
        <div
            className="relative min-h-dvh w-full overflow-y-auto bg-ink-50 pb-safe text-ink-900"
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
        >
            <header className="relative z-10 mx-auto flex max-w-7xl items-center justify-between px-5 pt-6 sm:px-8 lg:px-10">
                <div className="flex min-w-0 items-center gap-2.5">
                    <CleverMonkeyIcon className="h-10 w-10 shrink-0 text-brand-500" />
                    <span className="truncate text-lg font-extrabold text-ink-900">Clever Monkey</span>
                </div>
                {!userEmail && onSignInClick && (
                    <Button variant="outline" size="sm" onClick={onSignInClick}>Sign in</Button>
                )}
            </header>

            <main className="relative z-10">
                <section className="mx-auto grid max-w-7xl items-center gap-10 px-5 pb-16 pt-10 sm:px-8 lg:grid-cols-[0.92fr_1.08fr] lg:px-10 lg:pb-24 lg:pt-16">
                    <div>
                        <div className="inline-flex items-center gap-2 rounded-full border border-brand-200 bg-white px-3 py-1.5 text-sm font-bold text-brand-700 shadow-card">
                            <BoltIcon className="text-base" />
                            문서가 곧 학습 시스템이 됩니다
                        </div>

                        <h1 className="mt-6 max-w-3xl text-4xl font-extrabold leading-tight text-ink-950 sm:text-5xl lg:text-6xl">
                            문서를 올리면,
                            <span className="block text-brand-700">공부 흐름이 바로 생깁니다.</span>
                        </h1>

                        <p className="mt-5 max-w-2xl text-base leading-8 text-ink-700 sm:text-lg">
                            Clever Monkey는 요약에서 퀴즈, 플래시카드, 마인드맵, 팟캐스트까지 이어지는 복습 루프를 만들어 줍니다.
                            한 번 읽고 끝나는 자료를 실제로 기억에 남는 학습 경험으로 바꿉니다.
                        </p>

                        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                            <Button
                                size="lg"
                                onClick={handleClick}
                                leftIcon={<UploadIcon className="text-xl" />}
                                className="shadow-brand"
                            >
                                문서 업로드로 시작하기
                            </Button>
                            {!userEmail && onSignInClick && (
                                <Button size="lg" variant="outline" onClick={onSignInClick}>
                                    로그인하고 저장하기
                                </Button>
                            )}
                        </div>

                        <div className="mt-4 flex flex-wrap items-center gap-2 text-sm font-medium text-ink-600">
                            <LockIcon className="text-base text-brand-600" />
                            <span>업로드한 파일은 본인만 볼 수 있습니다.</span>
                        </div>

                        <div className="mt-8 grid max-w-2xl grid-cols-1 gap-3 sm:grid-cols-3">
                            {HERO_STATS.map(stat => (
                                <div key={stat.value} className="rounded-lg border border-ink-200 bg-white px-4 py-3 shadow-card">
                                    <p className="text-base font-extrabold text-ink-950">{stat.value}</p>
                                    <p className="mt-1 text-sm leading-5 text-ink-500">{stat.label}</p>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="relative">
                        <HeroPreview />
                    </div>
                </section>

                <section className="border-y border-ink-200 bg-white">
                    <div className="mx-auto grid max-w-7xl gap-8 px-5 py-14 sm:px-8 lg:grid-cols-[0.72fr_1.28fr] lg:px-10 lg:py-20">
                        <div>
                            <p className="text-xs font-extrabold uppercase text-brand-700">How it works</p>
                            <h2 className="mt-3 text-3xl font-extrabold leading-snug text-ink-950">
                                업로드에서 복습까지, 세 단계가 자동으로 이어집니다
                            </h2>
                            <p className="mt-4 text-base leading-8 text-ink-600">
                                단계별 탭은 순차적으로 전환되며, 사용자가 언제든 원하는 단계로 바로 이동할 수 있습니다.
                                자료를 넣는 순간부터 학습 결과물이 쌓이는 흐름을 한눈에 보여줍니다.
                            </p>
                        </div>

                        <div className="min-w-0">
                            <div className="grid gap-3 md:grid-cols-3" role="tablist" aria-label="학습 단계">
                                {WORKFLOW_STEPS.map((step, index) => {
                                    const isActive = index === activeStep;
                                    return (
                                        <button
                                            key={step.num}
                                            type="button"
                                            role="tab"
                                            aria-selected={isActive}
                                            aria-controls="workflow-preview"
                                            onClick={() => setActiveStep(index)}
                                            className={[
                                                'group min-h-[132px] rounded-lg border p-4 text-left transition-[transform,border-color,background-color] duration-200 active:scale-[0.98]',
                                                isActive
                                                    ? 'border-brand-300 bg-brand-50'
                                                    : 'border-ink-200 bg-ink-50 hover:border-ink-250 hover:bg-white',
                                            ].join(' ')}
                                        >
                                            <div className="flex items-center justify-between gap-3">
                                                <span className={isActive ? 'text-sm font-extrabold text-brand-700' : 'text-sm font-extrabold text-ink-500'}>
                                                    {step.num}
                                                </span>
                                                <span className={isActive ? 'text-xs font-bold text-brand-700' : 'text-xs font-bold text-ink-400'}>
                                                    {step.label}
                                                </span>
                                            </div>
                                            <p className="mt-4 text-lg font-extrabold text-ink-950">{step.title}</p>
                                            <p className="mt-2 text-sm leading-6 text-ink-600">{step.desc}</p>
                                            <div className="mt-4 h-1 overflow-hidden rounded-full bg-white">
                                                <div className={isActive ? 'h-full w-full rounded-full bg-brand-500 transition-all duration-700' : 'h-full w-0 rounded-full bg-brand-500'} />
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>

                            <div
                                id="workflow-preview"
                                role="tabpanel"
                                className="mt-4 rounded-lg border border-ink-200 bg-ink-950 p-4 text-white shadow-sheet"
                            >
                                <WorkflowPreview step={activeWorkflow} activeIndex={activeStep} />
                            </div>
                        </div>
                    </div>
                </section>

                <section className="mx-auto max-w-7xl px-5 py-16 sm:px-8 lg:px-10 lg:py-24">
                    <div className="max-w-3xl">
                        <p className="text-xs font-extrabold uppercase text-brand-700">Feature stories</p>
                        <h2 className="mt-3 text-3xl font-extrabold leading-snug text-ink-950">
                            스크롤할수록 학습 결과물이 바뀌어 보입니다
                        </h2>
                        <p className="mt-4 text-base leading-8 text-ink-600">
                            단순 기능 소개 대신, 업로드한 문서가 어떻게 읽기, 확인, 암기, 듣기로 전환되는지 결과 중심으로 보여줍니다.
                        </p>
                    </div>

                    <div className="mt-10 grid gap-8 lg:grid-cols-[0.95fr_1.05fr]">
                        <div className="space-y-4">
                            {FEATURE_STORIES.map((story, index) => {
                                const Icon = story.icon;
                                const isActive = index === activeStory;
                                return (
                                    <div
                                        key={story.label}
                                        ref={node => {
                                            storyRefs.current[index] = node;
                                        }}
                                        data-story-index={index}
                                        onMouseEnter={() => setActiveStory(index)}
                                        className={[
                                            'rounded-lg border bg-white p-5 shadow-card transition-[border-color,background-color,transform] duration-200',
                                            isActive ? 'border-brand-300 bg-brand-50/50' : 'border-ink-200 hover:border-ink-250',
                                        ].join(' ')}
                                    >
                                        <div className="flex items-start gap-4">
                                            <div className={['flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border', accentClasses[story.accent]].join(' ')}>
                                                <Icon className="text-xl" />
                                            </div>
                                            <div className="min-w-0">
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <span className="text-sm font-extrabold text-ink-950">{story.label}</span>
                                                    <span className="rounded-full bg-ink-150 px-2 py-1 text-xs font-bold text-ink-500">{story.metric}</span>
                                                </div>
                                                <h3 className="mt-2 text-xl font-extrabold leading-snug text-ink-950">{story.title}</h3>
                                                <p className="mt-2 text-sm leading-7 text-ink-600">{story.body}</p>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        <div className="lg:sticky lg:top-8 lg:self-start">
                            <FeaturePreview story={activeFeature} index={activeStory} />
                        </div>
                    </div>
                </section>

                <section className="bg-ink-950 py-16 text-white lg:py-24">
                    <div className="mx-auto max-w-7xl px-5 sm:px-8 lg:px-10">
                        <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
                            <div className="max-w-3xl">
                                <p className="text-xs font-extrabold uppercase text-brand-300">Tools</p>
                                <h2 className="mt-3 text-3xl font-extrabold leading-snug text-white">
                                    공부 도구가 따로 놀지 않고 하나의 루프로 이어집니다
                                </h2>
                            </div>
                            <p className="max-w-md text-sm leading-7 text-white/70">
                                각 도구는 같은 문서를 기준으로 작동합니다. 요약에서 틀린 문제로, 틀린 문제에서 카드와 맵으로 자연스럽게 돌아옵니다.
                            </p>
                        </div>

                        <div className="mt-10 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                            {TOOL_CARDS.map(tool => (
                                <ToolPreviewCard key={tool.label} tool={tool} />
                            ))}
                        </div>
                    </div>
                </section>

                <section className="mx-auto max-w-7xl px-5 py-14 sm:px-8 lg:px-10 lg:py-20">
                    <div className="grid gap-6 rounded-lg border border-ink-200 bg-white p-6 shadow-card md:grid-cols-[1fr_auto] md:items-center md:p-8">
                        <div>
                            <p className="text-xl font-extrabold text-ink-950">자료 하나만 올려도 충분합니다.</p>
                            <p className="mt-2 text-base leading-7 text-ink-600">
                                Clever Monkey가 요약, 질문, 암기, 듣기까지 이어지는 첫 복습 세트를 만들어 드립니다.
                            </p>
                        </div>
                        <Button
                            size="lg"
                            onClick={handleClick}
                            leftIcon={<UploadIcon className="text-xl" />}
                            className="w-full md:w-auto"
                        >
                            지금 업로드하기
                        </Button>
                    </div>
                </section>
            </main>

            <input
                ref={inputRef}
                type="file"
                className="hidden"
                accept="application/pdf,image/jpeg,image/png,image/webp,image/heic,image/heif,text/plain,text/markdown,.txt,.md"
                onChange={handleFileChange}
            />

            {isDragging && (
                <div className="pointer-events-none fixed inset-0 z-40 flex items-center justify-center bg-brand-500/12 p-6">
                    <div className="rounded-lg border border-brand-300 bg-white px-6 py-5 text-center shadow-sheet">
                        <UploadIcon className="mx-auto text-4xl text-brand-600" />
                        <p className="mt-3 text-lg font-extrabold text-ink-950">여기에 놓으면 바로 시작합니다</p>
                        <p className="mt-1 text-sm text-ink-500">PDF, 이미지, 텍스트 파일을 지원합니다.</p>
                    </div>
                </div>
            )}

            <LegalFooter />
        </div>
    );
};

const HeroPreview: React.FC = () => (
    <div className="rounded-lg border border-ink-200 bg-white p-3 shadow-sheet">
        <div className="overflow-hidden rounded-lg border border-ink-200">
            <div className="bg-gradient-to-br from-ink-950 via-ink-800 to-brand-950 p-5 text-white">
                <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-500">
                            <CleverMonkeyIcon className="h-7 w-7 text-white" />
                        </div>
                        <div>
                            <p className="text-sm font-extrabold">Biology midterm.pdf</p>
                            <p className="text-xs text-white/60">Analyzed just now</p>
                        </div>
                    </div>
                    <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-bold text-white">Ready</span>
                </div>

                <div className="mt-6 grid gap-3 md:grid-cols-[1.1fr_0.9fr]">
                    <div className="rounded-lg border border-white/10 bg-white/10 p-4">
                        <div className="flex items-center gap-2 text-xs font-bold text-brand-200">
                            <TextSnippetIcon className="text-base" />
                            Overview
                        </div>
                        <p className="mt-3 text-2xl font-extrabold leading-snug">세포 호흡의 핵심 흐름</p>
                        <div className="mt-4 space-y-2">
                            {['ATP 생성 단계', '해당 과정과 TCA 회로', '전자전달계의 역할'].map(item => (
                                <div key={item} className="flex items-center gap-2 rounded-lg bg-white/10 px-3 py-2 text-sm text-white/85">
                                    <CheckIcon className="shrink-0 text-brand-200" />
                                    <span>{item}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="grid gap-3">
                        <div className="rounded-lg border border-white/10 bg-white p-4 text-ink-950">
                            <div className="flex items-center justify-between">
                                <span className="text-sm font-extrabold">Quiz readiness</span>
                                <span className="text-sm font-extrabold text-brand-700">82%</span>
                            </div>
                            <div className="mt-3 h-2 overflow-hidden rounded-full bg-ink-150">
                                <div className="h-full w-4/5 rounded-full bg-brand-500" />
                            </div>
                            <p className="mt-3 text-xs leading-5 text-ink-500">틀리기 쉬운 개념 3개가 먼저 표시됩니다.</p>
                        </div>

                        <div className="rounded-lg border border-white/10 bg-white/10 p-4">
                            <div className="flex items-center justify-between text-sm font-bold">
                                <span>Podcast review</span>
                                <PlayArrowIcon className="text-xl text-brand-200" />
                            </div>
                            <div className="mt-4 grid grid-cols-9 items-end gap-1">
                                {[28, 52, 40, 76, 62, 88, 54, 70, 44].map((height, index) => (
                                    <div
                                        key={`${height}-${index}`}
                                        className="rounded-full bg-brand-300"
                                        style={{ height }}
                                    />
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid gap-3 bg-ink-50 p-4 sm:grid-cols-3">
                {[
                    { icon: AssignmentIcon, label: '12 quiz', value: 'Generated' },
                    { icon: StyleIcon, label: '24 cards', value: 'Need review' },
                    { icon: AccountTreeIcon, label: '1 map', value: 'Structured' },
                ].map(item => {
                    const Icon = item.icon;
                    return (
                        <div key={item.label} className="rounded-lg border border-ink-200 bg-white p-3">
                            <Icon className="text-xl text-brand-600" />
                            <p className="mt-2 text-sm font-extrabold text-ink-950">{item.label}</p>
                            <p className="text-xs text-ink-500">{item.value}</p>
                        </div>
                    );
                })}
            </div>
        </div>
    </div>
);

const WorkflowPreview: React.FC<{ step: WorkflowStep; activeIndex: number }> = ({ step, activeIndex }) => (
    <div className="grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
        <div className="rounded-lg border border-white/10 bg-white/10 p-5">
            <div className="flex items-center justify-between gap-3">
                <div>
                    <p className="text-sm font-extrabold text-brand-200">{step.num} {step.label}</p>
                    <h3 className="mt-2 text-2xl font-extrabold leading-snug text-white">{step.title}</h3>
                </div>
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-brand-500 text-xl font-extrabold text-white">
                    {activeIndex + 1}
                </div>
            </div>
            <p className="mt-4 text-sm leading-7 text-white/72">{step.desc}</p>
            <div className="mt-5 grid gap-2">
                {step.bullets.map(bullet => (
                    <div key={bullet} className="flex items-center gap-2 rounded-lg bg-white/10 px-3 py-2 text-sm text-white/85">
                        <CheckIcon className="shrink-0 text-brand-200" />
                        <span>{bullet}</span>
                    </div>
                ))}
            </div>
        </div>

        <div className="rounded-lg border border-white/10 bg-white p-4 text-ink-950">
            {activeIndex === 0 && <UploadStagePreview />}
            {activeIndex === 1 && <AnalyzeStagePreview />}
            {activeIndex === 2 && <ReviewStagePreview />}
        </div>
    </div>
);

const UploadStagePreview: React.FC = () => (
    <div>
        <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-extrabold">Drop zone</p>
            <span className="rounded-full bg-brand-100 px-2.5 py-1 text-xs font-bold text-brand-700">3 formats</span>
        </div>
        <div className="mt-4 rounded-lg border border-dashed border-brand-300 bg-brand-50 p-6 text-center">
            <UploadIcon className="mx-auto text-3xl text-brand-600" />
            <p className="mt-3 text-base font-extrabold">lecture-note.pdf</p>
            <p className="mt-1 text-sm text-ink-500">PDF, 이미지, 텍스트를 같은 흐름으로 분석합니다.</p>
        </div>
        <div className="mt-4 grid gap-2 sm:grid-cols-3">
            {['PDF', 'Image', 'Text'].map(format => (
                <div key={format} className="rounded-lg bg-ink-150 px-3 py-2 text-center text-sm font-bold text-ink-700">{format}</div>
            ))}
        </div>
    </div>
);

const AnalyzeStagePreview: React.FC = () => (
    <div>
        <div className="flex items-center gap-2">
            <AutoAwesomeIcon className="text-xl text-brand-600" />
            <p className="text-sm font-extrabold">AI analysis</p>
        </div>
        <div className="mt-4 space-y-3">
            {[
                { label: '핵심 개념 추출', value: '9 concepts', width: 'w-5/6' },
                { label: '요약 초안 생성', value: '4 sections', width: 'w-4/6' },
                { label: '예상 질문 준비', value: '12 items', width: 'w-3/5' },
            ].map(item => (
                <div key={item.label} className="rounded-lg border border-ink-200 p-3">
                    <div className="flex items-center justify-between gap-3 text-sm">
                        <span className="font-bold text-ink-800">{item.label}</span>
                        <span className="font-bold text-brand-700">{item.value}</span>
                    </div>
                    <div className="mt-3 h-2 overflow-hidden rounded-full bg-ink-150">
                        <div className={`${item.width} h-full rounded-full bg-brand-500`} />
                    </div>
                </div>
            ))}
        </div>
    </div>
);

const ReviewStagePreview: React.FC = () => (
    <div>
        <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-extrabold">Review loop</p>
            <span className="rounded-full bg-success-50 px-2.5 py-1 text-xs font-bold text-success-700">Ready</span>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {[
                { icon: AssignmentIcon, label: 'Quiz', value: '정답률 78%' },
                { icon: StyleIcon, label: 'Cards', value: '다시 볼 카드 8개' },
                { icon: AccountTreeIcon, label: 'Mind Map', value: '개념 관계 14개' },
                { icon: HeadphonesIcon, label: 'Podcast', value: '9분 요약 오디오' },
            ].map(item => {
                const Icon = item.icon;
                return (
                    <div key={item.label} className="rounded-lg border border-ink-200 bg-white p-3">
                        <Icon className="text-xl text-brand-600" />
                        <p className="mt-2 text-sm font-extrabold text-ink-950">{item.label}</p>
                        <p className="mt-1 text-xs leading-5 text-ink-500">{item.value}</p>
                    </div>
                );
            })}
        </div>
    </div>
);

const FeaturePreview: React.FC<{ story: FeatureStory; index: number }> = ({ story, index }) => {
    const Icon = story.icon;

    return (
        <div className="overflow-hidden rounded-lg border border-ink-200 bg-white shadow-sheet">
            <div className="bg-gradient-to-br from-white to-ink-150 p-5">
                <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                        <div className={['flex h-11 w-11 items-center justify-center rounded-lg border', accentClasses[story.accent]].join(' ')}>
                            <Icon className="text-xl" />
                        </div>
                        <div>
                            <p className="text-sm font-extrabold text-ink-950">{story.label}</p>
                            <p className="text-xs font-bold text-ink-500">{story.metric}</p>
                        </div>
                    </div>
                    <span className="rounded-full bg-ink-950 px-3 py-1 text-xs font-bold text-white">Live preview</span>
                </div>

                <div className="mt-6 rounded-lg border border-ink-200 bg-white p-5">
                    {index === 0 && <OverviewVisual />}
                    {index === 1 && <QuizVisual />}
                    {index === 2 && <MemoryVisual />}
                    {index === 3 && <PodcastVisual />}
                </div>
            </div>
            <div className="border-t border-ink-200 bg-white px-5 py-4">
                <p className="text-lg font-extrabold leading-snug text-ink-950">{story.title}</p>
                <p className="mt-2 text-sm leading-7 text-ink-600">{story.body}</p>
            </div>
        </div>
    );
};

const OverviewVisual: React.FC = () => (
    <div>
        <div className="flex items-center justify-between">
            <p className="text-sm font-extrabold text-ink-950">오늘의 읽기 순서</p>
            <BarChartIcon className="text-xl text-brand-600" />
        </div>
        <div className="mt-4 space-y-3">
            {[
                { title: '핵심 주장', desc: '저자는 기억을 인출 과정으로 설명합니다.' },
                { title: '중요 개념', desc: '반복, 맥락, 피드백이 서로 연결됩니다.' },
                { title: '먼저 볼 페이지', desc: 'p.12부터 p.18까지 집중 구간입니다.' },
            ].map((item, index) => (
                <div key={item.title} className="flex gap-3 rounded-lg bg-ink-50 p-3">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-brand-100 text-xs font-extrabold text-brand-700">{index + 1}</span>
                    <div>
                        <p className="text-sm font-extrabold text-ink-950">{item.title}</p>
                        <p className="mt-1 text-xs leading-5 text-ink-500">{item.desc}</p>
                    </div>
                </div>
            ))}
        </div>
    </div>
);

const QuizVisual: React.FC = () => (
    <div>
        <div className="rounded-lg border border-ink-200 p-4">
            <p className="text-xs font-bold text-info-700">Question 04</p>
            <p className="mt-2 text-base font-extrabold leading-snug text-ink-950">
                세포 호흡에서 전자전달계가 중요한 이유는?
            </p>
            <div className="mt-4 space-y-2">
                {['ATP 생산량이 가장 크기 때문', 'DNA 복제가 시작되기 때문', '포도당이 저장되기 때문'].map((answer, index) => (
                    <div
                        key={answer}
                        className={index === 0 ? 'rounded-lg border border-success-500 bg-success-50 px-3 py-2 text-sm font-bold text-success-700' : 'rounded-lg border border-ink-200 px-3 py-2 text-sm text-ink-600'}
                    >
                        {answer}
                    </div>
                ))}
            </div>
        </div>
        <div className="mt-3 rounded-lg bg-info-50 p-3 text-sm font-bold text-info-700">
            근거 문단으로 돌아가 오답 이유까지 확인합니다.
        </div>
    </div>
);

const MemoryVisual: React.FC = () => (
    <div className="grid gap-4 sm:grid-cols-[0.8fr_1.2fr]">
        <div className="rounded-lg border border-ink-200 p-4">
            <p className="text-xs font-bold text-success-700">Flashcard</p>
            <p className="mt-3 text-lg font-extrabold leading-snug text-ink-950">간격 반복이 효과적인 이유는?</p>
            <p className="mt-4 text-sm leading-6 text-ink-500">답을 떠올리는 시점이 길어질수록 기억 흔적이 강화됩니다.</p>
        </div>
        <div className="rounded-lg bg-ink-50 p-4">
            <p className="text-sm font-extrabold text-ink-950">Mind Map</p>
            <div className="mt-4 space-y-3">
                {['기억', '인출 연습', '피드백', '장기 보존'].map((node, index) => (
                    <div key={node} className="flex items-center gap-3">
                        <span className={index === 0 ? 'h-3 w-3 rounded-full bg-brand-500' : 'h-3 w-3 rounded-full bg-success-500'} />
                        <div className="h-px flex-1 bg-ink-250" />
                        <span className="rounded-lg bg-white px-3 py-2 text-xs font-bold text-ink-700 shadow-card">{node}</span>
                    </div>
                ))}
            </div>
        </div>
    </div>
);

const PodcastVisual: React.FC = () => (
    <div className="rounded-lg bg-ink-950 p-5 text-white">
        <div className="flex items-center justify-between gap-3">
            <div>
                <p className="text-sm font-extrabold">오늘의 오디오 복습</p>
                <p className="mt-1 text-xs text-white/60">핵심 개념 5개를 9분 안에</p>
            </div>
            <button type="button" className="flex h-11 w-11 items-center justify-center rounded-lg bg-brand-500 transition-transform duration-200 active:scale-[0.96]" aria-label="오디오 재생">
                <PlayArrowIcon className="text-xl text-white" />
            </button>
        </div>
        <div className="mt-6 grid grid-cols-12 items-end gap-1">
            {[34, 52, 44, 72, 58, 86, 64, 92, 50, 74, 46, 62].map((height, index) => (
                <div
                    key={`${height}-${index}`}
                    className="rounded-full bg-brand-300"
                    style={{ height }}
                />
            ))}
        </div>
        <div className="mt-5 flex items-center justify-between text-xs font-bold text-white/60">
            <span>00:42</span>
            <span>09:12</span>
        </div>
    </div>
);

const ToolPreviewCard: React.FC<{ tool: ToolCard }> = ({ tool }) => {
    const Icon = tool.icon;

    return (
        <article className="group overflow-hidden rounded-lg border border-white/10 bg-white/[0.06] shadow-card transition-[transform,border-color,background-color] duration-200 hover:border-brand-300/60 hover:bg-white/[0.09]">
            <div className="border-b border-white/10 bg-white/[0.04] p-4">
                <div className="flex items-center justify-between gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-white text-brand-700">
                        <Icon className="text-xl" />
                    </div>
                    <span className="rounded-full bg-white/10 px-2.5 py-1 text-xs font-bold text-white/70">{tool.label}</span>
                </div>
                <div className="mt-5 space-y-2">
                    <div className="h-2 w-4/5 rounded-full bg-white/18" />
                    <div className="h-2 w-3/5 rounded-full bg-white/12" />
                    <div className="h-2 w-2/5 rounded-full bg-brand-300/70" />
                </div>
            </div>
            <div className="p-5">
                <h3 className="text-xl font-extrabold leading-snug text-white">{tool.title}</h3>
                <p className="mt-3 text-sm leading-7 text-white/68">{tool.outcome}</p>
                <div className="mt-5 flex flex-wrap gap-2">
                    {tool.tags.map(tag => (
                        <span key={tag} className="rounded-full border border-white/10 px-2.5 py-1 text-xs font-bold text-white/70">{tag}</span>
                    ))}
                </div>
            </div>
        </article>
    );
};
