import * as React from 'react';
import { DocumentData } from '../types';
import { PictureAsPdfIcon, ImageIcon, TextSnippetIcon, TrashIcon, ErrorOutlineIcon } from './icons';

const formatBytes = (bytes: number, decimals = 1) => {
    if (!bytes || bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
};

const FileTypeIcon: React.FC<{ fileType: DocumentData['fileType']; className?: string }> = ({ fileType, className = '' }) => {
    if (fileType === 'pdf') return <PictureAsPdfIcon className={`text-red-400 ${className}`} />;
    if (fileType === 'image') return <ImageIcon className={`text-purple-400 ${className}`} />;
    return <TextSnippetIcon className={`text-blue-400 ${className}`} />;
};

const ProcessingBadge: React.FC<{ state: DocumentData['processingState'] }> = ({ state }) => {
    if (state === 'done' || state === 'error') return null;
    return (
        <span className="inline-block w-2 h-2 rounded-full bg-blue-400 animate-pulse flex-shrink-0" title="Processing…" />
    );
};

interface FileListItemProps {
    doc: DocumentData,
    isActive: boolean,
    onClick: () => void,
    onDelete: () => void;
    onDragStart: (e: React.DragEvent, docId: string) => void;
    onDragEnd: () => void;
}

export const FileListItem: React.FC<FileListItemProps> = React.memo(({ doc, isActive, onClick, onDelete, onDragStart, onDragEnd }) => (
    <div
        draggable="true"
        onDragStart={(e) => onDragStart(e, doc.id)}
        onDragEnd={onDragEnd}
        onClick={onClick}
        className={`group flex items-center justify-between w-full pl-8 pr-2 py-1.5 rounded-lg cursor-pointer ${isActive ? 'bg-blue-50 text-blue-700' : 'text-slate-700 hover:bg-slate-200'}`}
    >
        <div className="flex items-center min-w-0 gap-2">
            <FileTypeIcon fileType={doc.fileType} className="text-xl flex-shrink-0" />
            <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                    <p className="text-sm font-medium truncate">{doc.fileName}</p>
                    <ProcessingBadge state={doc.processingState} />
                    {doc.processingState === 'error' && (
                        <ErrorOutlineIcon className="text-red-400 text-base flex-shrink-0" title="Processing failed" />
                    )}
                </div>
                <div className="flex items-center text-xs text-slate-500 gap-2">
                    <span>{formatBytes(doc.fileSize)}</span>
                    {doc.tokenCount && doc.tokenCount > 0 && (
                        <>
                            <span>•</span>
                            <span>{doc.tokenCount.toLocaleString()} tokens</span>
                        </>
                    )}
                </div>
            </div>
        </div>
        <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            className="flex-shrink-0 p-1 rounded-md text-slate-500 hover:bg-slate-300 hover:text-slate-800 opacity-0 group-hover:opacity-100 focus:opacity-100"
            aria-label={`Delete ${doc.fileName}`}
        >
            <TrashIcon className="text-base" />
        </button>
    </div>
));
