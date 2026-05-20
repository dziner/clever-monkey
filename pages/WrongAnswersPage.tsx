import React from 'react';
import { MenuIcon, ErrorOutlineIcon } from '../components/icons';

interface WrongAnswersPageProps {
    onMenuClick: () => void;
}

export const WrongAnswersPage: React.FC<WrongAnswersPageProps> = ({ onMenuClick }) => {
    return (
        <div className="flex flex-col h-full bg-white">
            <div className="flex-shrink-0 border-b border-slate-200 bg-white">
                <div className="p-3 h-14 flex items-center gap-3">
                    <button onClick={onMenuClick} className="p-2 text-slate-600 rounded-lg hover:bg-slate-100 md:hidden" aria-label="Open menu">
                        <MenuIcon className="text-2xl" />
                    </button>
                    <h1 className="text-lg font-bold text-slate-800">Wrong Answers</h1>
                </div>
            </div>

            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center gap-4">
                <div className="w-20 h-20 bg-orange-50 rounded-full flex items-center justify-center">
                    <ErrorOutlineIcon className="text-4xl text-orange-400" />
                </div>
                <div>
                    <h2 className="text-xl font-bold text-slate-700">오답노트</h2>
                    <p className="text-slate-500 mt-2 max-w-sm">
                        퀴즈에서 틀린 문제들이 자동으로 여기에 저장됩니다.
                        틀린 문제만 모아서 복습하고, 팟캐스트나 플래시카드로 만들어 보세요.
                    </p>
                </div>
                <span className="px-3 py-1 bg-orange-100 text-orange-700 rounded-full text-sm font-semibold">Coming Soon — Phase 2</span>
            </div>
        </div>
    );
};
