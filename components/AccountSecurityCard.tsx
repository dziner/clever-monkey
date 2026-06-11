import * as React from 'react';
import { updateEmail, updatePassword, getAuthProviders } from '../services/supabaseClient';
import { useUser } from '../contexts/UserContext';
import { useToast } from './Toast';
import { t } from '../services/uiStrings';
import { Button } from './ui/Button';
import { KeyIcon, CheckIcon } from './icons';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD = 8;

interface AccountSecurityCardProps {
    userEmail: string | null;
}

/**
 * Self-service email + password management. Only rendered for accounts
 * that actually have a password (provider 'email'); OAuth-only accounts
 * (Google) see a short note pointing them to their provider, because
 * there's no password to change and the email is governed by Google.
 */
export const AccountSecurityCard: React.FC<AccountSecurityCardProps> = ({ userEmail }) => {
    const { userProfile } = useUser();
    const lang = userProfile?.language;
    const { showToast } = useToast();

    const [providers, setProviders] = React.useState<string[] | null>(null);
    React.useEffect(() => {
        let active = true;
        getAuthProviders().then(p => { if (active) setProviders(p); });
        return () => { active = false; };
    }, []);

    const [emailOpen, setEmailOpen] = React.useState(false);
    const [pwOpen, setPwOpen] = React.useState(false);

    if (providers === null) {
        return (
            <div className="bg-white rounded-2xl border border-ink-200 p-5">
                <div className="h-5 w-32 bg-ink-100 rounded animate-pulse" />
            </div>
        );
    }

    const hasPassword = providers.includes('email');

    return (
        <div className="bg-white rounded-2xl border border-ink-200 p-5">
            <div className="flex items-center gap-2 mb-4">
                <KeyIcon className="text-lg text-ink-500" />
                <h3 className="text-sm font-bold text-ink-800">{t('account.section', lang)}</h3>
            </div>

            {!hasPassword ? (
                <p className="text-sm text-ink-500 leading-relaxed">{t('account.google.note', lang)}</p>
            ) : (
                <div className="space-y-4">
                    {/* Email */}
                    <div>
                        <div className="flex items-center justify-between gap-3">
                            <div className="min-w-0">
                                <p className="text-xs font-semibold text-ink-400 uppercase tracking-wide">{t('account.email.label', lang)}</p>
                                <p className="text-sm text-ink-800 truncate">{userEmail}</p>
                            </div>
                            <button
                                type="button"
                                onClick={() => { setEmailOpen(o => !o); setPwOpen(false); }}
                                className="flex-shrink-0 text-sm font-semibold text-brand-600 hover:text-brand-700 transition-colors"
                            >
                                {t('account.email.change', lang)}
                            </button>
                        </div>
                        {emailOpen && (
                            <EmailChangeForm
                                lang={lang}
                                onDone={() => setEmailOpen(false)}
                                showToast={showToast}
                            />
                        )}
                    </div>

                    <div className="border-t border-ink-100" />

                    {/* Password */}
                    <div>
                        <div className="flex items-center justify-between gap-3">
                            <div>
                                <p className="text-xs font-semibold text-ink-400 uppercase tracking-wide">{t('account.password.label', lang)}</p>
                                <p className="text-sm text-ink-800">••••••••</p>
                            </div>
                            <button
                                type="button"
                                onClick={() => { setPwOpen(o => !o); setEmailOpen(false); }}
                                className="flex-shrink-0 text-sm font-semibold text-brand-600 hover:text-brand-700 transition-colors"
                            >
                                {t('account.password.change', lang)}
                            </button>
                        </div>
                        {pwOpen && (
                            <PasswordChangeForm
                                lang={lang}
                                onDone={() => setPwOpen(false)}
                                showToast={showToast}
                            />
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

const fieldCls =
    'w-full rounded-lg border border-ink-200 px-3 py-2 text-sm text-ink-900 placeholder:text-ink-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-400';

type ShowToast = (message: string, type?: 'success' | 'error' | 'info') => void;

const EmailChangeForm: React.FC<{ lang?: string | null; onDone: () => void; showToast: ShowToast }> = ({ lang, onDone, showToast }) => {
    const [email, setEmail] = React.useState('');
    const [error, setError] = React.useState<string | null>(null);
    const [busy, setBusy] = React.useState(false);

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        const trimmed = email.trim();
        if (!EMAIL_RE.test(trimmed)) { setError(t('account.email.invalid', lang)); return; }
        setBusy(true);
        setError(null);
        const { error: err } = await updateEmail(trimmed);
        setBusy(false);
        if (err) { setError(t('account.email.error', lang)); return; }
        showToast(t('account.email.sent', lang), 'success');
        onDone();
    };

    return (
        <form onSubmit={submit} className="mt-3 space-y-2">
            <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t('account.email.new', lang)}
                autoComplete="email"
                maxLength={254}
                className={fieldCls}
                aria-label={t('account.email.new', lang)}
            />
            {error && <p className="text-xs text-danger-600">{error}</p>}
            <div className="flex justify-end gap-2">
                <Button variant="ghost" size="sm" type="button" onClick={onDone} disabled={busy}>
                    {t('common.cancel', lang)}
                </Button>
                <Button variant="primary" size="sm" type="submit" loading={busy}>
                    {t('common.save', lang)}
                </Button>
            </div>
        </form>
    );
};

const PasswordChangeForm: React.FC<{ lang?: string | null; onDone: () => void; showToast: ShowToast }> = ({ lang, onDone, showToast }) => {
    const [current, setCurrent] = React.useState('');
    const [next, setNext] = React.useState('');
    const [confirm, setConfirm] = React.useState('');
    const [error, setError] = React.useState<string | null>(null);
    const [busy, setBusy] = React.useState(false);

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (next.length < MIN_PASSWORD) { setError(t('account.password.tooShort', lang)); return; }
        if (next !== confirm) { setError(t('account.password.mismatch', lang)); return; }
        setBusy(true);
        setError(null);
        const { error: err } = await updatePassword(current, next);
        setBusy(false);
        if (err) {
            setError(err.message === 'INVALID_CURRENT_PASSWORD'
                ? t('account.password.wrong', lang)
                : t('account.password.error', lang));
            return;
        }
        showToast(t('account.password.updated', lang), 'success');
        onDone();
    };

    return (
        <form onSubmit={submit} className="mt-3 space-y-2">
            <input
                type="password" value={current} onChange={(e) => setCurrent(e.target.value)}
                placeholder={t('account.password.current', lang)} autoComplete="current-password"
                className={fieldCls} aria-label={t('account.password.current', lang)}
            />
            <input
                type="password" value={next} onChange={(e) => setNext(e.target.value)}
                placeholder={t('account.password.new', lang)} autoComplete="new-password"
                className={fieldCls} aria-label={t('account.password.new', lang)}
            />
            <input
                type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)}
                placeholder={t('account.password.confirm', lang)} autoComplete="new-password"
                className={fieldCls} aria-label={t('account.password.confirm', lang)}
            />
            {error && <p className="text-xs text-danger-600">{error}</p>}
            <div className="flex justify-end gap-2">
                <Button variant="ghost" size="sm" type="button" onClick={onDone} disabled={busy}>
                    {t('common.cancel', lang)}
                </Button>
                <Button variant="primary" size="sm" type="submit" loading={busy} leftIcon={<CheckIcon className="text-base" />}>
                    {t('common.save', lang)}
                </Button>
            </div>
        </form>
    );
};
