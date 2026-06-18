import * as React from 'react';
import {
    ChevronLeftIcon, CheckIcon, CleverMonkeyIcon, EditIcon, XIcon,
    DocumentIcon, CloudIcon, WorkspacePremiumIcon,
} from './icons';
import { updateMyDisplayName, updateMyLanguage } from '../services/profileService';
import { deleteMyAccount } from '../services/supabaseClient';
import {
    CONTENT_LANGUAGE_OPTIONS,
    detectBrowserLanguage,
    languageDisplayNameForPrompt,
} from '../services/languageService';
import { Button } from './ui/Button';
import { Badge } from './ui/Badge';
import { ConfirmDialog } from './ConfirmDialog';
import { AccountSecurityCard } from './AccountSecurityCard';
import { useUser } from '../contexts/UserContext';
import { t } from '../services/uiStrings';
import { useToast } from './Toast';
import { createBillingPortalSessionUrl } from '../services/billingService';

interface ProfilePageProps {
    userEmail: string | null;
    displayName: string | null;
    language: string | null;
    fileCount: number;
    storageUsage: string;
    planName: string;
    onBack: () => void;
    onUpgrade: () => void;
    onNameSaved: () => void | Promise<void>;
    onLanguageSaved: () => void | Promise<void>;
}

export const ProfilePage: React.FC<ProfilePageProps> = ({
    userEmail,
    displayName,
    language,
    fileCount,
    storageUsage,
    planName,
    onBack,
    onUpgrade,
    onNameSaved,
    onLanguageSaved,
}) => {
    const fallbackName = userEmail?.split('@')[0] || 'Guest';
    const shownName = displayName?.trim() || fallbackName;
    const isPro = planName === 'Pro';
    const { userProfile } = useUser();
    const langPref = userProfile?.language;
    const { showToast } = useToast();
    const [isDeleteOpen, setIsDeleteOpen] = React.useState(false);
    const [isOpeningBilling, setIsOpeningBilling] = React.useState(false);

    const [isEditing, setIsEditing] = React.useState(false);
    const [draftName, setDraftName] = React.useState(displayName ?? '');
    const [isSaving, setIsSaving] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);

    const requestAccountDeletion = React.useCallback(async () => {
        // Real hard-delete via the service-role Netlify function. The
        // auth user goes; every app table cascades; storage files are
        // wiped first. The signOut inside deleteMyAccount also clears
        // the local session, so the auth listener will redirect us out
        // of the now-orphaned profile page on its own.
        const { error } = await deleteMyAccount();
        setIsDeleteOpen(false);
        if (error) {
            showToast(t('account.delete.error', langPref), 'error');
            return;
        }
        showToast(t('account.delete.done', langPref), 'success');
    }, [langPref, showToast]);

    const currentLanguage = language ?? 'auto';
    const [isSavingLanguage, setIsSavingLanguage] = React.useState(false);
    const [languageError, setLanguageError] = React.useState<string | null>(null);
    const browserLangName = React.useMemo(() => languageDisplayNameForPrompt(null), []);
    const browserLangCode = React.useMemo(() => detectBrowserLanguage(), []);

    const handleLanguageChange = async (next: string) => {
        if (next === currentLanguage) return;
        setLanguageError(null);
        setIsSavingLanguage(true);
        const ok = await updateMyLanguage(next === 'auto' ? null : next);
        setIsSavingLanguage(false);
        if (!ok) { setLanguageError('언어 설정을 저장하지 못했습니다.'); return; }
        await onLanguageSaved();
    };

    const handleManageBilling = async () => {
        setIsOpeningBilling(true);
        const result = await createBillingPortalSessionUrl();
        setIsOpeningBilling(false);
        if (result.error) {
            showToast(result.error === 'NO_SESSION' ? '로그인 후 결제 관리를 열 수 있습니다.' : result.error, 'error');
            return;
        }
        window.location.assign(result.url);
    };

    const startEdit = () => {
        setDraftName(displayName ?? '');
        setError(null);
        setIsEditing(true);
    };
    const cancelEdit = () => { setIsEditing(false); setError(null); };
    const saveEdit = async () => {
        const trimmed = draftName.trim();
        if (!trimmed) { setError('이름을 입력해 주세요.'); return; }
        if (trimmed === (displayName ?? '').trim()) { setIsEditing(false); return; }
        setIsSaving(true);
        setError(null);
        const ok = await updateMyDisplayName(trimmed);
        setIsSaving(false);
        if (!ok) { setError('저장에 실패했습니다.'); return; }
        await onNameSaved();
        setIsEditing(false);
    };
    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') saveEdit();
        else if (e.key === 'Escape') cancelEdit();
    };

    return (
        <div className="fixed inset-0 bg-ink-50 z-50 overflow-y-auto">
            <div className="sticky top-0 z-10 bg-white/80 backdrop-blur-md border-b border-ink-200">
                <div className="max-w-3xl mx-auto px-5 py-4 flex items-center gap-3">
                    <button
                        onClick={onBack}
                        className="flex items-center gap-1.5 text-ink-600 hover:text-ink-900 text-sm font-semibold"
                        aria-label="Back to workspace"
                    >
                        <ChevronLeftIcon className="text-xl" />
                        Back
                    </button>
                    <div className="flex-1 text-center">
                        <h1 className="text-base font-display font-bold text-ink-900 tracking-tight">Profile</h1>
                    </div>
                    <div className="w-16" />
                </div>
            </div>

            <div className="max-w-3xl mx-auto px-5 py-8 space-y-5">
                {/* Identity card */}
                <div className="relative bg-white rounded-3xl border border-ink-200 p-6 shadow-card overflow-hidden">
                    <div className="absolute -top-20 -right-20 w-64 h-64 bg-brand-100/40 rounded-full blur-3xl pointer-events-none" />
                    <div className="relative flex items-center gap-4">
                        <div className="w-16 h-16 flex-shrink-0">
                            <CleverMonkeyIcon className="w-full h-full text-brand-500" />
                        </div>
                        <div className="flex-1 min-w-0">
                            {isEditing ? (
                                <div className="flex items-center gap-2">
                                    <input
                                        type="text"
                                        value={draftName}
                                        onChange={(e) => setDraftName(e.target.value)}
                                        onKeyDown={handleKeyDown}
                                        placeholder="이름"
                                        autoFocus
                                        maxLength={60}
                                        className="flex-1 min-w-0 text-xl font-bold text-ink-900 bg-white border border-brand-400 rounded-xl px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                                    />
                                    <button
                                        type="button"
                                        onClick={saveEdit}
                                        disabled={isSaving || !draftName.trim()}
                                        className="p-2 rounded-lg text-success-600 hover:bg-success-50 disabled:opacity-40"
                                        aria-label="Save name"
                                    >
                                        <CheckIcon className="text-lg" />
                                    </button>
                                    <button
                                        type="button"
                                        onClick={cancelEdit}
                                        disabled={isSaving}
                                        className="p-2 rounded-lg text-ink-500 hover:bg-ink-100"
                                        aria-label="Cancel"
                                    >
                                        <XIcon className="text-lg" />
                                    </button>
                                </div>
                            ) : (
                                <div className="flex items-center gap-2">
                                    <h2 className="text-xl font-display font-bold text-ink-900 truncate tracking-tight">{shownName}</h2>
                                    <button
                                        type="button"
                                        onClick={startEdit}
                                        className="p-1.5 rounded-lg text-ink-400 hover:text-ink-700 hover:bg-ink-100"
                                        aria-label="Edit name"
                                        title="이름 수정"
                                    >
                                        <EditIcon className="text-base" />
                                    </button>
                                </div>
                            )}
                            <p className="text-sm text-ink-500 truncate mt-0.5">{userEmail || 'Not signed in'}</p>
                            {error && <p className="mt-1 text-xs text-danger-600 font-medium">{error}</p>}
                        </div>
                        <Badge tone={isPro ? 'brand' : 'neutral'} variant="soft" size="md">{planName}</Badge>
                    </div>
                </div>

                {/* Language preference */}
                <div className="bg-white rounded-2xl border border-ink-200 p-5 shadow-soft">
                    <div className="flex items-start justify-between gap-4 mb-3">
                        <div>
                            <p className="text-[11px] uppercase tracking-[0.14em] text-ink-400 font-bold">콘텐츠 언어</p>
                            <h3 className="mt-1.5 text-base font-display font-bold text-ink-900 tracking-tight">AI 생성 언어</h3>
                            <p className="mt-1 text-xs text-ink-500 leading-relaxed">
                                퀴즈, 마인드맵, 플래시카드, 슬라이드, 팟캐스트, 챗 응답이 이 언어로 생성됩니다.
                            </p>
                        </div>
                    </div>
                    <label htmlFor="content-language" className="sr-only">콘텐츠 언어</label>
                    <select
                        id="content-language"
                        value={currentLanguage}
                        onChange={(e) => handleLanguageChange(e.target.value)}
                        disabled={isSavingLanguage}
                        className="w-full h-11 px-3 pr-9 rounded-xl border border-ink-200 bg-white text-sm text-ink-900 font-medium focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-400 disabled:opacity-60"
                    >
                        {CONTENT_LANGUAGE_OPTIONS.map(opt => (
                            <option key={opt.code} value={opt.code}>{opt.label}</option>
                        ))}
                    </select>
                    <p className="mt-2 text-[11px] text-ink-400">
                        자동 선택 시 브라우저 언어를 따릅니다 (현재 감지: <span className="font-semibold text-ink-600">{browserLangName} · {browserLangCode}</span>).
                    </p>
                    {languageError && <p className="mt-2 text-xs text-danger-600 font-medium">{languageError}</p>}
                </div>

                {/* Usage tiles */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <UsageTile icon={DocumentIcon} label="Documents" value={String(fileCount)} caption="Uploaded files" />
                    <UsageTile icon={CloudIcon} label="Storage"   value={storageUsage}        caption="Used capacity" />
                    <UsageTile icon={WorkspacePremiumIcon} label="Plan" value={planName} caption={isPro ? 'Pro tier' : 'Free tier'} accent />
                </div>

                {/* Upgrade promo (only if free) */}
                {isPro ? (
                    <div className="relative rounded-2xl bg-white border border-ink-200 p-6 shadow-card overflow-hidden">
                        <div className="absolute -top-20 -right-20 w-64 h-64 bg-brand-50 rounded-full blur-3xl pointer-events-none" />
                        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                                <Badge tone="brand" variant="soft" size="md">
                                    <WorkspacePremiumIcon className="text-sm" />
                                    Pro
                                </Badge>
                                <h3 className="mt-3 text-xl font-display font-bold tracking-tight text-ink-900">Pro 플랜 사용 중</h3>
                                <p className="mt-1 text-sm text-ink-500">
                                    결제 수단, 인보이스, 구독 변경은 Stripe 보안 포털에서 관리됩니다.
                                </p>
                            </div>
                            <Button
                                variant="outline"
                                size="md"
                                onClick={handleManageBilling}
                                loading={isOpeningBilling}
                                className="self-start sm:self-center"
                            >
                                결제 관리
                            </Button>
                        </div>
                    </div>
                ) : (
                    <div className="relative rounded-2xl bg-ink-900 text-white p-6 md:p-8 shadow-card overflow-hidden">
                        <div className="absolute -top-24 -right-24 w-72 h-72 bg-brand-500/30 rounded-full blur-3xl pointer-events-none" />
                        <div className="absolute bottom-0 left-0 w-48 h-48 bg-brand-400/20 rounded-full blur-3xl pointer-events-none" />
                        <div className="relative">
                            <Badge tone="brand" variant="solid" size="md" className="bg-white/10 text-white border border-white/20">
                                <WorkspacePremiumIcon className="text-sm" />
                                Pro
                            </Badge>
                            <h3 className="mt-3 text-2xl md:text-3xl font-display font-bold tracking-tight">Pro로 한 단계 더</h3>
                            <p className="mt-2 text-sm text-brand-100/90 max-w-md">
                                업로드 한도 확대, 우선 처리, 고급 분석, 프리미엄 AI 모델까지 — 학습이 막힘없이 흐릅니다.
                            </p>
                            <ul className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
                                {['높은 업로드 한도', '우선 처리 큐', '고급 분석 대시보드', '프리미엄 AI 모델'].map(item => (
                                    <li key={item} className="flex items-center gap-2">
                                        <CheckIcon className="text-base text-success-400" />
                                        <span className="text-brand-50">{item}</span>
                                    </li>
                                ))}
                            </ul>
                            <Button
                                variant="primary"
                                size="lg"
                                onClick={onUpgrade}
                                className="mt-6 bg-white text-brand-700 hover:bg-brand-50 shadow-pop"
                            >
                                Pro 업그레이드
                            </Button>
                        </div>
                    </div>
                )}

                {/* Email / password management (email accounts only). */}
                {userEmail && (
                    <div className="mt-6">
                        <AccountSecurityCard userEmail={userEmail} />
                    </div>
                )}

                {/* Danger zone — visually quiet, intentionally placed below
                    the upgrade pitch so it never competes for attention.
                    Surfacing the deletion path is the GDPR/PIPA minimum;
                    the actual cascade-delete RPC lands in Phase 2. */}
                {userEmail && (
                    <div className="mt-10 pt-6 border-t border-ink-200">
                        <button
                            type="button"
                            onClick={() => setIsDeleteOpen(true)}
                            className="text-sm text-ink-500 hover:text-danger-600 transition-colors"
                        >
                            {t('account.delete.label', langPref)}
                        </button>
                    </div>
                )}
            </div>
            <ConfirmDialog
                isOpen={isDeleteOpen}
                onClose={() => setIsDeleteOpen(false)}
                onConfirm={requestAccountDeletion}
                title={t('account.delete.title', langPref)}
                body={t('account.delete.body', langPref)}
                confirmKey="common.delete"
                destructive
            />
        </div>
    );
};

interface UsageTileProps {
    icon: React.FC<React.HTMLAttributes<HTMLSpanElement>>;
    label: string;
    value: string;
    caption: string;
    accent?: boolean;
}

const UsageTile: React.FC<UsageTileProps> = ({ icon: Icon, label, value, caption, accent }) => (
    <div className={[
        'relative bg-white rounded-2xl border border-ink-200 p-5 shadow-soft overflow-hidden',
        'transition-shadow hover:shadow-card',
    ].join(' ')}>
        {accent && <div className="absolute -top-10 -right-10 w-32 h-32 bg-brand-50 rounded-full blur-2xl pointer-events-none" />}
        <div className="relative">
            <div className="flex items-center justify-between">
                <p className="text-[11px] uppercase tracking-[0.14em] text-ink-400 font-bold">{label}</p>
                <Icon className={accent ? 'text-lg text-brand-500' : 'text-lg text-ink-400'} />
            </div>
            <h3 className={[
                'mt-3 text-2xl font-display font-bold tracking-tight leading-none',
                accent ? 'text-brand-700' : 'text-ink-900',
            ].join(' ')}>{value}</h3>
            <p className="mt-1 text-xs text-ink-500">{caption}</p>
        </div>
    </div>
);
