import React from 'react';
import { MenuIcon, StyleIcon } from '../components/icons';

interface FlashcardsPageProps {
    onMenuClick: () => void;
}

export const FlashcardsPage: React.FC<FlashcardsPageProps> = ({ onMenuClick }) => {
    return (
        <div className="flex flex-col h-full bg-white">
            <div className="flex-shrink-0 border-b border-slate-200 bg-white">
                <div className="p-3 h-14 flex items-center gap-3">
                    <button onClick={onMenuClick} className="p-2 text-slate-600 rounded-lg hover:bg-slate-100 md:hidden" aria-label="Open menu">
                        <MenuIcon className="text-2xl" />
                    </button>
                    <h1 className="text-lg font-bold text-slate-800">Flashcards</h1>
                </div>
            </div>

            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center gap-4">
                <div className="w-20 h-20 bg-purple-50 rounded-full flex items-center justify-center">
                    <StyleIcon className="text-4xl text-purple-400" />
                </div>
                <div>
                    <h2 className="text-xl font-bold text-slate-700">플래시카드</h2>
                    <p className="text-slate-500 mt-2 max-w-sm">
                        교재와 오답노트를 기반으로 플래시카드를 자동 생성합니다.
                        Anki 방식의 스페이싱 반복 알고리즘으로 효율적으로 암기하세요.
                    </p>
                </div>
                <span className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-sm font-semibold">Coming Soon — Phase 3</span>
            </div>
        </div>
    );
};
