// Fix: Use namespace import for React to resolve JSX intrinsic element errors.
import * as React from 'react';
import { UploadIcon, CleverMonkeyIcon } from './icons';

interface IdleStateViewProps {
    onFileSelected: (file: File) => void;
}

export const IdleStateView: React.FC<IdleStateViewProps> = ({ onFileSelected }) => {
    const [isDragging, setIsDragging] = React.useState(false);
    const inputRef = React.useRef<HTMLInputElement>(null);

    const handleDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(true);
    };
    const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
    };
    const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
    };
    const handleDrop = React.useCallback((e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            onFileSelected(e.dataTransfer.files[0]);
            e.dataTransfer.clearData();
        }
    }, [onFileSelected]);

    const handleClick = () => {
        inputRef.current?.click();
    };
    
    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            onFileSelected(e.target.files[0]);
        }
    };

    return (
        <div 
            className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-gray-50 to-blue-100 p-4"
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
        >
            <div className="w-28 h-28 md:w-32 md:h-32 rounded-full bg-white flex items-center justify-center mb-4 md:mb-6 shadow-lg border-4 border-white">
                <CleverMonkeyIcon className="w-16 h-16 md:w-20 md:h-20 text-blue-600" />
            </div>
            <div className="text-center mb-6 md:mb-8">
                <h1 className="text-3xl md:text-4xl font-semibold text-slate-800 font-outfit">Monkey helps Kangmul+Joan</h1>
                <p className="text-lg md:text-xl text-slate-600 mt-1 md:mt-2">Your personal AI tutor for any document</p>
            </div>
            
            <div 
                onClick={handleClick}
                className={`relative w-full max-w-lg p-6 md:p-10 bg-white rounded-2xl shadow-lg border-2 border-dashed transition-all duration-300 cursor-pointer ${isDragging ? 'border-blue-500 bg-blue-50' : 'border-slate-300 hover:border-blue-400'}`}
            >
                <div className="flex flex-col items-center justify-center text-center">
                    <div className={`p-3 md:p-4 rounded-full transition-colors ${isDragging ? 'bg-blue-100' : 'bg-slate-100'}`}>
                        <UploadIcon className="text-5xl md:text-6xl text-slate-500"/>
                    </div>
                    <p className="mt-4 text-lg md:text-xl font-semibold text-slate-700">Drop your PDF, Image, TXT, or MD file here</p>
                    <p className="text-sm text-slate-500 mt-1">Upload any study material (PDFs, lecture notes, textbook chapters, text files) and start learning with your personal AI tutor.</p>
                </div>
                <input
                    ref={inputRef}
                    type="file"
                    className="hidden"
                    accept="application/pdf,image/jpeg,image/png,image/webp,image/heic,image/heif,text/plain,text/markdown,.txt,.md"
                    onChange={handleFileChange}
                />
            </div>
            
            <p className="text-center text-slate-500 mt-6 md:mt-8">
                Clever Monkey will analyze your document and help you understand it
                <br />
                through interactive Q&A
            </p>
        </div>
    );
};