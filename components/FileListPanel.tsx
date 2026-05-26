import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { useNavigate, useLocation } from 'react-router-dom';
import { useDocuments } from '../contexts/DocumentContext';
import { useUser } from '../contexts/UserContext';
import { useTierLimits } from '../hooks/useTierLimits';
import { AddIcon, FolderPlusIcon, CleverMonkeyIcon, PanelLeftCloseIcon, XIcon, LogOutIcon, SearchIcon, TrashIcon, AdminPanelIcon, WorkspacePremiumIcon, HomeIcon } from './icons';
import type { DocumentData } from '../types';
import { supabase } from '../services/supabaseClient';
import { ROUTES } from '../routes';
import { FolderItem } from './FolderItem';
import { FileListItem } from './FileListItem';
import { useToast } from './Toast';

const NAV_GROUPS = [
    {
        heading: null,
        items: [{ path: ROUTES.STUDY, label: 'Study', icon: HomeIcon }],
    },
] as const;

interface FileListPanelProps {
    onFileSelected: (file: File) => void;
    setIsPanelCollapsed: (isCollapsed: boolean) => void;
    isDesktop?: boolean;
    onProfileClick: () => void;
    onSignOut: () => void;
    onUpgradeClick?: (reason?: 'documents' | 'ai_actions' | 'generic') => void;
    onAdminClick?: () => void;
}

export const FileListPanel: React.FC<FileListPanelProps> = ({ onFileSelected, setIsPanelCollapsed, isDesktop, onProfileClick, onSignOut, onUpgradeClick, onAdminClick }) => {
    const { state, dispatch } = useDocuments();
    const navigate = useNavigate();
    const location = useLocation();
    const { userEmail, userProfile } = useUser();
    const tierLimits = useTierLimits(state.documents.length);
    const planName = tierLimits.isPro ? 'Pro' : 'Free';
    const { showToast } = useToast();
    const inputRef = React.useRef<HTMLInputElement>(null);

    const [searchQuery, setSearchQuery] = React.useState('');
    const [draggedItemId, setDraggedItemId] = React.useState<string | null>(null);
    const [dropTargetId, setDropTargetId] = React.useState<string | null>(null);
    const [confirmDelete, setConfirmDelete] = React.useState<{ docId: string; fileName: string } | null>(null);
    const deletingIdsRef = React.useRef(new Set<string>());
    const isCreatingFolderRef = React.useRef(false);
    
    const totalTokens = React.useMemo(() => {
        return state.documents.reduce((acc, doc) => acc + (doc.tokenCount || 0), 0);
    }, [state.documents]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            if (tierLimits.isAtDocumentLimit(state.documents.length)) {
                onUpgradeClick?.('documents');
                e.target.value = '';
                return;
            }
            onFileSelected(e.target.files[0]);
            if (!isDesktop) setIsPanelCollapsed(true);
        }
    };
    
    const requestDeleteDocument = (docId: string) => {
        const doc = state.documents.find(d => d.id === docId);
        if (!doc) return;
        setConfirmDelete({ docId, fileName: doc.fileName });
    };

    const handleDeleteDocument = async (docId: string) => {
        setConfirmDelete(null);
        if (deletingIdsRef.current.has(docId)) return;
        const targetDoc = state.documents.find(doc => doc.id === docId);
        deletingIdsRef.current.add(docId);
        dispatch({ type: 'DELETE_DOCUMENT', payload: { docId } });

        try {
            const { data: { user }, error: userError } = await supabase.auth.getUser();
            if (userError) {
                console.error('사용자 정보를 불러오지 못했습니다:', userError);
            }
            if (!user) {
                console.error('로그인이 필요합니다.');
                showToast('Failed to delete document', 'error');
                deletingIdsRef.current.delete(docId);
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
                showToast('Failed to delete document', 'error');
            } else {
                showToast('Document deleted', 'success');
            }
        } catch {
            showToast('Failed to delete document', 'error');
        }
        deletingIdsRef.current.delete(docId);
    };

    const handleRenameDocument = async (docId: string, newName: string) => {
        const trimmed = newName.trim();
        if (!trimmed) return;
        dispatch({ type: 'UPDATE_DOCUMENT', payload: { docId, updates: { fileName: trimmed } } });

        const { data: { user }, error: userError } = await supabase.auth.getUser();
        if (userError) console.error('사용자 정보를 불러오지 못했습니다:', userError);
        if (!user) {
            console.error('로그인이 필요합니다.');
            showToast('Failed to rename document', 'error');
            return;
        }

        const { error: updateError } = await supabase
            .from('documents')
            .update({ file_name: trimmed })
            .eq('id', docId)
            .eq('user_id', user.id);

        if (updateError) {
            console.error('문서 이름 변경에 실패했습니다:', updateError);
            showToast('Failed to rename document', 'error');
        }
    };

    const handleAddNewFolder = async () => {
        if (isCreatingFolderRef.current) return;
        isCreatingFolderRef.current = true;
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
            isCreatingFolderRef.current = false;
            return;
        }

        dispatch({ type: 'ADD_FOLDER', payload: newFolder });
        isCreatingFolderRef.current = false;
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

    const unfiledDocs = React.useMemo(() => {
        return state.documents.filter(doc => !doc.folderId);
    }, [state.documents]);

    const filteredDocs = React.useMemo(() => {
        if (!searchQuery.trim()) return null;
        const q = searchQuery.toLowerCase();
        return state.documents.filter(doc => doc.fileName.toLowerCase().includes(q));
    }, [state.documents, searchQuery]);


    return (
        <>
        {/* Delete confirmation modal — portalled to document.body to escape stacking contexts */}
        {confirmDelete && ReactDOM.createPortal(
            <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
                <button
                    type="button"
                    className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                    onClick={() => setConfirmDelete(null)}
                    aria-label="Cancel"
                />
                <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 flex flex-col gap-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                            <TrashIcon className="text-red-600 text-xl" />
                        </div>
                        <div>
                            <p className="font-bold text-slate-800 text-sm">Delete document?</p>
                            <p className="text-slate-500 text-xs mt-0.5 leading-snug">
                                This will permanently delete <span className="font-semibold text-slate-700">"{confirmDelete.fileName}"</span> and all associated data.
                            </p>
                        </div>
                    </div>
                    <div className="flex gap-2 justify-end">
                        <button
                            type="button"
                            onClick={() => setConfirmDelete(null)}
                            className="px-4 py-2 rounded-lg text-sm font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            onClick={() => handleDeleteDocument(confirmDelete.docId)}
                            className="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-red-600 hover:bg-red-700 transition-colors"
                        >
                            Delete
                        </button>
                    </div>
                </div>
            </div>,
            document.body
        )}
        <div className="flex flex-col h-full bg-white">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-6 flex-shrink-0">
                <div className="flex items-center gap-3">
                    <CleverMonkeyIcon className="w-9 h-9 text-blue-600 flex-shrink-0" />
                    <div>
                        <span className="block font-bold text-slate-900 text-lg font-outfit leading-tight tracking-tight">Clever Monkey</span>
                        <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">Sources</p>
                    </div>
                </div>
                <button
                    type="button"
                    onClick={() => setIsPanelCollapsed(true)}
                    className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                    title="Collapse sources panel"
                    aria-label="Collapse sources panel"
                >
                    {isDesktop ? <PanelLeftCloseIcon /> : <XIcon className="text-xl" />}
                </button>
            </div>

            {/* App navigation — desktop sidebar (mobile uses the bottom tab bar) */}
            {isDesktop && (
                <nav className="px-3 pb-4 flex-shrink-0">
                    {NAV_GROUPS.map((group, gi) => (
                        <div key={group.heading ?? `nav-group-${gi}`} className={gi > 0 ? 'mt-3' : ''}>
                            {group.heading && (
                                <div className="px-3 mb-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                    {group.heading}
                                </div>
                            )}
                            <div className="space-y-0.5">
                                {group.items.map(item => {
                                    const isActive = location.pathname === item.path;
                                    return (
                                        <button
                                            key={item.path}
                                            type="button"
                                            onClick={() => navigate(item.path)}
                                            className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-semibold transition-colors ${
                                                isActive
                                                    ? 'bg-blue-50 text-blue-700'
                                                    : 'text-slate-600 hover:bg-slate-100'
                                            }`}
                                        >
                                            <item.icon className="text-xl flex-shrink-0" />
                                            <span className="truncate">{item.label}</span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </nav>
            )}

            <div className="px-5 pb-6 flex-shrink-0">
                <div className="grid grid-cols-2 gap-3">
                    <button
                        type="button"
                        onClick={() => inputRef.current?.click()}
                        className="flex flex-col items-center justify-center gap-2 p-3 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-xl font-semibold transition-all duration-200 border border-blue-100 hover:border-blue-200 shadow-sm hover:shadow-md group"
                    >
                        <AddIcon className="text-2xl group-hover:scale-110 transition-transform" />
                        <span className="text-xs">New PDF</span>
                    </button>
                    <button
                        type="button"
                        onClick={handleAddNewFolder}
                        className="flex flex-col items-center justify-center gap-2 p-3 bg-white hover:bg-slate-50 text-slate-600 rounded-xl font-semibold transition-all duration-200 border border-slate-200 hover:border-slate-300 shadow-sm hover:shadow-md group"
                    >
                        <FolderPlusIcon className="text-2xl group-hover:scale-110 transition-transform text-slate-400 group-hover:text-slate-600" />
                        <span className="text-xs">New Folder</span>
                    </button>
                </div>
            </div>

            {/* Search */}
            <div className="px-5 pb-3 flex-shrink-0">
                <div className="relative">
                    <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-base" />
                    <input
                        type="text"
                        placeholder="Search documents..."
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        className="w-full pl-8 pr-8 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-400 text-slate-700 placeholder-slate-400"
                    />
                    {searchQuery && (
                        <button type="button" onClick={() => setSearchQuery('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                            <XIcon className="text-base" />
                        </button>
                    )}
                </div>
            </div>

            {/* File List */}
            <div className="flex-1 overflow-y-auto px-3 space-y-1 scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-transparent">
                 <div className="px-2 mb-2 text-xs font-bold text-slate-400 uppercase tracking-wider">My Library</div>
                 {filteredDocs !== null ? (
                    filteredDocs.length === 0 ? (
                        <div className="px-2 py-4 text-sm text-slate-400 text-center">No results</div>
                    ) : (
                        filteredDocs.map(doc => (
                            <FileListItem
                                key={doc.id}
                                doc={doc}
                                isActive={doc.id === state.activeDocumentId}
                                onClick={() => {
                                    dispatch({ type: 'SET_ACTIVE_DOCUMENT', payload: { docId: doc.id } });
                                    if (!isDesktop) setIsPanelCollapsed(true);
                                }}
                                onDelete={() => requestDeleteDocument(doc.id)}
                                onRename={handleRenameDocument}
                                onDragStart={handleDragStart}
                                onDragEnd={handleDragEnd}
                            />
                        ))
                    )
                 ) : (
                    <>
                        {state.folders.map(folder => (
                            <FolderItem
                                key={folder.id}
                                folder={folder}
                                documents={docsByFolder.get(folder.id) || []}
                                isDropTarget={dropTargetId === folder.id}
                                isDesktop={isDesktop}
                                onDeleteDocument={requestDeleteDocument}
                                onRenameDocument={handleRenameDocument}
                                onDragStart={handleDragStart}
                                onDragEnd={handleDragEnd}
                                onDragOver={handleDragOver}
                                onDrop={handleDrop}
                                onDragLeave={handleDragLeave}
                                setIsPanelCollapsed={setIsPanelCollapsed}
                            />
                        ))}
                        {unfiledDocs.length > 0 && (
                            <div
                                onDragOver={(e) => handleDragOver(e, null)}
                                onDrop={(e) => handleDrop(e, null)}
                                onDragLeave={handleDragLeave}
                                className={`rounded-lg transition-colors ${dropTargetId === null && draggedItemId ? 'bg-blue-100' : ''}`}
                            >
                                {unfiledDocs.map(doc => (
                                    <FileListItem
                                        key={doc.id}
                                        doc={doc}
                                        isActive={doc.id === state.activeDocumentId}
                                        onClick={() => {
                                            dispatch({ type: 'SET_ACTIVE_DOCUMENT', payload: { docId: doc.id } });
                                            if (!isDesktop) setIsPanelCollapsed(true);
                                        }}
                                        onDelete={() => requestDeleteDocument(doc.id)}
                                        onRename={handleRenameDocument}
                                        onDragStart={handleDragStart}
                                        onDragEnd={handleDragEnd}
                                    />
                                ))}
                            </div>
                        )}
                    </>
                 )}
            </div>
            
            <div className="flex-shrink-0 p-4 border-t border-slate-100 bg-slate-50/50 space-y-3">
                {/* Document usage bar */}
                <div>
                    <div className="flex justify-between items-center mb-1">
                        <span className="text-xs font-semibold text-slate-500">문서</span>
                        <span className="text-xs font-mono font-medium text-slate-600">
                            {state.documents.length}{tierLimits.maxDocuments !== Infinity ? ` / ${tierLimits.maxDocuments}` : ''}
                        </span>
                    </div>
                    {tierLimits.maxDocuments !== Infinity && (
                        <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                            <div
                                className={`h-1.5 rounded-full transition-all ${
                                    tierLimits.isAtDocumentLimit(state.documents.length) ? 'bg-red-500' : 'bg-blue-500'
                                }`}
                                style={{ width: `${Math.min((state.documents.length / tierLimits.maxDocuments) * 100, 100)}%` }}
                            />
                        </div>
                    )}
                </div>

                {/* AI usage */}
                {!tierLimits.isPro && userProfile && (
                    <div>
                        <div className="flex justify-between items-center mb-1">
                            <span className="text-xs font-semibold text-slate-500">AI 사용</span>
                            <span className={`text-xs font-mono font-medium ${tierLimits.isAtAiLimit ? 'text-red-600' : 'text-slate-600'}`}>
                                {tierLimits.aiActionsToday} / {tierLimits.maxAiActionsPerDay}
                            </span>
                        </div>
                        <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                            <div
                                className={`h-1.5 rounded-full transition-all ${tierLimits.isAtAiLimit ? 'bg-red-500' : 'bg-green-500'}`}
                                style={{ width: `${Math.min((tierLimits.aiActionsToday / tierLimits.maxAiActionsPerDay) * 100, 100)}%` }}
                            />
                        </div>
                        {tierLimits.isAtAiLimit && (
                            <button
                                type="button"
                                onClick={() => onUpgradeClick?.('ai_actions')}
                                className="mt-1.5 w-full text-xs text-center text-blue-600 font-semibold hover:underline"
                            >
                                Pro로 업그레이드 →
                            </button>
                        )}
                    </div>
                )}

                {/* Admin quick-access */}
                {onAdminClick && (
                    <button
                        type="button"
                        onClick={onAdminClick}
                        className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-orange-700 bg-orange-50 border border-orange-200 rounded-xl hover:bg-orange-100 transition-colors"
                    >
                        <AdminPanelIcon className="text-base" />
                        Admin Panel
                    </button>
                )}

                {/* Profile / logout */}
                {userEmail && (
                    <button
                        type="button"
                        onClick={onProfileClick}
                        className="w-full flex items-center gap-3 p-3 bg-white border border-slate-200 rounded-xl hover:bg-slate-100 transition-colors"
                    >
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm shadow-inner flex-shrink-0 ${
                            tierLimits.isPro ? 'bg-violet-100 text-violet-700' : 'bg-blue-100 text-blue-600'
                        }`}>
                            {userEmail[0].toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0 text-left">
                            <p className="text-xs font-bold text-slate-700 truncate" title={userEmail}>{userEmail}</p>
                            <div className="flex items-center gap-1.5 mt-0.5">
                                <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-bold uppercase tracking-wider border ${
                                    tierLimits.isPro
                                        ? 'bg-violet-100 text-violet-700 border-violet-200'
                                        : 'bg-blue-100 text-blue-700 border-blue-200'
                                }`}>{planName}</span>
                                {!tierLimits.isPro && onUpgradeClick && (
                                    <button
                                        type="button"
                                        onClick={e => { e.stopPropagation(); onUpgradeClick('generic'); }}
                                        className="text-[10px] text-slate-400 hover:text-violet-600 font-semibold flex items-center gap-0.5 transition-colors"
                                    >
                                        <WorkspacePremiumIcon className="text-xs" /> 업그레이드
                                    </button>
                                )}
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={e => { e.stopPropagation(); onSignOut(); }}
                            className="flex-shrink-0 p-1.5 rounded-lg text-slate-400 hover:bg-slate-200 hover:text-slate-600 transition-colors"
                            title="Log out"
                            aria-label="Log out"
                        >
                            <LogOutIcon className="text-base" />
                        </button>
                    </button>
                )}
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
        </>
    );
};
