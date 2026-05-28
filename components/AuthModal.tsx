import React from 'react';
import { XIcon } from './icons';

interface AuthModalProps {
    isOpen: boolean;
    onClose: () => void;
    onGoogleSignIn: () => void;
    onEmailSignIn: (email: string, password: string) => Promise<string | null>;
    onEmailSignUp: (email: string, password: string, displayName: string) => Promise<string | null>;
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose, onGoogleSignIn, onEmailSignIn, onEmailSignUp }) => {
    const [mode, setMode] = React.useState<'login' | 'signup'>('login');
    const [name, setName] = React.useState('');
    const [email, setEmail] = React.useState('');
    const [password, setPassword] = React.useState('');
    const [error, setError] = React.useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = React.useState(false);

    if (!isOpen) return null;

    const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setError(null);
        setIsSubmitting(true);

        const responseError = mode === 'login'
            ? await onEmailSignIn(email, password)
            : await onEmailSignUp(email, password, name);

        if (responseError) {
            setError(responseError);
        } else {
            onClose();
            setName('');
            setEmail('');
            setPassword('');
        }

        setIsSubmitting(false);
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div 
                className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity" 
                onClick={onClose}
                aria-hidden="true"
            />
            
            <div 
                className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl ring-1 ring-slate-900/5 overflow-hidden animate-fade-in-up"
                role="dialog"
                aria-modal="true"
            >
                <div className="relative px-8 pt-8 pb-6 text-center">
                    <button 
                        onClick={onClose}
                        className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
                        aria-label="Close modal"
                    >
                        <XIcon className="text-xl" />
                    </button>

                    <div className="mx-auto w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center mb-4 text-2xl">
                        🐒
                    </div>
                    
                    <h2 className="text-2xl font-bold text-slate-900 font-outfit">
                        {mode === 'login' ? 'Welcome back' : 'Create an account'}
                    </h2>
                    <p className="mt-2 text-sm text-slate-500">
                        {mode === 'login' 
                            ? 'Enter your details to access your study space.' 
                            : 'Start your learning journey with Clever Monkey.'}
                    </p>
                </div>

                <div className="px-8 pb-8">
                    <button
                        onClick={onGoogleSignIn}
                        className="w-full flex items-center justify-center gap-3 bg-white border border-slate-200 hover:border-blue-200 hover:bg-blue-50/50 text-slate-700 hover:text-blue-700 font-semibold py-3 px-4 rounded-xl transition-all duration-200 group shadow-sm"
                    >
                        <svg className="w-5 h-5 transition-transform group-hover:scale-110" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.115-1.315.32-1.92V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                        </svg>
                        <span>Continue with Google</span>
                    </button>

                    <div className="relative my-6">
                        <div className="absolute inset-0 flex items-center">
                            <div className="w-full border-t border-slate-200"></div>
                        </div>
                        <div className="relative flex justify-center text-xs uppercase">
                            <span className="bg-white px-2 text-slate-400 font-medium tracking-wider">Or with email</span>
                        </div>
                    </div>

                    <form className="space-y-4" onSubmit={handleSubmit}>
                        {mode === 'signup' && (
                            <div>
                                <label className="block text-xs font-semibold text-slate-500 mb-1.5 ml-1">Name</label>
                                <input
                                    type="text"
                                    placeholder="Your name"
                                    value={name}
                                    onChange={(event) => setName(event.target.value)}
                                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                                    required
                                    minLength={1}
                                    maxLength={60}
                                />
                            </div>
                        )}
                        <div>
                            <label className="block text-xs font-semibold text-slate-500 mb-1.5 ml-1">Email address</label>
                            <input
                                type="email"
                                placeholder="name@example.com"
                                value={email}
                                onChange={(event) => setEmail(event.target.value)}
                                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-slate-500 mb-1.5 ml-1">Password</label>
                            <input
                                type="password"
                                placeholder="••••••••"
                                value={password}
                                onChange={(event) => setPassword(event.target.value)}
                                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                                required
                                minLength={6}
                            />
                        </div>
                        {error && (
                            <div className="text-xs text-red-600 bg-red-50 border border-red-100 px-3 py-2 rounded-lg">
                                {error}
                            </div>
                        )}
                        <button
                            type="submit"
                            className="w-full bg-slate-900 text-white font-bold py-3 rounded-xl shadow-lg shadow-slate-900/20 hover:bg-slate-800 transition-colors disabled:opacity-60"
                            disabled={isSubmitting}
                        >
                            {isSubmitting ? 'Please wait...' : (mode === 'login' ? 'Sign In' : 'Sign Up')}
                        </button>
                    </form>

                    <div className="mt-6 text-center">
                        <p className="text-sm text-slate-500">
                            {mode === 'login' ? "Don't have an account? " : "Already have an account? "}
                            <button 
                                onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}
                                className="font-bold text-blue-600 hover:text-blue-700 hover:underline transition-colors"
                            >
                                {mode === 'login' ? 'Sign up' : 'Log in'}
                            </button>
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};
