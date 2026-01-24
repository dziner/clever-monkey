// Fix: Use namespace import for React to resolve JSX intrinsic element errors.
import * as React from 'react';
import { useDocuments } from '../contexts/DocumentContext';
import { AddIcon, FolderPlusIcon, CleverMonkeyIcon, ChevronLeftIcon, XIcon } from './icons';
import type { DocumentData } from '../types';
import { supabase } from '../services/supabaseClient';
import { FolderItem } from './FolderItem';

interface FileListPanelProps {
    onFileSelected: (file: File) => void;
    setIsPanelCollapsed: (isCollapsed: boolean) => void;
    isDesktop?: boolean;
}

export const FileListPanel: React.FC<FileListPanelProps> = ({ onFileSelected, setIsPanelCollapsed, isDesktop }) => {
    const { state, dispatch } = useDocuments();
    const inputRef = React.useRef<HTMLInputElement>(null);
    
    const [draggedItemId, setDraggedItemId] = React.useState<string | null>(null);
    const [dropTargetId, setDropTargetId] = React.useState<string | null>(null);
    
    const totalTokens = React.useMemo(() => {
        return state.documents.reduce((acc, doc) => acc + (doc.tokenCount || 0), 0);
    }, [state.documents]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            onFileSelected(e.target.files[0]);
            if (!isDesktop) setIsPanelCollapsed(true);
        }
    };
    
    const handleDeleteDocument = async (docId: string) => {
        const targetDoc = state.documents.find(doc => doc.id === docId);
        dispatch({ type: 'DELETE_DOCUMENT', payload: { docId } });

        const { data: { user }, error: userError } = await supabase.auth.getUser();
        if (userError) {
            console.error('사용자 정보를 불러오지 못했습니다:', userError);
        }
        if (!user) {
            console.error('로그인이 필요합니다.');
            return;
        }

        const storagePath = targetDoc?.storagePath || (targetDoc ? `${user.id}/${targetDoc.fileName}` : null);
        if (storagePath) {
            const { error: storageError } = await supabase.storage.from('docs').remove([storagePath]);
            if (storageError) {
                console.error('스토리지 파일 삭제에 실패했습니다:', storageError);
            }
        }

        const { error: deleteError } = await supabase
            .from('documents')
            .delete()
            .eq('id', docId)
            .eq('user_id', user.id);

        if (deleteError) {
            console.error('문서 메타데이터 삭제에 실패했습니다:', deleteError);
        }
    };

    const handleAddNewFolder = async () => {
        let newName = "New Folder";
        let counter = 1;
        const existingNames = new Set(state.folders.map(f => f.name));
        while (existingNames.has(newName)) {
            newName = `New Folder (${counter++})`;
        }

        const { data: { user }, error: userError } = await supabase.auth.getUser();
        if (userError) {
            console.error('사용자 정보를 불러오지 못했습니다:', userError);
        }
        if (!user) {
            console.error('로그인이 필요합니다.');
            return;
        }

        const newFolder = { id: `folder-${Date.now()}`, name: newName };
        const { error: insertError } = await supabase
            .from('folders')
            .insert({ id: newFolder.id, name: newFolder.name, user_id: user.id });

        if (insertError) {
            console.error('폴더 생성에 실패했습니다:', insertError);
            return;
        }

        dispatch({ type: 'ADD_FOLDER', payload: newFolder });
    };

    const handleDragStart = (e: React.DragEvent, docId: string) => {
        e.dataTransfer.effectAllowed = 'move';
        setDraggedItemId(docId);
    };

    const handleDragEnd = () => {
        setDraggedItemId(null);
        setDropTargetId(null);
    };

    const handleDragOver = (e: React.DragEvent, folderId: string | null) => {
        e.preventDefault();
        if (draggedItemId) {
            setDropTargetId(folderId);
        }
    };
    
    const handleDrop = async (e: React.DragEvent, folderId: string | null) => {
        e.preventDefault();
        if (draggedItemId) {
            dispatch({ type: 'MOVE_DOCUMENT_TO_FOLDER', payload: { docId: draggedItemId, folderId } });

            const { data: { user }, error: userError } = await supabase.auth.getUser();
            if (userError) {
                console.error('사용자 정보를 불러오지 못했습니다:', userError);
            }
            if (!user) {
                console.error('로그인이 필요합니다.');
            } else {
                const { error: updateError } = await supabase
                    .from('documents')
                    .update({ folder_id: folderId })
                    .eq('id', draggedItemId)
                    .eq('user_id', user.id);

                if (updateError) {
                    console.error('문서 폴더 이동에 실패했습니다:', updateError);
                }
            }
        }
        setDropTargetId(null);
        setDraggedItemId(null);
    };

    const handleDragLeave = () => {
        setDropTargetId(null);
    };

    const docsByFolder = React.useMemo(() => {
        const map = new Map<string, DocumentData[]>();
        state.folders.forEach(f => map.set(f.id, []));
        state.documents.forEach(doc => {
            if (doc.folderId && map.has(doc.folderId)) {
                map.get(doc.folderId)!.push(doc);
            }
        });
        return map;
    }, [state.documents, state.folders]);


    return (
        <div className="flex flex-col h-full bg-slate-50">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-slate-200 flex-shrink-0">
                <div className="flex items-center gap-3">
                    <CleverMonkeyIcon className="w-8 h-8 text-blue-600" />
                    <div>
                        <span className="font-bold text-slate-800 text-xl font-outfit">Clever Monkey</span>
                        <p className="text-xs text-slate-500 -mt-1">Kangmul+Joan's AI Study Pal</p>
                    </div>
                </div>
                <button
                    onClick={() => setIsPanelCollapsed(true)}
                    className="p-2 text-slate-500 hover:bg-slate-200 rounded-lg"
                    title="Collapse file list"
                    aria-label="Collapse file list"
                >
                    {isDesktop ? <ChevronLeftIcon className="text-2xl" /> : <XIcon className="text-2xl" />}
                </button>
            </div>
            
             {/* Action Buttons */}
            <div className="p-3 border-b border-slate-200 grid grid-cols-2 gap-2 flex-shrink-0">
                <button
                    onClick={() => inputRef.current?.click()}
                    className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-white text-slate-700 rounded-lg font-semibold hover:bg-slate-100 transition-colors border border-slate-300 shadow-sm text-sm"
                >
                    <AddIcon className="text-xl" />
                    <span>Document</span>
                </button>
                <button
                    onClick={handleAddNewFolder}
                    className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-white text-slate-700 rounded-lg font-semibold hover:bg-slate-100 transition-colors border border-slate-300 shadow-sm text-sm"
                >
                    <FolderPlusIcon className="text-xl" />
                    <span>Folder</span>
                </button>
            </div>


            {/* File List */}
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
                 {state.folders.map(folder => (
                    <FolderItem
                        key={folder.id}
                        folder={folder}
                        documents={docsByFolder.get(folder.id) || []}
                        isDropTarget={dropTargetId === folder.id}
                        isDesktop={isDesktop}
                        onDeleteDocument={handleDeleteDocument}
                        onDragStart={handleDragStart}
                        onDragEnd={handleDragEnd}
                        onDragOver={handleDragOver}
                        onDrop={handleDrop}
                        onDragLeave={handleDragLeave}
                        setIsPanelCollapsed={setIsPanelCollapsed}
                    />
                 ))}
            </div>
            
            <div className="flex-shrink-0 p-3 border-t border-slate-200 text-xs text-slate-500">
                <div className="flex justify-between items-center mb-2 font-medium">
                    <span className="font-semibold">Total Usage</span>
                    <span className="font-mono">{totalTokens.toLocaleString()} tokens</span>
                </div>
            </div>

            {/* Hidden File Input */}
            <input
                ref={inputRef}
                type="file"
                className="hidden"
                accept="application/pdf,image/jpeg,image/png,image/webp,image/heic,image/heif,text/plain,text/markdown,.txt,.md"
                onChange={handleFileChange}
            />
        </div>
    );
};
