import React from 'react';
import { XIcon } from './icons';

interface PenToolbarProps {
    color: string;
    setColor: (color: string) => void;
    width: number;
    setWidth: (width: number) => void;
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

const PEN_WIDTHS = [
    { name: 'Thin', value: 2 },
    { name: 'Medium', value: 5 },
    { name: 'Thick', value: 10 },
];

export const PenToolbar: React.FC<PenToolbarProps> = ({ color, setColor, width, setWidth, onCollapse, onAfterSelect }) => {
    return (
        <div className="flex items-center gap-4 bg-white p-2 pl-4 pr-2 rounded-full shadow-lg border border-slate-200 animate-in slide-in-from-bottom-2 duration-200">
            <div className="flex items-center gap-2 border-r border-slate-200 pr-4">
                {PEN_COLORS.map(c => (
                    <button
                        key={c.value}
                        type="button"
                        onClick={() => {
                            setColor(c.value);
                            onAfterSelect?.();
                        }}
                        className={`w-5 h-5 rounded-full border transition-all ${color === c.value ? 'ring-2 ring-offset-1 ring-slate-400 scale-110' : 'border-slate-200 hover:scale-105'}`}
                        style={{ backgroundColor: c.value }}
                        title={c.name}
                    />
                ))}
            </div>

            <div className="flex items-center gap-2 border-r border-slate-200 pr-4">
                {PEN_WIDTHS.map(w => (
                    <button
                        key={w.name}
                        type="button"
                        onClick={() => {
                            setWidth(w.value);
                            onAfterSelect?.();
                        }}
                        className={`group relative flex items-center justify-center w-8 h-8 rounded-full hover:bg-slate-100 transition-colors ${width === w.value ? 'bg-slate-100' : ''}`}
                        title={`${w.name} width`}
                    >
                        <div
                            className={`rounded-full bg-slate-800 ${width === w.value ? 'bg-black' : 'bg-slate-400 group-hover:bg-slate-600'}`}
                            style={{ width: w.value, height: w.value }}
                        />
                    </button>
                ))}
            </div>

            <button
                type="button"
                onClick={onCollapse}
                className="p-1.5 text-slate-500 hover:bg-slate-100 rounded-full transition-colors ml-1"
                title="Collapse Pen Tools"
            >
                <XIcon className="text-xl" />
            </button>
        </div>
    );
};
