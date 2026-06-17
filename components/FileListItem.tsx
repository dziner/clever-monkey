import * as React from 'react';
import { DocumentData } from '../types';
import {
    PictureAsPdfIcon, ImageIcon, TextSnippetIcon, TrashIcon, ErrorOutlineIcon, EditIcon,
} from './icons';

const formatBytes = (bytes: number, decimals = 1) => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
};

const FileTypeIcon: React.FC<{ fileType: DocumentData['fileType']; className?: string }> = ({ fileType, className = '' }) => {
    if (fileType === 'pdf') return <PictureAsPdfIcon className={`text-danger-500 ${className}`} />;
    if (fileType === 'image') return <ImageIcon className={`text-brand-500 ${className}`} />;
    return <TextSnippetIcon className={`text-info-500 ${className}`} />;
};

const ProcessingBadge: React.FC<{ state: DocumentData['processingState'] }> = ({ state }) => {
    if (state === 'done' || state === 'error') return null;
    return (
        <span className="inline-block w-1.5 h-1.5 rounded-full bg-brand-500 animate-pulse flex-shrink-0" title="Processing…" />
    );
};

function isPdfPageContentWarning(message?: string): boolean {
    return Boolean(message?.includes('페이지의 내용이 이미지로 구성된 PDF 파일'));
}

interface FileListItemProps {
    doc: DocumentData;
    isActive: boolean;
    onClick: () => void;
    onDelete: () => void;
    onRename?: (docId: string, newName: string) => void;
    onDragStart: (e: React.DragEvent, docId: string) => void;
    onDragEnd: () => void;
}

export const FileListItem: React.FC<FileListItemProps> = React.memo(({
    doc, isActive, onClick, onDelete, onRename, onDragStart, onDragEnd,
}) => {
    const [isEditing, setIsEditing] = React.useState(false);
    const [editingName, setEditingName] = React.useState(doc.fileName);
    const isWarning = doc.processingState === 'error' && isPdfPageContentWarning(doc.errorMessage);

    const startRename = () => { setEditingName(doc.fileName); setIsEditing(true); };
    const confirmRename = () => {
        const trimmed = editingName.trim();
        if (trimmed && trimmed !== doc.fileName) onRename?.(doc.id, trimmed);
        setIsEditing(false);
    };
    const cancelRename = () => { setEditingName(doc.fileName); setIsEditing(false); };
    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') confirmRename();
        else if (e.key === 'Escape') cancelRename();
    };

    return (
        <div
            draggable={!isEditing}
            onDragStart={(e) => onDragStart(e, doc.id)}
            onDragEnd={onDragEnd}
            onClick={isEditing ? undefined : onClick}
            className={[
                'group relative flex w-full items-center gap-2 py-2 pr-3 transition-colors',
                isActive && !isEditing ? 'rounded-l-none rounded-r-xl pl-4' : 'rounded-xl pl-3',
                isEditing ? '' : 'cursor-pointer',
                isActive
                    ? 'bg-brand-50 text-brand-700 ring-1 ring-brand-100'
                    : 'text-ink-700 hover:bg-ink-100/70',
            ].join(' ')}
        >
            {/* Active indicator bar */}
            {isActive && !isEditing && (
                <span className="absolute left-0 top-0 bottom-0 w-1 rounded-r-full bg-brand-600" />
            )}

            <div className="flex items-center min-w-0 gap-2.5 flex-1">
                <FileTypeIcon fileType={doc.fileType} className="text-xl flex-shrink-0" />
                <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                        {isEditing ? (
                            <input
                                type="text"
                                value={editingName}
                                onChange={(e) => setEditingName(e.target.value)}
                                onBlur={confirmRename}
                                onKeyDown={handleKeyDown}
                                onClick={(e) => e.stopPropagation()}
                                autoFocus
                                className="text-sm font-semibold text-ink-900 bg-white border border-brand-400 rounded-md px-1.5 py-0.5 -my-0.5 w-full min-w-0 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                            />
                        ) : (
                            <>
                                <p className="text-sm font-medium truncate">{doc.fileName}</p>
                                <ProcessingBadge state={doc.processingState} />
                                {doc.processingState === 'error' && (
                                    <ErrorOutlineIcon
                                        className={`${isWarning ? 'text-amber-500' : 'text-danger-500'} text-base flex-shrink-0`}
                                        title={isWarning ? '업로드 안내' : 'Processing failed'}
                                    />
                                )}
                            </>
                        )}
                    </div>
                    {!isEditing && (
                        <div className="flex items-center text-[11px] text-ink-400 gap-1.5 mt-0.5">
                            <span>{formatBytes(doc.fileSize)}</span>
                            {doc.tokenCount && doc.tokenCount > 0 && (
                                <>
                                    <span>·</span>
                                    <span>{doc.tokenCount.toLocaleString()} tokens</span>
                                </>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {!isEditing && (
                <div
                    className={[
                        'absolute right-2 top-1/2 z-10 flex -translate-y-1/2 items-center gap-0.5 rounded-xl px-1 py-1',
                        'opacity-0 shadow-soft transition-opacity group-hover:opacity-100 focus-within:opacity-100',
                        isActive ? 'bg-brand-50/95' : 'bg-white/95',
                    ].join(' ')}
                >
                    {onRename && (
                        <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); startRename(); }}
                            className="p-1.5 rounded-lg text-ink-400 hover:text-ink-700 hover:bg-ink-100 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                            aria-label={`Rename ${doc.fileName}`}
                            title="이름 수정"
                        >
                            <EditIcon className="text-sm" />
                        </button>
                    )}
                    <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); onDelete(); }}
                        className="p-1.5 rounded-lg text-ink-400 hover:text-danger-600 hover:bg-danger-50 focus:outline-none focus:ring-2 focus:ring-danger-500/20"
                        aria-label={`Delete ${doc.fileName}`}
                        title="삭제"
                    >
                        <TrashIcon className="text-sm" />
                    </button>
                </div>
            )}
        </div>
    );
});
FileListItem.displayName = 'FileListItem';
