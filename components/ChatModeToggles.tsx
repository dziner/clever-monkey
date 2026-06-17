import * as React from 'react';
import { CleverMonkeyIcon, DocumentIcon } from './icons';

// Two pill-style toggles that sit above the chat input. They share the
// same visual shape and behaviour (label + role=switch), so a single
// PillToggle backs both and each named export is just a thin call to it.
// Lives outside InteractionPanel so the chat-tab refactor can extract
// the chat surface without dragging the two inline FCs along.

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
    <PillToggle
        label={(
            <span className="inline-flex items-center gap-1.5">
                <CleverMonkeyIcon className="h-4 w-4 text-yellow-600" />
                <span>Monkey</span>
            </span>
        )}
        on={on}
        onChange={onChange}
        onColor="bg-yellow-500"
        title="Toggle mischievous monkey mode"
        ariaLabel="Toggle monkey mode"
    />
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
