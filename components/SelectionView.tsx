// Fix: Use namespace import for React to resolve JSX intrinsic element errors.
import * as React from 'react';
import { AssignmentIcon, ChatIcon, CopyIcon } from './icons';

interface SelectionViewProps {
    onSelect: (selection: 'summary' | 'chat' | 'quiz') => void;
}

export const SelectionView: React.FC<SelectionViewProps> = ({ onSelect }) => {

    const selectionOptions = [
        {
            key: 'summary' as const,
            icon: <CopyIcon className="text-4xl text-blue-600" />,
            title: 'Summary',
            description: 'Get a quick overview of the key points in your document.',
            color: 'blue'
        },
        {
            key: 'chat' as const,
            icon: <ChatIcon className="text-4xl text-green-600" />,
            title: 'Chat',
            description: 'Ask questions and get detailed answers about the content.',
            color: 'green'
        },
        {
            key: 'quiz' as const,
            icon: <AssignmentIcon className="text-4xl text-purple-600" />,
            title: 'Quiz',
            description: 'Test your knowledge with multiple-choice or open-ended questions.',
            color: 'purple'
        },
    ];

    return (
        <div className="flex flex-col items-center justify-center h-full p-4 bg-slate-50">
            <div className="text-center mb-8">
                <h2 className="text-2xl font-bold text-slate-800">Ready to Dive In?</h2>
                <p className="text-slate-600 mt-1">Choose how you'd like to start.</p>
            </div>
            <div className="w-full max-w-md space-y-4">
                {selectionOptions.map(opt => (
                     <button
                        key={opt.key}
                        onClick={() => onSelect(opt.key)}
                        className={`w-full flex items-center text-left p-4 bg-white rounded-xl border-2 border-transparent hover:border-${opt.color}-500 hover:shadow-lg transition-all duration-200 group`}
                    >
                        <div className={`flex-shrink-0 w-16 h-16 flex items-center justify-center bg-${opt.color}-100 rounded-lg mr-4`}>
                            {opt.icon}
                        </div>
                        <div>
                            <h3 className="text-lg font-semibold text-slate-800 group-hover:text-${opt.color}-700">{opt.title}</h3>
                            <p className="text-sm text-slate-500">{opt.description}</p>
                        </div>
                    </button>
                ))}
            </div>
        </div>
    );
};