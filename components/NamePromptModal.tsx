import * as React from 'react';
import { CleverMonkeyIcon } from './icons';
import { supabase } from '../services/supabaseClient';
import { updateMyDisplayName } from '../services/profileService';

interface NamePromptModalProps {
    isOpen: boolean;
    onSaved: () => void;
}

export const NamePromptModal: React.FC<NamePromptModalProps> = ({ isOpen, onSaved }) => {
    const [name, setName] = React.useState('');
    const [isSubmitting, setIsSubmitting] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);
    const [hasPrefilled, setHasPrefilled] = React.useState(false);

    React.useEffect(() => {
        if (!isOpen || hasPrefilled) return;
        // Pre-fill with auth provider's suggested name (e.g. Google full_name)
        supabase.auth.getUser().then(({ data: { user } }) => {
            const meta = user?.user_metadata as { full_name?: string; name?: string; display_name?: string } | undefined;
            const suggested = meta?.display_name?.trim() || meta?.full_name?.trim() || meta?.name?.trim() || '';
            if (suggested) setName(suggested);
            setHasPrefilled(true);
        });
    }, [isOpen, hasPrefilled]);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setIsSubmitting(true);
        const ok = await updateMyDisplayName(name);
        setIsSubmitting(false);
        if (!ok) {
            setError('이름을 저장하지 못했습니다. 다시 시도해 주세요.');
            return;
        }
        onSaved();
    };

    return (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" aria-hidden="true" />
            <div
                className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl ring-1 ring-slate-900/5 overflow-hidden animate-fade-in-up"
                role="dialog"
                aria-modal="true"
            >
                <div className="px-8 pt-8 pb-6 text-center">
                    <div className="mx-auto w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center mb-4">
                        <CleverMonkeyIcon className="w-7 h-7 text-blue-600" />
                    </div>
                    <h2 className="text-2xl font-bold text-slate-900 font-outfit">반갑습니다 👋</h2>
                    <p className="mt-2 text-sm text-slate-500">
                        프로필에 표시할 이름을 알려주세요. 나중에 언제든지 수정할 수 있습니다.
                    </p>
                </div>
                <form className="px-8 pb-8" onSubmit={handleSubmit}>
                    <label className="block text-xs font-semibold text-slate-500 mb-1.5 ml-1">이름</label>
                    <input
                        type="text"
                        placeholder="예: 김민준"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                        required
                        autoFocus
                        minLength={1}
                        maxLength={60}
                    />
                    {error && (
                        <p className="mt-3 text-xs text-red-600 bg-red-50 border border-red-100 px-3 py-2 rounded-lg">{error}</p>
                    )}
                    <button
                        type="submit"
                        disabled={isSubmitting || !name.trim()}
                        className="mt-5 w-full bg-slate-900 text-white font-bold py-3 rounded-xl shadow-lg shadow-slate-900/20 hover:bg-slate-800 transition-colors disabled:opacity-60"
                    >
                        {isSubmitting ? '저장 중...' : '시작하기'}
                    </button>
                </form>
            </div>
        </div>
    );
};
