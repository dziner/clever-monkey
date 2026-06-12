import * as React from 'react';
import {
    SpaceDashboardIcon, ChatIcon, AssignmentIcon,
    AccountTreeIcon, StyleIcon, HeadphonesIcon,
} from './icons';
import type { ActiveTab } from './InteractionPanel';

// Tab bar for the InteractionPanel. Extracted because the parent file
// kept two identical `.map()` blocks (primary vs creative tabs) where
// the only difference was which array was iterated; collapsing them into
// a single TabButton makes the rendering logic obvious and the file
// testable without spinning up the whole InteractionPanel.

interface TabDef {
    id: ActiveTab;
    icon: React.FC<React.HTMLAttributes<HTMLSpanElement>>;
    label: string;
}

const STUDY_TABS: readonly TabDef[] = [
    { id: 'overview', icon: SpaceDashboardIcon, label: 'Overview' },
    { id: 'chat', icon: ChatIcon, label: 'Chat' },
    { id: 'quiz', icon: AssignmentIcon, label: 'Quiz' },
] as const;

const CREATE_TABS: readonly TabDef[] = [
    { id: 'mindmap', icon: AccountTreeIcon, label: 'Mind Map' },
    { id: 'flashcards', icon: StyleIcon, label: 'Flashcards' },
    { id: 'podcast', icon: HeadphonesIcon, label: 'Podcast' },
] as const;

/** Tabs that work for signed-out guests; the rest show a lock badge. */
export function isGuestLocked(id: ActiveTab, isGuest: boolean): boolean {
    return isGuest && id !== 'overview' && id !== 'chat';
}

interface InteractionTabsProps {
    activeTab: ActiveTab;
    isGuest: boolean;
    onTabChange: (tab: ActiveTab) => void;
}

export const InteractionTabs: React.FC<InteractionTabsProps> = ({ activeTab, isGuest, onTabChange }) => (
    <div className="flex bg-white w-full border-b border-ink-100">
        {STUDY_TABS.map(tab => (
            <TabButton key={tab.id} tab={tab} activeTab={activeTab} isGuest={isGuest} onTabChange={onTabChange} />
        ))}
        <div className="w-px bg-ink-200 flex-shrink-0 my-2.5" />
        {CREATE_TABS.map(tab => (
            <TabButton key={tab.id} tab={tab} activeTab={activeTab} isGuest={isGuest} onTabChange={onTabChange} />
        ))}
    </div>
);

interface TabButtonProps {
    tab: TabDef;
    activeTab: ActiveTab;
    isGuest: boolean;
    onTabChange: (tab: ActiveTab) => void;
}

const TabButton: React.FC<TabButtonProps> = ({ tab, activeTab, isGuest, onTabChange }) => {
    const locked = isGuestLocked(tab.id, isGuest);
    const isActive = activeTab === tab.id;
    return (
        <button
            type="button"
            data-tour={`tab-${tab.id}`}
            title={locked ? `${tab.label} — 로그인 필요` : tab.label}
            onClick={() => onTabChange(tab.id)}
            className={[
                'relative flex-1 flex items-center justify-center py-3 transition-colors',
                isActive
                    ? 'text-brand-600'
                    : locked
                        ? 'text-ink-300 hover:text-ink-500'
                        : 'text-ink-400 hover:text-ink-700',
            ].join(' ')}
        >
            <span className="relative inline-flex">
                <tab.icon className="text-[18px]" />
                {locked && (
                    <span className="absolute -top-1 -right-2 w-2 h-2 rounded-full bg-ink-300" aria-hidden="true" />
                )}
            </span>
            {isActive && (
                <span className="absolute bottom-0 left-3 right-3 h-0.5 rounded-t-full bg-brand-600" />
            )}
        </button>
    );
};
