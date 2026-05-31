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
        <Modal isOpen={isOpen} onClose={() => { /* mandatory */ }} dismissible={false} size="md" zIndex={110}>
            <div className="-mx-7 -mt-3 px-7 pb-2 text-center">
                <div className="mx-auto w-20 h-20 mb-4">
                    <CleverMonkeyIcon className="w-full h-full text-brand-500" />
                </div>
                <h2 className="font-handwritten font-bold text-4xl text-ink-900 -rotate-1 inline-block">
                    이름이 뭐야?
                </h2>
                <p className="mt-2 text-body text-ink-500">
                    원숭이가 외워둘게. 헷갈리면 안 되니까.
                    <br />
                    나중에 프로필에서 바꿔도 돼.
                </p>
            </div>

            <form className="mt-4 space-y-3" onSubmit={handleSubmit}>
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
                <Button type="submit" variant="raised" size="lg" fullWidth loading={isSubmitting} disabled={!name.trim()}>
                    시작하기
                </Button>
            </form>
        </Modal>
    );
};
