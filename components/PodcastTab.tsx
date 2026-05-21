import * as React from 'react';
import type { DocumentData } from '../types';
import { generatePodcastScript } from '../services/geminiService';
import { useAIGeneration } from '../hooks/useAIGeneration';
import { useDocuments } from '../contexts/DocumentContext';
import { HeadphonesIcon, AutoAwesomeIcon } from './icons';
import { Spinner } from './Spinner';

interface PodcastTabProps {
  document: DocumentData;
}

export const PodcastTab: React.FC<PodcastTabProps> = ({ document }) => {
  const { dispatch } = useDocuments();

  const { data, loading, error, generate, cancel } = useAIGeneration<string>(
    React.useCallback(
      (signal) => {
        if (!document.documentContent) return Promise.reject(new Error('No document content'));
        return generatePodcastScript(document.documentContent, document.model, signal);
      },
      [document.documentContent, document.model]
    )
  );

  // Persist generated script
  React.useEffect(() => {
    if (data) {
      dispatch({
        type: 'UPDATE_DOCUMENT',
        payload: { docId: document.id, updates: { podcastData: { script: data } } },
      });
    }
  }, [data, document.id, dispatch]);

  const displayScript = data ?? document.podcastData?.script ?? null;

  if (!document.documentContent) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center text-slate-400 p-6">
        <HeadphonesIcon className="text-5xl mb-3 opacity-30" />
        <p className="text-sm font-medium">Document content not available</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Actions bar */}
      <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-white">
        <div className="flex items-center gap-2">
          <HeadphonesIcon className="text-xl text-pink-500" />
          <span className="font-semibold text-slate-700 text-sm">Podcast Script</span>
        </div>
        <div className="flex items-center gap-2">
          {loading ? (
            <>
              <button
                type="button"
                onClick={cancel}
                className="flex items-center gap-1 px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg text-xs font-semibold transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled
                className="flex items-center gap-1 px-3 py-1.5 bg-pink-600 opacity-50 text-white rounded-lg text-xs font-semibold cursor-not-allowed"
              >
                <AutoAwesomeIcon className="text-sm" />
                Generating…
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={generate}
              className="flex items-center gap-1 px-3 py-1.5 bg-pink-600 hover:bg-pink-700 text-white rounded-lg text-xs font-semibold transition-colors shadow-sm"
            >
              <AutoAwesomeIcon className="text-sm" />
              {displayScript ? 'Regenerate' : 'Generate Script'}
            </button>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-auto p-4">
        {loading ? (
          <div className="flex flex-col items-center gap-3 text-slate-500 mt-8">
            <Spinner />
            <span className="text-sm">Writing podcast script…</span>
          </div>
        ) : error ? (
          <div className="text-center text-red-500 text-sm max-w-sm mt-8">
            <p className="font-semibold mb-1">Generation failed</p>
            <p>{error}</p>
          </div>
        ) : !displayScript ? (
          <div className="text-center text-slate-400 max-w-xs mx-auto mt-8">
            <HeadphonesIcon className="text-6xl mb-4 opacity-20" />
            <p className="font-semibold text-slate-600 mb-1">Generate a podcast script</p>
            <p className="text-sm">Get a conversational narration of your document — perfect for audio learning.</p>
          </div>
        ) : (
          <div className="max-w-prose mx-auto">
            <div className="flex items-center gap-2 mb-4">
              <HeadphonesIcon className="text-2xl text-pink-500" />
              <h3 className="font-bold text-slate-800">Podcast Script</h3>
            </div>
            <div className="bg-slate-50 rounded-2xl border border-slate-200 p-5">
              <p className="text-slate-700 text-sm leading-relaxed whitespace-pre-wrap">{displayScript}</p>
            </div>
            <p className="text-xs text-slate-400 mt-3 text-center">
              This is a text script. Audio generation is available on the Podcast page.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
