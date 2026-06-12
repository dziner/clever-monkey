import * as React from 'react';
import { IconButton } from './ui/Button';
import { Badge } from './ui/Badge';
import { LogOutIcon, WorkspacePremiumIcon } from './icons';

// Sidebar profile + sign-out tile. Pulled out of FileListPanel because
// it has no internal state, no panel-specific computation, and reads
// naturally as its own unit (avatar / name / plan badge / upgrade nudge /
// sign-out button). The panel just hands in display fields and callbacks.

interface ProfileCardProps {
    displayName: string;
    initial: string;
    planName: string;
    isPro: boolean;
    onProfileClick: () => void;
    onSignOut: () => void;
    /**
     * When set, shows the small "업그레이드" link next to the plan badge
     * for non-Pro accounts. Pass `undefined` to hide it entirely.
     */
    onUpgradeClick?: (reason: 'generic') => void;
}

export const ProfileCard: React.FC<ProfileCardProps> = ({
    displayName, initial, planName, isPro, onProfileClick, onSignOut, onUpgradeClick,
}) => (
    <button
        type="button"
        onClick={onProfileClick}
        className="w-full flex items-center gap-3 p-2.5 bg-white border border-ink-200 rounded-xl hover:border-brand-200 hover:bg-brand-50/30 transition-colors group"
    >
        <div className={[
            'w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0',
            isPro ? 'bg-brand-500 text-white' : 'bg-brand-100 text-brand-700',
        ].join(' ')}>
            {initial}
        </div>
        <div className="flex-1 min-w-0 text-left">
            <p className="text-xs font-bold text-ink-800 truncate" title={displayName}>{displayName}</p>
            <div className="flex items-center gap-1.5 mt-0.5">
                <Badge tone={isPro ? 'brand' : 'neutral'} variant="soft" size="sm">
                    {planName}
                </Badge>
                {!isPro && onUpgradeClick && (
                    <button
                        type="button"
                        onClick={e => { e.stopPropagation(); onUpgradeClick('generic'); }}
                        className="text-[10px] text-ink-400 hover:text-brand-600 font-semibold flex items-center gap-0.5 transition-colors"
                    >
                        <WorkspacePremiumIcon className="text-xs" /> 업그레이드
                    </button>
                )}
            </div>
        </div>
        <IconButton
            variant="ghost"
            size="sm"
            aria-label="Log out"
            title="Log out"
            onClick={e => { e.stopPropagation(); onSignOut(); }}
        >
            <LogOutIcon className="text-base" />
        </IconButton>
    </button>
);
