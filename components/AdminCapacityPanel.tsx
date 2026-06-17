import * as React from 'react';
import type { ApiCategoryStats, ApiCategoryUsage, KeyMeta } from '../services/adminService';

// Per-feature capacity dashboard. Aggregates per-category usage rows
// returned by admin_get_api_category_stats() into one card per feature
// surface (chat / podcast TTS / OCR / quiz etc.) so the operator can see
// at a glance where today's load is going and decide whether to (a) buy
// a paid Gemini key, (b) add another rotating free key, or (c) shift
// that feature line to Groq / Cerebras.
//
// Free-tier daily-RPD caps are public knowledge; we hard-code the
// per-model limits here. The bar fills against the sum of per-model
// caps for keys that have been seen in the rolling 7-day window.

interface ModelInfo {
    /** Free-tier requests-per-day for ONE key on this model. */
    rpd: number;
    /** Vendor whose key this model bills against. Drives the colored
     *  badge in the per-model breakdown so Gemini vs Groq vs Cerebras is
     *  visually distinct at a glance (matches the routing chain in
     *  netlify/functions/lib/router.ts). */
    provider: ProviderName;
    /** Model family — what the operator usually thinks of as "the model"
     *  (Gemini 2.5, Llama 3.3, Qwen3, …). Version explicit so the
     *  dashboard answers "Gemini 2.5 or 2.0?" without ambiguity. */
    family: string;
    /** Specific variant within the family (Flash Lite, 70B, TTS preview, …). */
    variant: string;
}

type ProviderName = 'gemini' | 'groq' | 'cerebras' | 'unknown';

const PROVIDER_STYLE: Record<ProviderName, { badge: string; label: string }> = {
    gemini:   { badge: 'bg-blue-50 text-blue-700 border-blue-200',     label: 'Gemini' },
    groq:     { badge: 'bg-orange-50 text-orange-700 border-orange-200', label: 'Groq' },
    cerebras: { badge: 'bg-violet-50 text-violet-700 border-violet-200', label: 'Cerebras' },
    unknown:  { badge: 'bg-ink-100 text-ink-600 border-ink-200',       label: '?' },
};

// Approximate free-tier RPD per single key. Sources: Google AI Studio
// free tier (gemini-*), Groq free tier, Cerebras free tier. Numbers are
// conservative — within ~10% of the published cap so the gauge nudges
// toward action BEFORE the real cap is hit.
const MODEL_QUOTAS: Record<string, ModelInfo> = {
    'gemini-2.5-pro':              { rpd: 50,    provider: 'gemini',   family: 'Gemini 2.5',   variant: 'Pro' },
    'gemini-2.5-flash':            { rpd: 250,   provider: 'gemini',   family: 'Gemini 2.5',   variant: 'Flash' },
    'gemini-2.5-flash-lite':       { rpd: 1000,  provider: 'gemini',   family: 'Gemini 2.5',   variant: 'Flash Lite' },
    'gemini-flash-latest':         { rpd: 250,   provider: 'gemini',   family: 'Gemini',       variant: 'Flash (latest)' },
    'gemini-2.5-flash-preview-tts':{ rpd: 100,   provider: 'gemini',   family: 'Gemini 2.5',   variant: 'Flash TTS (preview)' },
    'llama-3.3-70b-versatile':     { rpd: 1000,  provider: 'groq',     family: 'Llama 3.3',    variant: '70B Versatile' },
    'llama-3.1-8b-instant':        { rpd: 14400, provider: 'groq',     family: 'Llama 3.1',    variant: '8B Instant' },
    'qwen/qwen3-32b':              { rpd: 1000,  provider: 'groq',     family: 'Qwen3',        variant: '32B' },
    'llama-3.3-70b':               { rpd: 1000,  provider: 'cerebras', family: 'Llama 3.3',    variant: '70B' },
};

const FALLBACK_QUOTA: ModelInfo = { rpd: 1000, provider: 'unknown', family: 'Unknown', variant: '' };

const CATEGORY_LABELS: Record<string, { label: string; emoji: string; hint: string }> = {
    chat:              { label: '채팅',         emoji: '💬', hint: '문서 Q&A · 모키 모드' },
    summary:           { label: '요약 (스트림)', emoji: '📝', hint: '문서 업로드 후 자동' },
    presetQuestions:   { label: '추천 질문',     emoji: '❓', hint: '문서당 1회' },
    quiz:              { label: '퀴즈 생성',     emoji: '🎯', hint: '객관식 · 서술형' },
    flashcards:        { label: '플래시카드',    emoji: '🃏', hint: '덱 1개당 1회' },
    mindmap:           { label: '마인드맵',      emoji: '🌳', hint: '문서당 1회' },
    slides:            { label: '슬라이드',      emoji: '🎞️', hint: '문서당 1회' },
    podcast_script:    { label: '팟캐스트 스크립트', emoji: '🎙️', hint: '스트리밍 생성' },
    podcast_tts:       { label: '팟캐스트 음성',  emoji: '🔊', hint: 'preview 모델 · 가장 흔들림' },
    extract_inline:    { label: '소형 OCR',       emoji: '📃', hint: '5MB 미만 즉시' },
    extract_storage:   { label: '대형 PDF OCR',   emoji: '📚', hint: 'Files API · 스트리밍' },
    studyTips:         { label: '학습 팁',        emoji: '💡', hint: '퀴즈 후 1회' },
    evaluate:          { label: 'FRQ 채점',       emoji: '✏️', hint: '답안당 1회' },
    other:             { label: '기타',           emoji: '·',  hint: '미분류' },
};

interface AdminCapacityPanelProps {
    stats: ApiCategoryStats | null;
    keyMeta: KeyMeta | null;
}

interface CategoryAggregate {
    todayCount: number;
    weekCount: number;
    todayRejects: number;   // rate + quota refusals today
    weekRejects: number;
    todayOverload: number;  // 503 overloads today
    models: Map<string, { todayCount: number; weekCount: number }>;
}

function aggregate(rows: ApiCategoryUsage[], target: 'today' | 'week', into: Map<string, CategoryAggregate>) {
    for (const r of rows) {
        const cat = r.apiCategory || 'other';
        let agg = into.get(cat);
        if (!agg) {
            agg = { todayCount: 0, weekCount: 0, todayRejects: 0, weekRejects: 0, todayOverload: 0, models: new Map() };
            into.set(cat, agg);
        }
        let m = agg.models.get(r.model);
        if (!m) { m = { todayCount: 0, weekCount: 0 }; agg.models.set(r.model, m); }
        const rejects = r.rateRejects + r.quotaRejects;
        if (target === 'today') {
            agg.todayCount += r.callCount; m.todayCount += r.callCount;
            agg.todayRejects += rejects; agg.todayOverload += r.overloadCount;
        } else {
            agg.weekCount += r.callCount; m.weekCount += r.callCount;
            agg.weekRejects += rejects;
        }
    }
}

export const AdminCapacityPanel: React.FC<AdminCapacityPanelProps> = ({ stats, keyMeta }) => {
    if (!stats) {
        return (
            <p className="text-sm text-ink-500">
                카테고리별 사용량 데이터를 불러올 수 없습니다. <code>supabase/add_api_category_stats.sql</code>이 실행됐는지 확인하세요.
            </p>
        );
    }

    const byCategory = new Map<string, CategoryAggregate>();
    aggregate(stats.today, 'today', byCategory);
    aggregate(stats.week,  'week',  byCategory);

    if (byCategory.size === 0) {
        return (
            <p className="text-sm text-ink-500">
                아직 카테고리별 사용량이 기록되지 않았습니다. 사용자가 한 번이라도 AI 호출을 하면 여기에 나타납니다.
            </p>
        );
    }

    // Sort by today's volume desc — today's spikes are what the operator
    // most likely cares about; week is shown as context.
    const ordered = Array.from(byCategory.entries())
        .sort((a, b) => b[1].todayCount - a[1].todayCount);

    // Gemini keys multiply the per-key RPD; default to 1 if we couldn't
    // read the count. Groq/Cerebras free keys are single per provider.
    const geminiKeys = keyMeta?.geminiKeyCount ?? 1;

    return (
        <>
            <p className="text-[11px] text-ink-400 mb-2">
                Gemini 키 {geminiKeys}개 회전 중
                {keyMeta?.groqEnabled ? ' · Groq 연결됨' : ''}
                {keyMeta?.cerebrasEnabled ? ' · Cerebras 연결됨' : ''}
                {' '}· 한도는 무료 티어 공개값 × 키 개수 추정. 거부 횟수는 실측입니다.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {ordered.map(([category, agg]) => (
                    <CategoryCard key={category} category={category} agg={agg} geminiKeys={geminiKeys} />
                ))}
            </div>
        </>
    );
};

interface CategoryCardProps {
    category: string;
    agg: CategoryAggregate;
    geminiKeys: number;
}

const CategoryCard: React.FC<CategoryCardProps> = ({ category, agg, geminiKeys }) => {
    const meta = CATEGORY_LABELS[category] ?? { label: category, emoji: '·', hint: '' };

    // Effective daily cap = per-model RPD, multiplied by the number of
    // rotating Gemini keys (each key has its own quota). Non-Gemini
    // models (Groq/Cerebras) are one key per provider, so no multiplier.
    const todayQuota = Array.from(agg.models.keys()).reduce((sum, model) => {
        const info = MODEL_QUOTAS[model] ?? FALLBACK_QUOTA;
        const isGemini = model.startsWith('gemini');
        return sum + info.rpd * (isGemini ? geminiKeys : 1);
    }, 0);
    const pct = todayQuota > 0 ? Math.min(100, (agg.todayCount / todayQuota) * 100) : 0;
    // Three bands matching the existing dashboard idiom.
    const barColor = pct >= 90 ? 'bg-red-500' : pct >= 70 ? 'bg-orange-500' : 'bg-success-500';
    const labelColor = pct >= 90 ? 'text-red-600' : pct >= 70 ? 'text-orange-600' : 'text-ink-500';

    return (
        <div className="bg-white rounded-xl border border-ink-200 p-4 shadow-sm">
            <div className="flex items-start justify-between gap-2 mb-3">
                <div>
                    <p className="text-sm font-bold text-ink-800 flex items-center gap-1.5">
                        <span>{meta.emoji}</span>
                        {meta.label}
                    </p>
                    <p className="text-[11px] text-ink-400 mt-0.5">{meta.hint}</p>
                </div>
                <div className="text-right">
                    <p className="text-2xl font-bold tabular-nums text-ink-900 leading-none">
                        {agg.todayCount}
                    </p>
                    <p className="text-[10px] text-ink-400 mt-0.5">오늘</p>
                </div>
            </div>
            {todayQuota > 0 && (
                <div className="mb-2">
                    <div className="flex justify-between text-[10px] mb-0.5">
                        <span className={`font-semibold ${labelColor}`}>{Math.round(pct)}% 한도 사용</span>
                        <span className="text-ink-400 tabular-nums">{agg.todayCount} / {todayQuota.toLocaleString()}</span>
                    </div>
                    <div className="w-full h-1.5 bg-ink-100 rounded-full overflow-hidden">
                        <div
                            className={`h-1.5 rounded-full transition-all ${barColor}`}
                            style={{ width: `${pct}%` }}
                        />
                    </div>
                </div>
            )}
            <div className="text-[11px] text-ink-500 flex justify-between border-t border-ink-100 pt-2">
                <span>최근 7일</span>
                <span className="tabular-nums font-semibold text-ink-700">{agg.weekCount}회</span>
            </div>
            {/* Real upstream refusals — the ground-truth ceiling signal the
                operator actually asked for. Unlike the quota bar (an estimate),
                these are counts of 429/RESOURCE_EXHAUSTED/503 we genuinely got
                back from the provider, recorded at the key-pool level so a
                refusal that a second rotating key recovered is still visible. */}
            {(agg.todayRejects > 0 || agg.todayOverload > 0 || agg.weekRejects > 0) && (
                <div className="mt-2 pt-2 border-t border-ink-100 space-y-0.5">
                    <div className="flex justify-between text-[10px]">
                        <span className="text-ink-500">오늘 한도 거부 <span className="text-ink-400">(429)</span></span>
                        <span className={`tabular-nums font-semibold ${agg.todayRejects > 0 ? 'text-red-600' : 'text-ink-400'}`}>
                            {agg.todayRejects}회
                        </span>
                    </div>
                    <div className="flex justify-between text-[10px]">
                        <span className="text-ink-500">오늘 과부하 <span className="text-ink-400">(503)</span></span>
                        <span className={`tabular-nums font-semibold ${agg.todayOverload > 0 ? 'text-orange-600' : 'text-ink-400'}`}>
                            {agg.todayOverload}회
                        </span>
                    </div>
                    {agg.weekRejects > 0 && (
                        <div className="flex justify-between text-[10px]">
                            <span className="text-ink-400">최근 7일 거부</span>
                            <span className="tabular-nums text-ink-500">{agg.weekRejects}회</span>
                        </div>
                    )}
                </div>
            )}
            {/* Per-model breakdown — always shown so the operator can see
                exactly which model(s) the feature is calling (e.g. Gemini
                2.5 Flash Lite vs. Groq Qwen3 32B). When only one model has
                served the category that single row is the answer to "what
                is this feature using?"; when multiple, the volume split
                shows how often a fallback actually took over. */}
            {agg.models.size > 0 && (
                <div className="mt-2 pt-2 border-t border-ink-100 space-y-1">
                    <p className="text-[10px] font-bold text-ink-400 uppercase tracking-wider mb-1">사용 모델 (오늘)</p>
                    {Array.from(agg.models.entries())
                        .sort((a, b) => b[1].todayCount - a[1].todayCount)
                        .map(([model, m]) => {
                            const info = MODEL_QUOTAS[model] ?? FALLBACK_QUOTA;
                            const isGemini = info.provider === 'gemini';
                            // Per-row cap also scales with the rotating Gemini
                            // key count, matching the category-level math
                            // above so the row numbers reconcile cleanly.
                            const rowCap = info.rpd * (isGemini ? geminiKeys : 1);
                            const style = PROVIDER_STYLE[info.provider];
                            return (
                                <div key={model} className="flex items-center justify-between gap-2 text-[10px]">
                                    <div className="flex items-center gap-1.5 min-w-0">
                                        <span className={`flex-shrink-0 px-1.5 py-px rounded border text-[9px] font-bold uppercase tracking-wider ${style.badge}`}>
                                            {style.label}
                                        </span>
                                        <span className="font-semibold text-ink-700 truncate" title={model}>
                                            {info.family}
                                        </span>
                                        {info.variant && (
                                            <span className="text-ink-500 truncate">{info.variant}</span>
                                        )}
                                    </div>
                                    <span className="text-ink-400 tabular-nums flex-shrink-0">
                                        {m.todayCount} / {rowCap.toLocaleString()}
                                    </span>
                                </div>
                            );
                        })}
                </div>
            )}
            {/* Action hint. Real refusals outrank the estimated bar: if the
                provider actually said no today, that's a definitive "add a key
                or go paid" signal even when the estimate looks comfortable. */}
            {(agg.todayRejects > 0 || pct >= 70) && (
                <div className="mt-2 pt-2 border-t border-ink-100">
                    <p className={`text-[10px] font-semibold ${agg.todayRejects > 0 || pct >= 90 ? 'text-red-600' : 'text-orange-600'}`}>
                        {agg.todayRejects > 0
                            ? '⚠️ 실제 한도 거부 발생 — 키 추가 또는 유료 전환 권장'
                            : pct >= 90 ? '⚠️ 한도 임박 — 키 추가 또는 폴백 권장' : '↗ 한도 70% 초과 — 모니터링 권장'}
                    </p>
                </div>
            )}
        </div>
    );
};
