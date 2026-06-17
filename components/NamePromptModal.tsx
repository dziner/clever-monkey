import * as React from 'react';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
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
        supabase.auth.getUser().then(({ data: { user } }) => {
            const meta = user?.user_metadata as { full_name?: string; name?: string; display_name?: string } | undefined;
            const suggested = meta?.display_name?.trim() || meta?.full_name?.trim() || meta?.name?.trim() || '';
            if (suggested) setName(suggested);
            setHasPrefilled(true);
        });
    }, [isOpen, hasPrefilled]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setIsSubmitting(true);
        const ok = await updateMyDisplayName(name);
        setIsSubmitting(false);
        if (!ok) { setError('이름을 저장하지 못했습니다. 다시 시도해 주세요.'); return; }
        onSaved();
    };

    return (
        <Modal isOpen={isOpen} onClose={() => { /* mandatory */ }} dismissible={false} size="sm" zIndex={110}>
            <div className="mx-auto w-full max-w-[18rem] pb-1 text-center sm:max-w-xs sm:pb-2">
                <div className="mx-auto mb-2.5 h-14 w-14 sm:mb-3 sm:h-16 sm:w-16">
                    <CleverMonkeyIcon className="w-full h-full text-brand-500" />
                </div>
                <h2 className="text-xl font-bold leading-snug tracking-tight text-ink-900 sm:text-22">반갑습니다</h2>
                <p className="mt-1.5 text-sm leading-relaxed text-ink-500 sm:text-base">
                    프로필에 표시할 이름을 알려주세요. 언제든지 프로필에서 수정할 수 있습니다.
                </p>
            </div>

            <form className="mt-4 space-y-3 sm:mt-5" onSubmit={handleSubmit}>
                <Input
                    label="이름"
                    type="text"
                    placeholder="예: 김민준"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    autoFocus
                    minLength={1}
                    maxLength={60}
                    error={error}
                />
                <Button type="submit" variant="primary" size="md" fullWidth loading={isSubmitting} disabled={!name.trim()}>
                    시작하기
                </Button>
            </form>
        </Modal>
    );
};
