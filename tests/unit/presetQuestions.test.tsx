import * as React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PresetQuestions } from '../../components/PresetQuestions';
import { normalizePresetQuestions, stripLeadingPresetQuestionIcon } from '../../utils/presetQuestions';

describe('preset question normalization', () => {
    it('keeps only usable question strings from mixed AI or persisted payloads', () => {
        expect(normalizePresetQuestions([
            ' ❓ What is the main idea? ',
            { emoji: '📄', question: 'Summarize section two' },
            { text: 'Create a quiz' },
            undefined,
            100,
            { label: '' },
        ])).toEqual([
            '❓ What is the main idea?',
            '📄 Summarize section two',
            'Create a quiz',
        ]);
    });

    it('parses stringified containers without throwing', () => {
        expect(normalizePresetQuestions('{"questions":[{"question":"What is x?"},"Why now?"]}')).toEqual([
            'What is x?',
            'Why now?',
        ]);
    });

    it('strips leading icons without Unicode property escape support', () => {
        expect(stripLeadingPresetQuestionIcon('🧠 Create a quiz')).toBe('Create a quiz');
        expect(stripLeadingPresetQuestionIcon('❓ What is the point?')).toBe('What is the point?');
        expect(stripLeadingPresetQuestionIcon('No icon here')).toBe('No icon here');
    });
});

describe('PresetQuestions', () => {
    it('renders malformed persisted values without crashing', () => {
        const onQuestionClick = vi.fn();

        render(
            <PresetQuestions
                isOpen
                setIsOpen={() => undefined}
                questions={[
                    { emoji: '❓', question: ' What can I ask? ' },
                    undefined,
                    { text: 'Create a quiz' },
                ]}
                onQuestionClick={onQuestionClick}
            />,
        );

        expect(screen.getByText('What can I ask?')).toBeVisible();
        expect(screen.getByText('Create a quiz')).toBeVisible();

        fireEvent.click(screen.getByText('What can I ask?'));
        expect(onQuestionClick).toHaveBeenCalledWith('❓ What can I ask?');
    });

    it('renders nothing when no valid questions are available', () => {
        const { container } = render(
            <PresetQuestions
                isOpen
                setIsOpen={() => undefined}
                questions={[undefined, null, 123, { question: '' }]}
                onQuestionClick={() => undefined}
            />,
        );

        expect(container).toBeEmptyDOMElement();
    });
});
