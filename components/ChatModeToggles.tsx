import * as React from 'react';
import { CleverMonkeyIcon, DocumentIcon } from './icons';

// Chat-mode controls live above the chat input. Monkey mode is intentionally
// icon-only so it stays compact on mobile; answer scope keeps the labelled
// switch because its state needs explicit text.

interface PillToggleProps {
    label: React.ReactNode;
    on: boolean;
    onChange: (next: boolean) => void;
    /** Tailwind class for the track when the switch is on. */
    onColor: string;
    title?: string;
    ariaLabel: string;
}

const PillToggle: React.FC<PillToggleProps> = ({ label, on, onChange, onColor, title, ariaLabel }) => (
    <div className="flex items-center justify-end gap-2 text-sm text-ink-700" title={title}>
        <span className="font-medium">{label}</span>
        <button
            type="button"
            role="switch"
            aria-label={ariaLabel}
            aria-checked={on}
            onClick={() => onChange(!on)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-500 ${on ? onColor : 'bg-ink-400'}`}
        >
            <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${on ? 'translate-x-6' : 'translate-x-1'}`}
            />
        </button>
    </div>
);

interface MonkeyModeToggleProps {
    on: boolean;
    onChange: (next: boolean) => void;
}

export const MonkeyModeToggle: React.FC<MonkeyModeToggleProps> = ({ on, onChange }) => (
    <button
        type="button"
        aria-pressed={on}
        aria-label={on ? 'Turn monkey mode off' : 'Turn monkey mode on'}
        title={on ? 'Monkey mode on' : 'Monkey mode off'}
        onClick={() => onChange(!on)}
        className={[
            'inline-flex h-9 w-9 items-center justify-center rounded-lg border transition-[transform,background-color,border-color,color]',
            'active:scale-[0.94] focus:outline-none focus:ring-2 focus:ring-yellow-500/25',
            on
                ? 'border-yellow-300 bg-yellow-100 text-yellow-700 shadow-card'
                : 'border-ink-200 bg-white text-ink-500 hover:border-yellow-200 hover:bg-yellow-50 hover:text-yellow-700',
        ].join(' ')}
    >
        <CleverMonkeyIcon className="h-5 w-5" />
    </button>
);

interface AnswerScopeToggleProps {
    scope: 'document' | 'general';
    onChange: (next: 'document' | 'general') => void;
}

export const AnswerScopeToggle: React.FC<AnswerScopeToggleProps> = ({ scope, onChange }) => {
    const onDocument = scope === 'document';
    return (
        <PillToggle
            label={(
                <span className="inline-flex items-center gap-1.5">
                    <DocumentIcon className="text-base text-brand-600" />
                    <span>From Document Only</span>
                </span>
            )}
            on={onDocument}
            onChange={(next) => onChange(next ? 'document' : 'general')}
            onColor="bg-brand-600"
            title={onDocument
                ? 'Answers are strictly from the document'
                : 'Answers can include general knowledge'}
            ariaLabel="Toggle answer scope"
        />
    );
};
