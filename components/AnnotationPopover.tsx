import React, { useState, useEffect, useRef } from 'react';
import { CheckIcon, XIcon } from './icons';

interface AnnotationPopoverProps {
    x: number;
    y: number;
    onSave: (note: string, color: string) => void;
    onCancel: () => void;
}

const COLORS = [
    { name: 'Yellow', value: '#FDE68A' }, // yellow-200
    { name: 'Green', value: '#BBF7D0' },  // green-200
    { name: 'Blue', value: '#BFDBFE' },   // blue-200
    { name: 'Pink', value: '#FBCFE8' },   // pink-200
    { name: 'Purple', value: '#E9D5FF' }, // purple-200
];

export const AnnotationPopover: React.FC<AnnotationPopoverProps> = ({ x, y, onSave, onCancel }) => {
    const [note, setNote] = useState('');
    const [selectedColor, setSelectedColor] = useState(COLORS[0].value);
    const inputRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
        if (inputRef.current) {
            inputRef.current.focus();
        }
    }, []);

    // Adjust position to keep within viewport? 
    // Simplified style for now.
    const style: React.CSSProperties = {
        position: 'fixed',
        top: y + 10,
        left: x,
        zIndex: 50,
    };

    return (
        <div
            className="bg-white rounded-lg shadow-xl border border-slate-200 p-3 w-72 animate-in fade-in zoom-in duration-200"
            style={style}
        >
            <div className="flex gap-2 mb-3">
                {COLORS.map((c) => (
                    <button
                        key={c.value}
                        onClick={() => setSelectedColor(c.value)}
                        className={`w-6 h-6 rounded-full border transition-all ${selectedColor === c.value ? 'ring-2 ring-offset-1 ring-slate-400 scale-110' : 'border-slate-200 hover:scale-105'}`}
                        style={{ backgroundColor: c.value }}
                        title={c.name}
                    />
                ))}
            </div>

            <textarea
                ref={inputRef}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Add a note (optional)..."
                className="w-full text-sm p-2 border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[80px] mb-3 resize-none"
            />

            <div className="flex justify-end gap-2">
                <button
                    onClick={onCancel}
                    className="p-1.5 text-slate-500 hover:bg-slate-100 rounded-full transition-colors"
                    title="Cancel"
                >
                    <XIcon className="text-xl" />
                </button>
                <button
                    onClick={() => onSave(note, selectedColor)}
                    className="p-1.5 bg-blue-600 text-white hover:bg-blue-700 rounded-full transition-colors shadow-sm"
                    title="Save"
                >
                    <CheckIcon className="text-xl" />
                </button>
            </div>
        </div>
    );
};
