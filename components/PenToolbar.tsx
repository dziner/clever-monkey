import React from 'react';
import { ChevronDownIcon, EditIcon, HighlightIcon } from './icons';

interface PenToolbarProps {
    color: string;
    setColor: (color: string) => void;
    tool: 'pen' | 'highlighter';
    setTool: (tool: 'pen' | 'highlighter') => void;
    onCollapse: () => void;
    onAfterSelect?: () => void;
}

const PEN_COLORS = [
    { name: 'Black', value: '#000000' },
    { name: 'Red', value: '#EF4444' },
    { name: 'Blue', value: '#3B82F6' },
    { name: 'Green', value: '#22C55E' },
    { name: 'Yellow', value: '#EAB308' },
];

export const PenToolbar: React.FC<PenToolbarProps> = ({ color, setColor, tool, setTool, onCollapse, onAfterSelect }) => {
    return (
        <div className="flex items-center gap-4 bg-white p-2 pl-4 pr-2 rounded-full shadow-lg border border-slate-200 animate-in slide-in-from-bottom-2 duration-200">
            <div className="flex items-center gap-1 border-r border-slate-200 pr-4">
                <button
                    type="button"
                    onClick={() => {
                        setTool('pen');
                        onAfterSelect?.();
                    }}
                    className={`p-2 rounded-full transition-all ${tool === 'pen' ? 'bg-slate-100 text-slate-900 ring-2 ring-slate-200' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'}`}
                    title="Pen"
                >
                    <EditIcon className="text-xl" />
                </button>
                <button
                    type="button"
                    onClick={() => {
                        setTool('highlighter');
                        onAfterSelect?.();
                    }}
                    className={`p-2 rounded-full transition-all ${tool === 'highlighter' ? 'bg-slate-100 text-slate-900 ring-2 ring-slate-200' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'}`}
                    title="Highlighter"
                >
                    <HighlightIcon className="text-xl" />
                </button>
            </div>

            <div className="flex items-center gap-2 border-r border-slate-200 pr-4">
                {PEN_COLORS.map(c => (
                    <button
                        key={c.value}
                        type="button"
                        onClick={() => {
                            setColor(c.value);
                            onAfterSelect?.();
                        }}
                        className={`w-6 h-6 rounded-full border transition-all ${color === c.value ? 'ring-2 ring-offset-1 ring-slate-400 scale-110' : 'border-slate-200 hover:scale-105'}`}
                        style={{ backgroundColor: c.value }}
                        title={c.name}
                    />
                ))}
            </div>

            <button
                type="button"
                onClick={onCollapse}
                className="p-1.5 text-slate-500 hover:bg-slate-100 rounded-full transition-colors ml-1"
                title="Collapse Pen Tools"
                aria-label="Collapse pen tools"
            >
                <ChevronDownIcon className="text-xl" />
            </button>
        </div>
    );
};
