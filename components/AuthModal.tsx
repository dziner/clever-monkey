import * as React from 'react';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { CleverMonkeyIcon } from './icons';

interface AuthModalProps {
    isOpen: boolean;
    onClose: () => void;
    onGoogleSignIn: () => void;
    onEmailSignIn: (email: string, password: string) => Promise<string | null>;
    onEmailSignUp: (email: string, password: string, displayName: string) => Promise<string | null>;
}

const GoogleLogo: React.FC<{ className?: string }> = ({ className = '' }) => (
    <svg className={className} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.115-1.315.32-1.92V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
);

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose, onGoogleSignIn, onEmailSignIn, onEmailSignUp }) => {
    const [mode, setMode] = React.useState<'login' | 'signup'>('login');
    const [name, setName] = React.useState('');
    const [email, setEmail] = React.useState('');
    const [password, setPassword] = React.useState('');
    const [error, setError] = React.useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = React.useState(false);

    const reset = () => { setName(''); setEmail(''); setPassword(''); setError(null); };

    const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setError(null);
        setIsSubmitting(true);
        const responseError = mode === 'login'
            ? await onEmailSignIn(email, password)
            : await onEmailSignUp(email, password, name);
        setIsSubmitting(false);
        if (responseError) setError(responseError);
        else { onClose(); reset(); }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} size="md" zIndex={100}>
            <div className="-mx-7 -mt-3 px-7 pb-2 text-center">
                <div className="mx-auto w-20 h-20 mb-4">
                    <CleverMonkeyIcon className="w-full h-full text-brand-500" />
                </div>
                <h2 className="text-display-lg">
                    {mode === 'login' ? '다시 오신 것을 환영합니다' : '계정 만들기'}
                </h2>
                <p className="mt-1.5 text-body text-ink-500">
                    {mode === 'login' ? '학습을 이어서 시작해 보세요.' : 'Clever Monkey와 함께 학습을 시작합니다.'}
                </p>
            </div>

            <div className="mt-4">
                <Button
                    type="button"
                    variant="raised-ghost"
                    size="lg"
                    fullWidth
                    onClick={onGoogleSignIn}
                    leftIcon={<GoogleLogo className="w-5 h-5" />}
                >
                    Google로 계속하기
                </Button>

                <div className="relative my-5">
                    <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-ink-200" /></div>
                    <div className="relative flex justify-center text-[10px] uppercase tracking-[0.16em]">
                        <span className="bg-white px-3 text-ink-400 font-bold">or with email</span>
                    </div>
                </div>

                <form className="space-y-3" onSubmit={handleSubmit}>
                    {mode === 'signup' && (
                        <Input
                            label="이름"
                            type="text"
                            placeholder="예: 김민준"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            required
                            minLength={1}
                            maxLength={60}
                        />
                    )}
                    <Input
                        label="이메일"
                        type="email"
                        placeholder="name@example.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                    />
                    <Input
                        label="비밀번호"
                        type="password"
                        placeholder="••••••••"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        minLength={6}
                        error={error}
                    />
                    <Button type="submit" variant="raised" size="lg" fullWidth loading={isSubmitting}>
                        {mode === 'login' ? '로그인' : '계정 만들기'}
                    </Button>
                </form>

                <p className="mt-5 text-center text-sm text-ink-500">
                    {mode === 'login' ? '아직 계정이 없으신가요?' : '이미 계정이 있으신가요?'}{' '}
                    <button
                        type="button"
                        onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError(null); }}
                        className="font-bold text-brand-600 hover:text-brand-700"
                    >
                        {mode === 'login' ? '가입하기' : '로그인하기'}
                    </button>
                </p>
            </div>
        </Modal>
    );
};
