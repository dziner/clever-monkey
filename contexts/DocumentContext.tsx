
import React from 'react';
import type { DocumentData, DocumentState, DocumentAction, Folder } from '../types';
import { buildInitialBotMessage } from '../constants';
import { supabase } from '../services/supabaseClient';

interface FolderRow {
  id: string;
  name: string;
  user_id: string;
  created_at: string;
}

interface DocumentRow {
  id: string;
  user_id: string;
  folder_id: string | null;
  file_name: string;
  file_size: number;
  file_mime: string | null;
  file_type: 'pdf' | 'image' | 'text';
  storage_path: string | null;
  summary: string | null;
  chat_history: DocumentData['chatHistory'] | null;
  preset_questions: string[] | null;
  token_count: number | null;
  processing_state: DocumentData['processingState'] | null;
  error_message: string | null;
  model: DocumentData['model'] | null;
  answer_scope: 'document' | 'general' | null;
  monkey_mode: boolean | null;
  document_content: string | null;
  quiz_tab_data: DocumentData['quizTabData'] | null;
  mind_map_data: DocumentData['mindMapData'] | null;
  slides_data: DocumentData['slidesData'] | null;
  podcast_data: DocumentData['podcastData'] | null;
  created_at: string;
}

const DocumentContext = React.createContext<{
  state: DocumentState;
  dispatch: React.Dispatch<DocumentAction>;
  isLoading: boolean;
} | undefined>(undefined);

// Fix: Add missing useDocuments hook to consume the context.
export const useDocuments = () => {
  const context = React.useContext(DocumentContext);
  if (context === undefined) {
    throw new Error('useDocuments must be used within a DocumentProvider');
  }
  return context;
};

const documentReducer = (state: DocumentState, action: DocumentAction): DocumentState => {
  switch (action.type) {
    case 'SET_STATE':
      return action.payload;
    case 'ADD_DOCUMENT':
      return {
        ...state,
        documents: [action.payload, ...state.documents],
        activeDocumentId: action.payload.id,
      };
    case 'DELETE_DOCUMENT': {
      const newDocs = state.documents.filter(d => d.id !== action.payload.docId);
      let newActiveId = state.activeDocumentId;
      if (state.activeDocumentId === action.payload.docId) {
          newActiveId = newDocs.length > 0 ? newDocs[0].id : null;
      }
      return {
        ...state,
        documents: newDocs,
        activeDocumentId: newActiveId,
      };
    }
    case 'UPDATE_DOCUMENT':
      return {
        ...state,
        documents: state.documents.map(d =>
          d.id === action.payload.docId ? { ...d, ...action.payload.updates } : d
        ),
      };
    case 'SET_ACTIVE_DOCUMENT': {
      const doc = state.documents.find(d => d.id === action.payload.docId);
      return {
        ...state,
        activeDocumentId: action.payload.docId,
        // When a document is activated, its containing folder also becomes active.
        // This ensures the highlight follows the active document.
        activeFolderId: doc?.folderId ?? state.activeFolderId,
      };
    }
    case 'SET_ACTIVE_FOLDER':
      return {
        ...state,
        activeFolderId: action.payload.folderId,
      };
    case 'ADD_FOLDER':
      return {
        ...state,
        folders: [...state.folders, action.payload],
        // Make the new folder active so the user can immediately add files to it.
        activeFolderId: action.payload.id,
      };
    case 'DELETE_FOLDER': {
      const remainingFolders = state.folders.filter(f => f.id !== action.payload.folderId);
      const fallbackFolderId = remainingFolders.length > 0 ? remainingFolders[0].id : null;
      
      let newActiveFolderId = state.activeFolderId;
      if (state.activeFolderId === action.payload.folderId) {
          newActiveFolderId = fallbackFolderId;
      }

      return {
        ...state,
        folders: remainingFolders,
        activeFolderId: newActiveFolderId,
        documents: state.documents.map(d =>
          d.folderId === action.payload.folderId ? { ...d, folderId: fallbackFolderId } : d
        ),
      };
    }
    case 'RENAME_FOLDER':
        return {
            ...state,
            folders: state.folders.map(f =>
                f.id === action.payload.folderId ? { ...f, name: action.payload.newName } : f
            ),
        };
    // New case to handle moving documents between folders via drag-and-drop.
    case 'MOVE_DOCUMENT_TO_FOLDER':
        return {
            ...state,
            documents: state.documents.map(d => 
                d.id === action.payload.docId ? { ...d, folderId: action.payload.folderId } : d
            ),
        };
    default:
      return state;
  }
};

const initialState: DocumentState = {
  documents: [],
  folders: [],
  activeDocumentId: null,
  activeFolderId: null,
};


// Fix: Use React.FC to define the component, ensuring it correctly handles the `children` prop
// and aligns with the coding style of other components in the project. This resolves the
// TypeScript error in `index.tsx` where the `children` prop was not being inferred correctly.
export const DocumentProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, dispatch] = React.useReducer(documentReducer, initialState);
  const [isLoading, setIsLoading] = React.useState(true);

  const generatedContentRef = React.useRef<Record<string, {
    quizTabData: DocumentData['quizTabData'];
    mindMapData: DocumentData['mindMapData'];
    slidesData: DocumentData['slidesData'];
    podcastData: DocumentData['podcastData'];
  }>>({});
  const contentSyncInitializedRef = React.useRef(false);

  React.useEffect(() => {
    let isMounted = true;

    const loadStateForUser = async (userId: string) => {
      setIsLoading(true);
      try {
        const { data: folderRows, error: folderError } = await supabase
          .from('folders')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: true });

        if (folderError) {
          console.error('폴더 목록을 불러오지 못했습니다:', folderError);
        }

        let folders = (folderRows as FolderRow[] || []).map((folder) => ({
          id: folder.id,
          name: folder.name,
        }));

        if (folders.length === 0) {
          const defaultFolderId = `folder-default-${Date.now()}`;
          const { error: insertError } = await supabase
            .from('folders')
            .insert({ id: defaultFolderId, name: 'My Documents', user_id: userId });

          if (insertError) {
            console.error('기본 폴더 생성에 실패했습니다:', insertError);
          } else {
            folders = [{ id: defaultFolderId, name: 'My Documents' }];
          }
        }

        const { data: documentRows, error: documentError } = await supabase
          .from('documents')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false });

        if (documentError) {
          console.error('문서 목록을 불러오지 못했습니다:', documentError);
        }

        // Welcome seed is only used for legacy documents whose chat_history
        // is empty — new uploads seed their own (already language-aware)
        // welcome via useFileHandler. Falling back to the browser language
        // here keeps the UI consistent without needing a UserContext dep.
        const fallbackWelcome = buildInitialBotMessage(null);
        const documents: DocumentData[] = (documentRows as DocumentRow[] || []).map((doc) => {
          const chatHistory = Array.isArray(doc.chat_history) && doc.chat_history.length > 0
            ? doc.chat_history
            : [fallbackWelcome];

          return {
            id: doc.id,
            file: null,
            fileName: doc.file_name,
            fileSize: doc.file_size,
            fileMime: doc.file_mime ?? undefined,
            fileType: doc.file_type,
            storagePath: doc.storage_path ?? undefined,
            uploadState: doc.storage_path ? 'uploaded' : undefined,
            summary: doc.summary ?? '',
            chat: null,
            chatHistory,
            presetQuestions: doc.preset_questions ?? undefined,
            tokenCount: doc.token_count ?? undefined,
            processingState: doc.processing_state ?? (doc.summary ? 'done' : 'error'),
            errorMessage: doc.error_message ?? undefined,
            model: doc.model ?? 'gemini-2.5-flash',
            answerScope: doc.answer_scope ?? 'document',
            monkeyMode: doc.monkey_mode ?? false,
            documentContent: doc.document_content ?? undefined,
            folderId: doc.folder_id ?? null,
            quizTabData: doc.quiz_tab_data ?? undefined,
            mindMapData: doc.mind_map_data ?? undefined,
            slidesData: doc.slides_data ?? undefined,
            podcastData: doc.podcast_data ?? undefined,
            currentPage: 1,
          };
        });

        const activeDocumentId = documents[0]?.id ?? null;
        const activeFolderId = folders[0]?.id ?? null;

        if (!isMounted) return;
        dispatch({
          type: 'SET_STATE',
          payload: {
            documents,
            folders,
            activeDocumentId,
            activeFolderId,
          },
        });
      } catch (error) {
        console.error('문서 상태를 불러오는 중 오류가 발생했습니다:', error);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    const bootstrap = async () => {
      const { data: { user }, error } = await supabase.auth.getUser();
      if (error) {
        console.error('사용자 정보를 불러오지 못했습니다:', error);
      }
      handleUser(user?.id ?? null);
    };

    // Supabase re-emits auth events (e.g. SIGNED_IN / TOKEN_REFRESHED) when the
    // tab regains focus. Only reload when the signed-in user actually changes,
    // otherwise refocusing a tab would re-fetch everything and reset the active
    // document (looks like a full page reload).
    let loadedUserId: string | null | undefined = undefined;
    const handleUser = (userId: string | null) => {
      if (userId === loadedUserId) return;
      loadedUserId = userId;
      if (!userId) {
        if (isMounted) {
          dispatch({ type: 'SET_STATE', payload: initialState });
          setIsLoading(false);
        }
        return;
      }
      loadStateForUser(userId);
    };

    bootstrap();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      handleUser(session?.user?.id ?? null);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  React.useEffect(() => {
    const activeDoc = state.documents.find(doc => doc.id === state.activeDocumentId);
    if (!activeDoc || activeDoc.file || !activeDoc.storagePath) return;

    let isActive = true;
    const downloadFile = async () => {
      try {
        const { data, error } = await supabase.storage
          .from('docs')
          .download(activeDoc.storagePath);

        if (error || !data) {
          console.error('파일 다운로드에 실패했습니다:', error);
          return;
        }

        const file = new File([data], activeDoc.fileName, { type: activeDoc.fileMime || 'application/octet-stream' });
        const imageUrl = file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined;

        if (!isActive) return;
        dispatch({
          type: 'UPDATE_DOCUMENT',
          payload: {
            docId: activeDoc.id,
            updates: { file, imageUrl },
          },
        });
      } catch (error) {
        console.error('파일 다운로드 중 오류가 발생했습니다:', error);
      }
    };

    downloadFile();

    return () => {
      isActive = false;
    };
  }, [state.activeDocumentId, state.documents]);

  // Persist generated content (quiz, mindmap, slides, podcast) to Supabase when changed
  React.useEffect(() => {
    if (isLoading) {
      contentSyncInitializedRef.current = false;
      generatedContentRef.current = {};
      return;
    }

    if (!contentSyncInitializedRef.current) {
      contentSyncInitializedRef.current = true;
      state.documents.forEach(doc => {
        generatedContentRef.current[doc.id] = {
          quizTabData: doc.quizTabData,
          mindMapData: doc.mindMapData,
          slidesData: doc.slidesData,
          podcastData: doc.podcastData,
        };
      });
      return;
    }

    state.documents.forEach(doc => {
      const prev = generatedContentRef.current[doc.id];

      if (!prev) {
        generatedContentRef.current[doc.id] = {
          quizTabData: doc.quizTabData,
          mindMapData: doc.mindMapData,
          slidesData: doc.slidesData,
          podcastData: doc.podcastData,
        };
        return;
      }

      const changed =
        doc.quizTabData !== prev.quizTabData ||
        doc.mindMapData !== prev.mindMapData ||
        doc.slidesData !== prev.slidesData ||
        doc.podcastData !== prev.podcastData;

      if (!changed) return;

      generatedContentRef.current[doc.id] = {
        quizTabData: doc.quizTabData,
        mindMapData: doc.mindMapData,
        slidesData: doc.slidesData,
        podcastData: doc.podcastData,
      };

      supabase.from('documents').update({
        quiz_tab_data: doc.quizTabData ?? null,
        mind_map_data: doc.mindMapData ?? null,
        slides_data: doc.slidesData ?? null,
        podcast_data: doc.podcastData ?? null,
      }).eq('id', doc.id).then(({ error }) => {
        if (error) console.error('Failed to save generated content:', error);
      });
    });
  }, [state.documents, isLoading]);


  const contextValue = React.useMemo(
    () => ({ state, dispatch, isLoading }),
    [state, dispatch, isLoading]
  );

  return (
    <DocumentContext.Provider value={contextValue}>
      {children}
    </DocumentContext.Provider>
  );
};
