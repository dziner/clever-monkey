import { describe, it, expect } from 'vitest';
import { CONTENT_LANGUAGE_OPTIONS } from '../../services/languageService';
import { t, type UiKey } from '../../services/uiStrings';

// All supported user-selectable languages (excluding 'auto', which is a
// resolver hint, not a content language). Every UI string must cover
// every entry here or a user with that preference will see English.
const SUPPORTED_LANGS = CONTENT_LANGUAGE_OPTIONS
    .map(o => o.code)
    .filter(c => c !== 'auto');

// Keep in sync with the UiKey union in services/uiStrings.ts. Listing
// the keys explicitly (instead of crawling the union via types) means
// adding a new key without translations fails this test, which is the
// whole point of the suite.
const ALL_KEYS: UiKey[] = [
    'chat.welcome',
    'chat.errorReply',
    'chat.quizSuggestionFallback',
    'chat.scopeChange.document',
    'chat.scopeChange.general',
    'chat.monkeyMode.on',
    'chat.monkeyMode.off',
    'chat.retry',
    'studyTips.error',
    'frq.gradeError',
    'podcast.documentMissing',
    'podcast.newScript',
    'podcast.generateScript',
    'podcast.generating',
    'podcast.cancel',
    'quiz.docMissing',
    'file.unsupportedType',
    'common.cancel',
    'common.close',
    'common.back',
    'common.confirm',
    'common.delete',
    'workspace.empty.title',
    'workspace.empty.subtitle',
    'workspace.empty.uploadHint',
    'workspace.selectDoc.title',
    'workspace.selectDoc.subtitle',
    'signout.title',
    'signout.body',
    'signout.confirm',
    'quiz.exitWarn',
    'quiz.celebrate.perfect',
    'quiz.celebrate.great',
    'quiz.celebrate.good',
    'account.delete.label',
    'account.delete.title',
    'account.delete.body',
    'account.delete.requestSent',
    'notFound.title',
    'notFound.subtitle',
    'notFound.cta',
    'legal.privacy',
    'legal.terms',
];

describe('uiStrings — translation completeness', () => {
    for (const lang of SUPPORTED_LANGS) {
        it(`returns a non-English string for every key in '${lang}'`, () => {
            for (const key of ALL_KEYS) {
                const localized = t(key, lang);
                const english = t(key, 'en');
                expect(localized, `missing translation for ${key} in ${lang}`).toBeTruthy();
                if (lang !== 'en') {
                    expect(
                        localized,
                        `'${key}' falls back to English for language '${lang}' — add a translation`,
                    ).not.toBe(english);
                }
            }
        });
    }
});

describe('uiStrings — fallback behavior', () => {
    it('returns English for an unknown language code', () => {
        expect(t('chat.welcome', 'xx-not-real')).toBe(t('chat.welcome', 'en'));
    });

    it('returns English for null / undefined / "auto" in a test env without a browser', () => {
        // In jsdom navigator.language defaults to en-US, so auto/null/undefined
        // resolve to 'en'. The point is that the lookup never throws and a
        // string always comes back.
        expect(typeof t('chat.welcome', null)).toBe('string');
        expect(typeof t('chat.welcome', undefined)).toBe('string');
        expect(typeof t('chat.welcome', 'auto')).toBe('string');
        expect(t('chat.welcome', null).length).toBeGreaterThan(0);
    });
});
