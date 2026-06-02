import * as React from 'react';
import { LockIcon, AutoAwesomeIcon } from './icons';
import { Button } from './ui/Button';

interface LoginRequiredProps {
    /** Localized label of the feature the user is trying to use. */
    feature: string;
    /** Short explanation of what unlocks after sign-in. */
    perks?: string[];
    onSignInClick?: () => void;
}

/**
 * Inline gate shown inside a tab when the active feature isn't
 * available to guests. Friendly tone, clear CTA — never blocks the
 * whole app, just the current panel.
 */
export const LoginRequired: React.FC<LoginRequiredProps> = ({
    feature,
    perks = [
        '저장한 문서·진척을 기기 간 동기화',
        '퀴즈·플래시카드·마인드맵·팟캐스트 사용',
        '오답 노트 자동 정리',
    ],
    onSignInClick,
}) => (
    <div className="flex-1 flex flex-col items-center justify-center bg-white p-6 sm:p-10 text-center">
        <div className="w-14 h-14 rounded-2xl bg-brand-100 flex items-center justify-center mb-5">
            <LockIcon className="text-2xl text-brand-700" />
        </div>
        <h3 className="text-h1 text-ink-900">
            {feature} — 로그인하면 열려요
        </h3>
        <p className="mt-2 text-body text-ink-500 max-w-sm">
            게스트 모드에서는 채팅만 사용할 수 있어요.
            로그인하면 더 많은 학습 도구가 풀립니다.
        </p>

        <ul className="mt-6 space-y-2 text-left max-w-sm w-full">
            {perks.map(p => (
                <li key={p} className="flex items-start gap-2.5 text-body-sm text-ink-700">
                    <AutoAwesomeIcon className="text-base text-brand-500 mt-0.5 flex-shrink-0" />
                    <span>{p}</span>
                </li>
            ))}
        </ul>

        {onSignInClick && (
            <div className="mt-7 w-full max-w-xs">
                <Button variant="primary" size="lg" fullWidth onClick={onSignInClick}>
                    로그인 / 가입하기
                </Button>
                <p className="mt-3 text-caption text-ink-400">
                    이메일 또는 Google 계정 · 30초면 됩니다.
                </p>
            </div>
        )}
    </div>
);
