import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { useNavigate, useLocation } from 'react-router-dom';
import { useDocuments } from '../contexts/DocumentContext';
import { useUser } from '../contexts/UserContext';
import { useTierLimits } from '../hooks/useTierLimits';
import {
    AddIcon, FolderPlusIcon, CleverMonkeyIcon, PanelLeftCloseIcon, XIcon, LogOutIcon,
    SearchIcon, TrashIcon, AdminPanelIcon, WorkspacePremiumIcon, HomeIcon,
} from './icons';
import type { DocumentData } from '../types';
import { supabase } from '../services/supabaseClient';
import { renameDocumentReferences } from '../services/wrongAnswersService';
import { ROUTES } from '../routes';
import { FolderItem } from './FolderItem';
import { FileListItem } from './FileListItem';
import { useToast } from './Toast';
import { Button, IconButton } from './ui/Button';
import { Badge } from './ui/Badge';

const NAV_GROUPS = [
    { heading: null, items: [{ path: ROUTES.STUDY, label: 'Study', icon: HomeIcon }] },
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

export const FileListPanel: React.FC<FileListPanelProps> = ({
    onFileSelected, setIsPanelCollapsed, isDesktop, onProfileClick, onSignOut, onUpgradeClick, onAdminClick,
}) => {
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
            if (userError) console.error('사용자 정보를 불러오지 못했습니다:', userError);
            if (!user) {
                console.error('로그인이 필요합니다.');
                showToast('Failed to delete document', 'error');
                deletingIdsRef.current.delete(docId);
                return;
            }

            const storagePath = targetDoc?.storagePath || (targetDoc ? `${user.id}/${targetDoc.fileName}` : null);
            if (storagePath) {
                const { error: storageError } = await supabase.storage.from('docs').remove([storagePath]);
                if (storageError) console.error('스토리지 파일 삭제에 실패했습니다:', storageError);
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
            return;
        }
        await renameDocumentReferences(docId, trimmed);
    };

    const handleAddNewFolder = async () => {
        if (isCreatingFolderRef.current) return;
        isCreatingFolderRef.current = true;
        let newName = 'New Folder';
        let counter = 1;
        const existingNames = new Set(state.folders.map(f => f.name));
        while (existingNames.has(newName)) newName = `New Folder (${counter++})`;

        const { data: { user }, error: userError } = await supabase.auth.getUser();
        if (userError) console.error('사용자 정보를 불러오지 못했습니다:', userError);
        if (!user) { console.error('로그인이 필요합니다.'); isCreatingFolderRef.current = false; return; }

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
    const handleDragEnd = () => { setDraggedItemId(null); setDropTargetId(null); };
    const handleDragOver = (e: React.DragEvent, folderId: string | null) => {
        e.preventDefault();
        if (draggedItemId) setDropTargetId(folderId);
    };
    const handleDrop = async (e: React.DragEvent, folderId: string | null) => {
        e.preventDefault();
        if (draggedItemId) {
            dispatch({ type: 'MOVE_DOCUMENT_TO_FOLDER', payload: { docId: draggedItemId, folderId } });
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                const { error } = await supabase
                    .from('documents')
                    .update({ folder_id: folderId })
                    .eq('id', draggedItemId)
                    .eq('user_id', user.id);
                if (error) console.error('문서 폴더 이동에 실패했습니다:', error);
            }
        }
        setDropTargetId(null);
        setDraggedItemId(null);
    };
    const handleDragLeave = () => setDropTargetId(null);

    const docsByFolder = React.useMemo(() => {
        const map = new Map<string, DocumentData[]>();
        state.folders.forEach(f => map.set(f.id, []));
        state.documents.forEach(doc => {
            if (doc.folderId && map.has(doc.folderId)) map.get(doc.folderId)!.push(doc);
        });
        return map;
    }, [state.documents, state.folders]);

    const unfiledDocs = React.useMemo(
        () => state.documents.filter(doc => !doc.folderId),
        [state.documents]
    );

    const filteredDocs = React.useMemo(() => {
        if (!searchQuery.trim()) return null;
        const q = searchQuery.toLowerCase();
        return state.documents.filter(doc => doc.fileName.toLowerCase().includes(q));
    }, [state.documents, searchQuery]);

    const profileInitial = (userProfile?.displayName?.trim() || userEmail || '?')[0].toUpperCase();
    const profileShownName = userProfile?.displayName?.trim() || userEmail || '';

    return (
        <>
        {/* Delete confirmation modal */}
        {confirmDelete && ReactDOM.createPortal(
            <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
                <button
                    type="button"
                    className="absolute inset-0 bg-ink-900/50 backdrop-blur-sm"
                    onClick={() => setConfirmDelete(null)}
                    aria-label="Cancel"
                />
                <div className="relative bg-white rounded-3xl shadow-pop w-full max-w-sm p-6 animate-scale-in">
                    <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-xl bg-danger-50 flex items-center justify-center flex-shrink-0">
                            <TrashIcon className="text-danger-600 text-xl" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="font-bold text-ink-900 text-base">문서를 삭제하시겠습니까?</p>
                            <p className="text-ink-500 text-xs mt-1 leading-relaxed">
                                <span className="font-semibold text-ink-700">"{confirmDelete.fileName}"</span> 및 관련 데이터가 영구적으로 삭제됩니다.
                            </p>
                        </div>
                    </div>
                    <div className="flex gap-2 justify-end mt-5">
                        <Button variant="ghost" size="md" onClick={() => setConfirmDelete(null)}>취소</Button>
                        <Button variant="danger" size="md" onClick={() => handleDeleteDocument(confirmDelete.docId)}>삭제</Button>
                    </div>
                </div>
            </div>,
            document.body
        )}

        <div className="flex flex-col h-full bg-white">
            {/* Header */}
            <div className="flex items-center justify-between px-5 pt-5 pb-3 flex-shrink-0">
                <div className="flex items-center gap-2.5">
                    <CleverMonkeyIcon className="w-9 h-9 text-brand-500 flex-shrink-0" />
                    <div className="min-w-0">
                        <span className="block text-h3 text-ink-900">Clever Monkey</span>
                        <p className="text-eyebrow">Sources</p>
                    </div>
                </div>
                <IconButton
                    variant="ghost"
                    size="md"
                    aria-label={isDesktop ? 'Collapse sources panel' : 'Close menu'}
                    title={isDesktop ? 'Collapse sources panel' : 'Close menu'}
                    onClick={() => setIsPanelCollapsed(true)}
                >
                    {isDesktop ? <PanelLeftCloseIcon /> : <XIcon className="text-xl" />}
                </IconButton>
            </div>

            {/* App navigation — desktop only */}
            {isDesktop && (
                <nav className="px-3 pb-3 flex-shrink-0">
                    {NAV_GROUPS.map((group, gi) => (
                        <div key={group.heading ?? `nav-group-${gi}`} className={gi > 0 ? 'mt-3' : ''}>
                            {group.heading && (
                                <div className="px-3 mb-1 text-[10px] font-bold text-ink-400 uppercase tracking-[0.14em]">
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
                                            className={[
                                                'w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-semibold transition-colors',
                                                isActive
                                                    ? 'bg-brand-50 text-brand-700'
                                                    : 'text-ink-600 hover:bg-ink-100 hover:text-ink-800',
                                            ].join(' ')}
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

            {/* Action buttons */}
            <div className="px-5 pb-4 flex-shrink-0">
                <div className="grid grid-cols-2 gap-2">
                    <button
                        type="button"
                        onClick={() => inputRef.current?.click()}
                        className="group flex flex-col items-center justify-center gap-1.5 py-3 bg-gradient-to-br from-brand-500 to-brand-600 hover:from-brand-600 hover:to-brand-700 text-white rounded-xl font-semibold transition-all duration-200 shadow-brand hover:shadow-lift active:scale-[0.98]"
                    >
                        <AddIcon className="text-xl group-hover:scale-110 transition-transform" />
                        <span className="text-xs">New File</span>
                    </button>
                    <button
                        type="button"
                        onClick={handleAddNewFolder}
                        className="group flex flex-col items-center justify-center gap-1.5 py-3 bg-white text-ink-600 rounded-xl font-semibold transition-all duration-200 border border-ink-200 hover:border-brand-300 hover:bg-brand-50/50 hover:text-brand-700 active:scale-[0.98]"
                    >
                        <FolderPlusIcon className="text-xl group-hover:scale-110 transition-transform" />
                        <span className="text-xs">New Folder</span>
                    </button>
                </div>
            </div>

            {/* Search */}
            <div className="px-5 pb-3 flex-shrink-0">
                <div className="relative">
                    <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400 text-base pointer-events-none" />
                    <input
                        type="text"
                        placeholder="문서 검색..."
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        className="w-full pl-9 pr-9 py-2 text-sm bg-ink-50 border border-transparent rounded-xl focus:outline-none focus:border-brand-400 focus:bg-white focus:ring-2 focus:ring-brand-500/15 text-ink-700 placeholder-ink-400 transition-all"
                    />
                    {searchQuery && (
                        <button
                            type="button"
                            onClick={() => setSearchQuery('')}
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-ink-400 hover:text-ink-600"
                            aria-label="Clear search"
                        >
                            <XIcon className="text-base" />
                        </button>
                    )}
                </div>
            </div>

            {/* File List */}
            <div className="flex-1 overflow-y-auto px-3 pb-2">
                <div className="px-2 mb-2 text-[10px] font-bold text-ink-400 uppercase tracking-[0.14em]">My Library</div>
                {filteredDocs !== null ? (
                    filteredDocs.length === 0 ? (
                        <div className="px-2 py-6 text-sm text-ink-400 text-center">검색 결과 없음</div>
                    ) : (
                        <div className="space-y-0.5">
                            {filteredDocs.map(doc => (
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
                    )
                ) : (
                    <div className="space-y-2">
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
                                className={[
                                    'rounded-xl transition-colors',
                                    dropTargetId === null && draggedItemId ? 'bg-brand-50 ring-1 ring-brand-200' : '',
                                ].join(' ')}
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
                    </div>
                )}
            </div>

            {/* Footer: usage + profile */}
            <div className="flex-shrink-0 px-4 py-3 border-t border-ink-100 bg-ink-50/50 space-y-2.5">
                {/* Document usage */}
                <div>
                    <div className="flex justify-between items-center mb-1">
                        <span className="text-[11px] font-semibold text-ink-500">문서</span>
                        <span className="text-[11px] font-mono font-medium text-ink-600">
                            {state.documents.length}{tierLimits.maxDocuments !== Infinity ? ` / ${tierLimits.maxDocuments}` : ''}
                        </span>
                    </div>
                    {tierLimits.maxDocuments !== Infinity && (
                        <div className="w-full bg-ink-200/70 rounded-full h-1 overflow-hidden">
                            <div
                                className={[
                                    'h-1 rounded-full transition-all',
                                    tierLimits.isAtDocumentLimit(state.documents.length) ? 'bg-danger-500' : 'bg-brand-500',
                                ].join(' ')}
                                style={{ width: `${Math.min((state.documents.length / tierLimits.maxDocuments) * 100, 100)}%` }}
                            />
                        </div>
                    )}
                </div>

                {/* AI usage */}
                {!tierLimits.isPro && userProfile && (
                    <div>
                        <div className="flex justify-between items-center mb-1">
                            <span className="text-[11px] font-semibold text-ink-500">AI 사용</span>
                            <span className={[
                                'text-[11px] font-mono font-medium',
                                tierLimits.isAtAiLimit ? 'text-danger-600' : 'text-ink-600',
                            ].join(' ')}>
                                {tierLimits.aiActionsToday} / {tierLimits.maxAiActionsPerDay}
                            </span>
                        </div>
                        <div className="w-full bg-ink-200/70 rounded-full h-1 overflow-hidden">
                            <div
                                className={[
                                    'h-1 rounded-full transition-all',
                                    tierLimits.isAtAiLimit ? 'bg-danger-500' : 'bg-success-500',
                                ].join(' ')}
                                style={{ width: `${Math.min((tierLimits.aiActionsToday / tierLimits.maxAiActionsPerDay) * 100, 100)}%` }}
                            />
                        </div>
                        {tierLimits.isAtAiLimit && (
                            <button
                                type="button"
                                onClick={() => onUpgradeClick?.('ai_actions')}
                                className="mt-1.5 w-full text-[11px] text-center text-brand-600 font-semibold hover:underline"
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
                        className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-warning-700 bg-warning-50 border border-warning-100 rounded-xl hover:bg-warning-100 transition-colors"
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
                        className="w-full flex items-center gap-3 p-2.5 bg-white border border-ink-200 rounded-xl hover:border-brand-200 hover:bg-brand-50/30 transition-colors group"
                    >
                        <div className={[
                            'w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0',
                            tierLimits.isPro
                                ? 'bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-brand'
                                : 'bg-brand-100 text-brand-700',
                        ].join(' ')}>
                            {profileInitial}
                        </div>
                        <div className="flex-1 min-w-0 text-left">
                            <p className="text-xs font-bold text-ink-800 truncate" title={profileShownName}>{profileShownName}</p>
                            <div className="flex items-center gap-1.5 mt-0.5">
                                <Badge tone={tierLimits.isPro ? 'brand' : 'neutral'} variant="soft" size="sm">
                                    {planName}
                                </Badge>
                                {!tierLimits.isPro && onUpgradeClick && (
                                    <button
                                        type="button"
                                        onClick={e => { e.stopPropagation(); onUpgradeClick('generic'); }}
                                        className="text-[10px] text-ink-400 hover:text-brand-600 font-semibold flex items-center gap-0.5 transition-colors"
                                    >
                                        <WorkspacePremiumIcon className="text-xs" /> 업그레이드
                                    </button>
                                )}
                            </div>
                        </div>
                        <IconButton
                            variant="ghost"
                            size="sm"
                            aria-label="Log out"
                            title="Log out"
                            onClick={e => { e.stopPropagation(); onSignOut(); }}
                        >
                            <LogOutIcon className="text-base" />
                        </IconButton>
                    </button>
                )}
            </div>

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
