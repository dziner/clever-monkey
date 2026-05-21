
import React from 'react';

// Fix: Add lottie-player global type declaration to resolve JSX intrinsic element error.
// Update: Made property types more permissive to align with web component attribute behavior.
declare global {
  namespace JSX {
    interface IntrinsicElements {
      'lottie-player': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
        src?: string;
        background?: string;
        speed?: string | number;
        loop?: boolean | string;
        autoplay?: boolean | string;
      };
    }
  }
}

export interface Folder {
  id: string;
  name: string;
}

export interface PDFPageViewport {
  width: number;
  height: number;
}

export interface PDFRenderContext {
  canvasContext: CanvasRenderingContext2D;
  viewport: PDFPageViewport;
  background?: string;
}

export interface PDFRenderTask {
  promise: Promise<void>;
  cancel(): void;
}

export interface PDFPageProxy {
  getViewport(options: { scale: number }): PDFPageViewport;
  render(options: PDFRenderContext): PDFRenderTask;
  getTextContent(): Promise<unknown>;
}

export interface PDFDocumentProxy {
  numPages: number;
  getPage(pageNumber: number): Promise<PDFPageProxy>;
  destroy(): void;
}

// State for Multiple Choice Quizzes
export interface MCQQuizState {
  type: 'mcq';
  userAnswers: UserAnswer[];
  isFinished: boolean;
  currentQuestionIndex: number;
}

// State for Free Response Quizzes
export interface FRQQuizState {
  type: 'frq';
  userAnswers: FRUserAnswer[];
  currentQuestionIndex: number;
  isFinished: boolean;
  isGrading: boolean;
}

export type QuizTabState = MCQQuizState | FRQQuizState;

export interface ChatMessage {
  sender: 'user' | 'bot';
  text: string;
  type?: 'scope_change' | 'quiz' | 'monkey_mode_status' | 'quiz_suggestion';
  quizData?: QuizData;
  quizState?: MCQQuizState; // Chat-based quizzes are currently only MCQ
  wasMonkeyMode?: boolean;
}

export type DocumentProcessingState = 'reading' | 'summarizing' | 'generating_questions' | 'error' | 'done';

export const AVAILABLE_MODEL_IDS = ['gemini-2.5-flash', 'gemini-2.5-pro'] as const;
export type Model = typeof AVAILABLE_MODEL_IDS[number];
export type ProcessingModel = Model | 'gemini-flash-latest';

export interface ModelInfo {
  id: Model;
  name: string;
  description: string;
}

export interface DocumentData {
  id: string;
  file: File | null; // Can be null after reloading from localStorage
  fileName: string; // Persisted file name
  fileSize: number;
  fileMime?: string;
  tokenCount?: number;
  fileType: 'pdf' | 'image' | 'text';
  storagePath?: string;
  pdfDoc?: PDFDocumentProxy;
  imageUrl?: string; // for images
  summary: string;
  // Gemini chat is stateless; we reconstruct context from chatHistory + documentContent
  chat: null;
  chatHistory: ChatMessage[];
  presetQuestions?: string[];
  processingState: DocumentProcessingState;
  errorMessage?: string;
  model: Model;
  answerScope: 'document' | 'general';
  monkeyMode: boolean;
  documentContent?: string;
  folderId: string | null;
  currentPage?: number;
  quizTabData?: {
    quizContent: QuizData | FRQData;
    quizState: QuizTabState;
    studyTips?: string;
  } | null;
  mindMapData?: MindMapData | null;
  slidesData?: SlideData | null;
  podcastData?: { script: string } | null;
}

export type MindMapData = {
  center: string;
  branches: Array<{ label: string; children: string[] }>;
};

export type SlideData = {
  title: string;
  slides: Array<{ heading: string; emoji: string; bullets: string[] }>;
};

export interface QuizQuestion {
  questionText: string;
  options: string[];
  correctAnswerIndex: number;
  explanation: string;
}

export interface QuizData {
  title: string;
  questions: QuizQuestion[];
}

export interface UserAnswer {
  questionIndex: number;
  selectedOptionIndex: number;
  isCorrect: boolean;
}

// New types for Free Response Questions (FRQ)
export interface FRQuestion {
  questionText: string;
  explanation: string; // This serves as the reference answer for grading
}

export interface FRQData {
  title: string;
  questions: FRQuestion[];
}

export interface FRUserAnswer {
  questionIndex: number;
  userAnswerText: string;
  score?: number;
  feedback?: string;
}


// Types for Document Context
export interface DocumentState {
  documents: DocumentData[];
  folders: Folder[];
  activeDocumentId: string | null;
  activeFolderId: string | null;
}

export type DocumentAction =
  | { type: 'ADD_DOCUMENT'; payload: DocumentData }
  | { type: 'DELETE_DOCUMENT'; payload: { docId: string } }
  | { type: 'UPDATE_DOCUMENT'; payload: { docId: string; updates: Partial<DocumentData> } }
  | { type: 'SET_STATE'; payload: DocumentState }
  | { type: 'SET_ACTIVE_DOCUMENT'; payload: { docId: string | null } }
  | { type: 'SET_ACTIVE_FOLDER'; payload: { folderId: string | null } }
  | { type: 'ADD_FOLDER'; payload: Folder }
  | { type: 'DELETE_FOLDER'; payload: { folderId: string } }
  | { type: 'RENAME_FOLDER'; payload: { folderId: string; newName: string } }
  | { type: 'MOVE_DOCUMENT_TO_FOLDER'; payload: { docId: string; folderId: string | null } };
