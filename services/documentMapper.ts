import type { ChatMessage, DocumentData, Folder } from '../types';
import { normalizePresetQuestions } from '../utils/presetQuestions';

export interface FolderRow {
  id: string;
  name: string;
  user_id: string;
  created_at: string;
}

export interface DocumentRow {
  id: string;
  user_id: string;
  folder_id: string | null;
  file_name: string;
  file_size: number;
  file_mime: string | null;
  file_type: 'pdf' | 'image' | 'text';
  storage_path: string | null;
  summary: string | null;
  chat_history?: DocumentData['chatHistory'] | null;
  preset_questions?: unknown;
  token_count: number | null;
  processing_state: DocumentData['processingState'] | null;
  error_message: string | null;
  model: DocumentData['model'] | null;
  answer_scope: 'document' | 'general' | null;
  monkey_mode: boolean | null;
  document_content?: string | null;
  quiz_tab_data?: DocumentData['quizTabData'] | null;
  mind_map_data?: DocumentData['mindMapData'] | null;
  slides_data?: DocumentData['slidesData'] | null;
  podcast_data?: DocumentData['podcastData'] | null;
  created_at: string;
}

export function mapFolderRow(folder: FolderRow): Folder {
  return {
    id: folder.id,
    name: folder.name,
  };
}

export function mapDocumentRow(
  doc: DocumentRow,
  fallbackWelcome: ChatMessage,
  options: { detailsLoaded?: boolean } = {},
): DocumentData {
  const chatHistory = Array.isArray(doc.chat_history) && doc.chat_history.length > 0
    ? doc.chat_history
    : [fallbackWelcome];
  const presetQuestions = normalizePresetQuestions(doc.preset_questions);

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
    presetQuestions,
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
    detailsLoaded: options.detailsLoaded ?? true,
  };
}
