import * as React from 'react';
import { WarningIcon } from './icons';

interface InactiveAccountScreenProps {
    email: string | null;
    restoreUntil?: string | null;
    onSignOut: () => void;
}

export const InactiveAccountScreen: React.FC<InactiveAccountScreenProps> = ({
    email,
    restoreUntil,
    onSignOut,
}) => {
    const restoreDate = restoreUntil ? new Date(restoreUntil).toLocaleDateString('ko-KR') : null;
    return (
        <div className="min-h-dvh bg-ink-50 flex items-center justify-center p-5">
            <div className="w-full max-w-md bg-white border border-warning-100 rounded-2xl shadow-sheet p-6 text-center">
                <div className="mx-auto w-14 h-14 rounded-full bg-warning-50 flex items-center justify-center">
                    <WarningIcon className="text-3xl text-warning-600" />
                </div>
                <h1 className="mt-5 text-xl font-bold text-ink-900">계정이 비활성화되었습니다</h1>
                <p className="mt-2 text-sm leading-relaxed text-ink-500">
                    이 계정은 관리자에 의해 삭제 대기 상태로 전환되었습니다.
                    {restoreDate ? ` ${restoreDate}까지 관리자 화면에서 복구할 수 있습니다.` : ' 관리자에게 복구를 요청하세요.'}
                </p>
                {email && <p className="mt-4 text-xs font-mono text-ink-400 break-all">{email}</p>}
                <button
                    type="button"
                    onClick={onSignOut}
                    className="mt-6 h-11 w-full rounded-lg bg-ink-900 text-white text-sm font-bold hover:bg-ink-800 transition-colors"
                >
                    로그아웃
                </button>
            </div>
        </div>
    );
};
