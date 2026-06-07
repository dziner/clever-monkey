// Content language preference: controls the language of AI-generated
// material (quizzes, mind maps, flashcards, slides, podcasts, chat).
//
// Default is `'auto'`, which follows the browser/OS language at
// generation time. Users can override via Profile.

export interface ContentLanguageOption {
    code: string;
    label: string;
}

export const CONTENT_LANGUAGE_OPTIONS: readonly ContentLanguageOption[] = [
    { code: 'auto', label: '자동 (브라우저 설정)' },
    { code: 'ko',   label: '한국어' },
    { code: 'en',   label: 'English' },
    { code: 'ja',   label: '日本語' },
    { code: 'zh',   label: '中文 (简体)' },
    { code: 'es',   label: 'Español' },
    { code: 'fr',   label: 'Français' },
    { code: 'de',   label: 'Deutsch' },
    { code: 'pt',   label: 'Português' },
    { code: 'ru',   label: 'Русский' },
    { code: 'vi',   label: 'Tiếng Việt' },
    { code: 'id',   label: 'Bahasa Indonesia' },
] as const;

const LANGUAGE_NAMES: Record<string, string> = {
    ko: 'Korean',
    en: 'English',
    ja: 'Japanese',
    zh: 'Chinese (Simplified)',
    es: 'Spanish',
    fr: 'French',
    de: 'German',
    pt: 'Portuguese',
    ru: 'Russian',
    vi: 'Vietnamese',
    id: 'Indonesian',
};

const FALLBACK_CODE = 'en';

export function detectBrowserLanguage(): string {
    if (typeof navigator === 'undefined') return FALLBACK_CODE;
    const raw = navigator.language || (navigator.languages && navigator.languages[0]) || FALLBACK_CODE;
    const code = raw.toLowerCase().split('-')[0];
    return LANGUAGE_NAMES[code] ? code : FALLBACK_CODE;
}

/**
 * Resolve the effective 2-letter language code given the user's stored
 * preference. `null`, `undefined`, `'auto'`, or an unsupported code all
 * fall back to the browser language.
 */
export function resolveContentLanguage(profileLang?: string | null): string {
    if (profileLang && profileLang !== 'auto' && LANGUAGE_NAMES[profileLang]) {
        return profileLang;
    }
    return detectBrowserLanguage();
}

/** English language name suitable for embedding in an LLM prompt. */
export function languageDisplayNameForPrompt(profileLang?: string | null): string {
    const code = resolveContentLanguage(profileLang);
    return LANGUAGE_NAMES[code] || 'English';
}

/**
 * A prompt directive instructing the model to produce all output in the
 * effective language. Intended to be appended to generation prompts.
 */
export function languageDirective(profileLang?: string | null): string {
    const name = languageDisplayNameForPrompt(profileLang);
    return `LANGUAGE: ALL generated text — titles, questions, answers, options, explanations, labels, summaries, narration, feedback — MUST be written in ${name}, even when the source document is in a different language. Translate concepts naturally into ${name}. Keep proper nouns, code, formulas, and untranslatable technical terms in their original form.`;
}

const ALL_CORRECT_MESSAGES: Record<string, string> = {
    ko: '### 🎯 전부 정답!\n\n훌륭해요! 자료를 확실히 이해하고 있다는 것을 보여줬어요. 이번 퀴즈에서는 따로 복습이 필요하지 않습니다.',
    en: '### 🎯 All Correct!\n\nExcellent work! You\'ve demonstrated a strong understanding of the material. No review needed for this quiz.',
    ja: '### 🎯 全問正解！\n\n素晴らしいです！教材をしっかり理解できていることが分かります。今回のクイズで復習は不要です。',
    zh: '### 🎯 全部答对！\n\n做得很好！你对内容已经掌握得很扎实，本次测验无需复习。',
    es: '### 🎯 ¡Todo correcto!\n\n¡Excelente trabajo! Has demostrado un sólido dominio del material. No se necesita repaso para este cuestionario.',
    fr: '### 🎯 Tout est correct !\n\nExcellent travail ! Tu maîtrises parfaitement le contenu. Aucune révision n\'est nécessaire pour ce quiz.',
    de: '### 🎯 Alles richtig!\n\nHervorragend! Du beherrschst den Stoff sicher. Für dieses Quiz ist keine Wiederholung nötig.',
    pt: '### 🎯 Tudo correto!\n\nÓtimo trabalho! Você demonstrou domínio sólido do conteúdo. Nenhuma revisão é necessária neste quiz.',
    ru: '### 🎯 Все верно!\n\nОтлично! Вы хорошо усвоили материал. Этот тест не требует повторения.',
    vi: '### 🎯 Toàn bộ đều đúng!\n\nXuất sắc! Bạn đã nắm rất vững nội dung. Lần kiểm tra này không cần ôn lại.',
    id: '### 🎯 Semua benar!\n\nKerja bagus! Kamu sudah menguasai materinya. Tidak perlu mengulang kuis ini.',
};

export function allCorrectMessage(profileLang?: string | null): string {
    const code = resolveContentLanguage(profileLang);
    return ALL_CORRECT_MESSAGES[code] || ALL_CORRECT_MESSAGES.en;
}
