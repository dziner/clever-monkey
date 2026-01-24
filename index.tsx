import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { DocumentProvider } from './contexts/DocumentContext';

// Fix: Import types module to register global JSX augmentations. This ensures
// custom elements like 'lottie-player' are recognized by TypeScript throughout the app.
import './types';

// Configure PDF.js worker globally to avoid race conditions and ensure it's loaded.
if ((window as any).pdfjsLib) {
  (window as any).pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
}

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <DocumentProvider>
      <App />
    </DocumentProvider>
  </React.StrictMode>
);