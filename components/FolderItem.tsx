import * as React from 'react';
import { useDocuments } from '../contexts/DocumentContext';
import { DocumentData, Folder } from '../types';
import { supabase } from '../services/supabaseClient';
import { FileListItem } from './FileListItem';
import { FolderIcon, ChevronDownIcon, ChevronRightIcon, EditIcon, TrashIcon, CheckIcon, XIcon } from './icons';

interface FolderItemProps {
    folder: Folder;
    documents: DocumentData[];
    isDropTarget: boolean;
    isDesktop?: boolean;
    onDeleteDocument: (docId: string) => void;
    onDragStart: (e: React.DragEvent, docId: string) => void;
    onDragEnd: () => void;
    onDragOver: (e: React.DragEvent, folderId: string | null) => void;
    onDrop: (e: React.DragEvent, folderId: string | null) => void;
    onDragLeave: () => void;
    setIsPanelCollapsed: (isCollapsed: boolean) => void;
}

export const FolderItem: React.FC<FolderItemProps> = React.memo(({
    folder, documents, isDropTarget, isDesktop, onDeleteDocument,
    onDragStart, onDragEnd, onDragOver, onDrop, onDragLeave, setIsPanelCollapsed
}) => {
    const { state, dispatch } = useDocuments();
    
    // Local state for UI interactions specific to this folder
    const [isExpanded, setIsExpanded] = React.useState(() => {
        return state.activeFolderId === folder.id || (state.folders.length > 0 && state.folders[0].id === folder.id);
    });
    const [isEditing, setIsEditing] = React.useState(false);
    const [editingName, setEditingName] = React.useState(folder.name);
    const [isConfirmingDelete, setIsConfirmingDelete] = React.useState(false);

    const isFolderActive = state.activeFolderId === folder.id;

    // Effect to expand the folder if the active document changes and is inside this folder
    React.useEffect(() => {
        const activeDoc = state.documents.find(d => d.id === state.activeDocumentId);
        if (activeDoc && activeDoc.folderId === folder.id) {
            setIsExpanded(true);
        }
    }, [state.activeDocumentId, state.documents, folder.id]);

    const handleSelectFolder = () => dispatch({ type: 'SET_ACTIVE_FOLDER', payload: { folderId: folder.id } });
    
    const handleStartRename = () => {
        setIsConfirmingDelete(false);
        setIsEditing(true);
        setEditingName(folder.name);
    };

    const handleCancelRename = () => {
        setIsEditing(false);
        setEditingName(folder.name);
    };

    const handleConfirmRename = async () => {
        const trimmedName = editingName.trim();
        if (trimmedName && trimmedName !== folder.name) {
            dispatch({ type: 'RENAME_FOLDER', payload: { folderId: folder.id, newName: trimmedName } });

            const { data: { user }, error: userError } = await supabase.auth.getUser();
            if (userError) {
                console.error('사용자 정보를 불러오지 못했습니다:', userError);
            }
            if (!user) {
                console.error('로그인이 필요합니다.');
            } else {
                const { error: updateError } = await supabase
                    .from('folders')
                    .update({ name: trimmedName })
                    .eq('id', folder.id)
                    .eq('user_id', user.id);

                if (updateError) {
                    console.error('폴더 이름 변경에 실패했습니다:', updateError);
                }
            }
        }
        setIsEditing(false);
    };

    const handleRenameKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') handleConfirmRename();
        else if (e.key === 'Escape') handleCancelRename();
    };

    const handleDeleteFolder = async () => {
        if (isConfirmingDelete) {
            dispatch({ type: 'DELETE_FOLDER', payload: { folderId: folder.id } });
            setIsConfirmingDelete(false);

            const remainingFolders = state.folders.filter(f => f.id !== folder.id);
            const fallbackFolderId = remainingFolders.length > 0 ? remainingFolders[0].id : null;
            const affectedDocs = state.documents.filter(doc => doc.folderId === folder.id);

            const { data: { user }, error: userError } = await supabase.auth.getUser();
            if (userError) {
                console.error('사용자 정보를 불러오지 못했습니다:', userError);
            }
            if (!user) {
                console.error('로그인이 필요합니다.');
                return;
            }

            const { error: deleteError } = await supabase
                .from('folders')
                .delete()
                .eq('id', folder.id)
                .eq('user_id', user.id);

            if (deleteError) {
                console.error('폴더 삭제에 실패했습니다:', deleteError);
            }

            if (affectedDocs.length > 0) {
                const { error: moveError } = await supabase
                    .from('documents')
                    .update({ folder_id: fallbackFolderId })
                    .in('id', affectedDocs.map(doc => doc.id))
                    .eq('user_id', user.id);

                if (moveError) {
                    console.error('문서 폴더 이동에 실패했습니다:', moveError);
                }
            }
        } else {
            handleCancelRename();
            setIsConfirmingDelete(true);
        }
    };

    return (
        <div>
            <div
                onClick={() => !isEditing && handleSelectFolder()}
                onDragOver={(e) => onDragOver(e, folder.id)}
                onDrop={(e) => onDrop(e, folder.id)}
                onDragLeave={onDragLeave}
                className={`group flex items-center justify-between w-full pr-2 py-1.5 rounded-lg transition-colors cursor-pointer ${
                    isDropTarget ? 'bg-blue-200' : isFolderActive ? 'bg-blue-100' : 'hover:bg-slate-200'
                }`}
            >
                <div className="flex items-center flex-1 min-w-0">
                    <button type="button" onClick={(e) => { e.stopPropagation(); if (!isEditing) setIsExpanded(v => !v); }} className="p-1 rounded-md text-slate-500 hover:bg-slate-300 disabled:cursor-not-allowed" disabled={isEditing}>
                         {isExpanded ? <ChevronDownIcon className="text-base"/> : <ChevronRightIcon className="text-base"/>}
                    </button>
                    <FolderIcon className="text-xl text-slate-500 mx-1 flex-shrink-0" />
                    <div className="flex items-baseline min-w-0 flex-1">
                        {isEditing ? (
                            <input
                               type="text"
                               value={editingName}
                               onChange={(e) => setEditingName(e.target.value)}
                               onBlur={handleConfirmRename}
                               onKeyDown={handleRenameKeyDown}
                               autoFocus
                               className="text-sm font-semibold text-slate-900 bg-white border border-blue-400 rounded px-1 -my-0.5 w-full"
                               onClick={(e) => e.stopPropagation()}
                            />
                        ) : (
                           <span className={`text-sm font-semibold truncate ${isFolderActive ? 'text-blue-800' : 'text-slate-700'}`}>{folder.name}</span>
                        )}
                        {!isEditing && documents.length > 0 && <span className="ml-2 text-xs font-mono text-slate-500">{documents.length}</span>}
                    </div>
                </div>

                <div className="flex items-center flex-shrink-0">
                    {isConfirmingDelete ? (
                        <div className="flex items-center animate-pulse">
                            <span className="text-xs text-red-600 font-semibold mr-1">Sure?</span>
                            <button type="button" onClick={(e) => { e.stopPropagation(); handleDeleteFolder(); }} className="p-1 text-green-600 hover:bg-green-100 rounded"><CheckIcon className="text-xl"/></button>
                            <button type="button" onClick={(e) => { e.stopPropagation(); setIsConfirmingDelete(false); }} className="p-1 text-slate-500 hover:bg-slate-300 rounded"><XIcon className="text-xl"/></button>
                        </div>
                    ) : !isEditing ? (
                         <div className="flex items-center opacity-0 group-hover:opacity-100 focus-within:opacity-100">
                            <button type="button" onClick={(e) => { e.stopPropagation(); handleStartRename(); }} className="p-1 text-slate-500 hover:bg-slate-300 rounded"><EditIcon className="text-base"/></button>
                            {state.folders.length > 1 && <button type="button" onClick={(e) => { e.stopPropagation(); handleDeleteFolder(); }} className="p-1 text-slate-500 hover:bg-slate-300 rounded"><TrashIcon className="text-base"/></button>}
                        </div>
                    ) : null}
                </div>
            </div>
            {isExpanded && documents.length === 0 && (
                <div className="pl-8 pr-2 py-2 text-xs text-slate-400 italic select-none">
                    No files yet — upload one above
                </div>
            )}
            {isExpanded && documents.map(doc => (
                <FileListItem
                    key={doc.id}
                    doc={doc}
                    isActive={doc.id === state.activeDocumentId}
                    onClick={() => {
                        dispatch({ type: 'SET_ACTIVE_DOCUMENT', payload: { docId: doc.id } });
                        if (!isDesktop) setIsPanelCollapsed(true);
                    }}
                    onDelete={() => onDeleteDocument(doc.id)}
                    onDragStart={onDragStart}
                    onDragEnd={onDragEnd}
                />
            ))}
        </div>
    );
});
