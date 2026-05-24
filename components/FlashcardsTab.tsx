import React from 'react';
import { StyleIcon, TrashIcon, BrainIcon, CheckIcon, XIcon, AddIcon } from './icons';
import { Spinner } from './Spinner';
import { supabase } from '../services/supabaseClient';
import { generateFlashcards } from '../services/geminiService';
import {
  fetchDecks, fetchDueCards, reviewCard, createDeck, deleteDeck,
} from '../services/flashcardsService';
import type { FlashcardDeck, Flashcard, ReviewQuality } from '../services/flashcardsService';
import type { DocumentData, Model } from '../types';

interface FlashcardsTabProps {
  document: DocumentData;
}

// ─── Study Session ─────────────────────────────────────────────
const StudyView: React.FC<{
  deck: FlashcardDeck;
  onExit: (studiedCount: number) => void;
}> = ({ deck, onExit }) => {
  const [cards, setCards] = React.useState<Flashcard[]>([]);
  const [index, setIndex] = React.useState(0);
  const [flipped, setFlipped] = React.useState(false);
  const [studied, setStudied] = React.useState(0);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isAnimating, setIsAnimating] = React.useState(false);

  React.useEffect(() => {
    fetchDueCards(deck.id).then(c => { setCards(c); setIsLoading(false); });
  }, [deck.id]);

  const current = cards[index];
  const total = cards.length;
  const isDone = index >= total;

  const advance = () => {
    setIsAnimating(true);
    setTimeout(() => {
      setFlipped(false);
      setIndex(i => i + 1);
      setIsAnimating(false);
    }, 150);
  };

  const handleRate = async (quality: ReviewQuality) => {
    if (!current) return;
    await reviewCard(current.id, current, quality);
    setStudied(s => s + 1);
    advance();
  };

  if (isLoading) return <div className="flex-1 flex items-center justify-center"><Spinner /></div>;

  if (total === 0) return (
    <div className="flex-1 flex flex-col items-center justify-center gap-4 p-8 text-center">
      <div className="w-20 h-20 bg-green-50 rounded-full flex items-center justify-center">
        <CheckIcon className="text-4xl text-green-500" />
      </div>
      <div>
        <h2 className="text-xl font-bold text-slate-700">오늘 복습할 카드가 없습니다</h2>
        <p className="text-slate-500 mt-1 text-sm">모든 카드가 일정에 맞게 복습됐습니다.</p>
      </div>
      <button type="button" onClick={() => onExit(0)} className="px-5 py-2 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700">
        돌아가기
      </button>
    </div>
  );

  if (isDone) return (
    <div className="flex-1 flex flex-col items-center justify-center gap-4 p-8 text-center">
      <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center">
        <StyleIcon className="text-4xl text-blue-500" />
      </div>
      <div>
        <h2 className="text-xl font-bold text-slate-700">세션 완료!</h2>
        <p className="text-slate-500 mt-1 text-sm">{studied}장의 카드를 복습했습니다.</p>
      </div>
      <button type="button" onClick={() => onExit(studied)} className="px-5 py-2 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700">
        덱으로 돌아가기
      </button>
    </div>
  );

  return (
    <div className="flex-1 flex flex-col p-4 max-w-lg mx-auto w-full">
      <div className="flex items-center justify-between mb-4">
        <button type="button" onClick={() => onExit(studied)} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg">
          <XIcon className="text-xl" />
        </button>
        <div className="text-center">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{deck.title}</p>
          <p className="text-sm font-bold text-slate-700 mt-0.5">{index + 1} / {total}</p>
        </div>
        <div className="w-9" />
      </div>
      <div className="w-full h-1.5 bg-slate-200 rounded-full mb-6">
        <div className="h-1.5 bg-blue-500 rounded-full transition-all duration-300" style={{ width: `${(index / total) * 100}%` }} />
      </div>
      <div
        className={`flex-1 min-h-[240px] max-h-[360px] rounded-2xl shadow-lg border flex flex-col items-center justify-center p-6 text-center cursor-pointer select-none transition-all duration-150 ${
          isAnimating ? 'opacity-0 scale-95' : 'opacity-100 scale-100'
        } ${flipped ? 'bg-blue-50 border-blue-200' : 'bg-white border-slate-200'}`}
        onClick={() => !flipped && setFlipped(true)}
      >
        {!flipped ? (
          <>
            <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-4">질문</p>
            <p className="text-lg font-semibold text-slate-800 leading-relaxed">{current.front}</p>
            <p className="text-xs text-slate-400 mt-6">탭하여 답 확인</p>
          </>
        ) : (
          <>
            <p className="text-xs font-bold uppercase tracking-widest text-blue-400 mb-4">답</p>
            <p className="text-base text-slate-700 leading-relaxed">{current.back}</p>
          </>
        )}
      </div>
      <div className="mt-6">
        {!flipped ? (
          <button type="button" onClick={() => setFlipped(true)} className="w-full py-3 bg-slate-800 text-white rounded-xl font-semibold hover:bg-slate-700 transition-colors">
            답 보기
          </button>
        ) : (
          <div className="space-y-2">
            <p className="text-xs text-center text-slate-500 font-semibold mb-3">얼마나 잘 기억했나요?</p>
            <div className="grid grid-cols-4 gap-2">
              {([
                { q: 'again', label: '다시', sub: '모름', cls: 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100' },
                { q: 'hard', label: '어려움', sub: '헷갈림', cls: 'bg-orange-50 text-orange-700 border-orange-200 hover:bg-orange-100' },
                { q: 'good', label: '보통', sub: '맞음', cls: 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100' },
                { q: 'easy', label: '쉬움', sub: '완벽', cls: 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100' },
              ] as const).map(({ q, label, sub, cls }) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => handleRate(q as ReviewQuality)}
                  className={`flex flex-col items-center py-3 rounded-xl border font-semibold text-xs transition-colors ${cls}`}
                >
                  <span className="text-sm font-bold">{label}</span>
                  <span className="opacity-60 text-[10px] mt-0.5">{sub}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// ─── Generate Modal ────────────────────────────────────────────
const GenerateModal: React.FC<{
  document: DocumentData;
  onClose: () => void;
  onCreated: (deck: FlashcardDeck) => void;
}> = ({ document, onClose, onCreated }) => {
  const [cardCount, setCardCount] = React.useState(15);
  const [deckTitle, setDeckTitle] = React.useState('');
  const [isGenerating, setIsGenerating] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const handleGenerate = async () => {
    if (!document.documentContent) { setError('문서 내용을 불러올 수 없습니다.'); return; }
    setError(null);
    setIsGenerating(true);
    try {
      const title = deckTitle.trim() || `${document.fileName} 플래시카드`;
      const cards = await generateFlashcards(document.documentContent, document.model as Model, cardCount);
      const deck = await createDeck(document.id, document.fileName, title, cards);
      if (!deck) throw new Error('덱 생성에 실패했습니다.');
      onCreated(deck);
    } catch (e: unknown) {
      setError((e as { message?: string })?.message || '생성에 실패했습니다. 다시 시도해 주세요.');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-800">새 플래시카드 덱 만들기</h2>
          <button type="button" onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100">
            <XIcon className="text-xl" />
          </button>
        </div>
        <div className="p-5 space-y-5">
          <div className="p-3 bg-slate-50 rounded-xl text-sm text-slate-600">
            <span className="font-semibold text-slate-700">교재: </span>{document.fileName}
          </div>
          <div>
            <label className="text-sm font-semibold text-slate-700 block mb-2">카드 수: {cardCount}장</label>
            <input
              type="range" min={5} max={40} step={5}
              value={cardCount}
              onChange={e => setCardCount(Number(e.target.value))}
              className="w-full accent-blue-600"
            />
            <div className="flex justify-between text-xs text-slate-400 mt-1"><span>5</span><span>40</span></div>
          </div>
          <div>
            <label className="text-sm font-semibold text-slate-700 block mb-2">덱 이름 (선택)</label>
            <input
              type="text"
              placeholder="자동 설정됩니다"
              value={deckTitle}
              onChange={e => setDeckTitle(e.target.value)}
              className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2.5 focus:ring-1 focus:ring-blue-400 outline-none"
            />
          </div>
          {error && <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>}
          <button
            type="button"
            onClick={handleGenerate}
            disabled={isGenerating}
            className="w-full py-3 bg-purple-600 text-white rounded-xl font-bold hover:bg-purple-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isGenerating ? <><Spinner /> 생성 중...</> : <><AddIcon className="text-lg" /> 덱 만들기</>}
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Main Tab ──────────────────────────────────────────────────
export const FlashcardsTab: React.FC<FlashcardsTabProps> = ({ document }) => {
  const [decks, setDecks] = React.useState<FlashcardDeck[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isLoggedIn, setIsLoggedIn] = React.useState(false);
  const [studyingDeck, setStudyingDeck] = React.useState<FlashcardDeck | null>(null);
  const [showGenerate, setShowGenerate] = React.useState(false);

  const loadDecks = React.useCallback(async () => {
    const all = await fetchDecks();
    setDecks(all.filter(d => d.documentId === document.id));
    setIsLoading(false);
  }, [document.id]);

  React.useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) { setIsLoggedIn(true); loadDecks(); }
      else { setIsLoggedIn(false); setIsLoading(false); }
    });
  }, [loadDecks]);

  // Reload when document changes
  React.useEffect(() => {
    setIsLoading(true);
    setStudyingDeck(null);
    loadDecks();
  }, [document.id, loadDecks]);

  const handleStudyExit = (studied: number) => {
    setStudyingDeck(null);
    if (studied > 0) loadDecks();
  };

  const handleDeckCreated = (deck: FlashcardDeck) => {
    setShowGenerate(false);
    setDecks(prev => [deck, ...prev]);
  };

  const handleDelete = async (deckId: string) => {
    if (!confirm('이 덱을 삭제하시겠습니까?')) return;
    const ok = await deleteDeck(deckId);
    if (ok) setDecks(prev => prev.filter(d => d.id !== deckId));
  };

  const totalDue = decks.reduce((sum, d) => sum + d.dueCards, 0);

  if (studyingDeck) {
    return (
      <div className="flex-1 flex flex-col min-h-0 bg-white">
        <StudyView deck={studyingDeck} onExit={handleStudyExit} />
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-slate-50 overflow-hidden">
      <div className="flex-shrink-0 flex items-center px-4 py-3 border-b border-slate-100 bg-white gap-2">
        <StyleIcon className="text-xl text-purple-500" />
        <span className="font-semibold text-slate-700 text-sm flex-1">플래시카드</span>
        <button
          type="button"
          onClick={() => setShowGenerate(true)}
          className="flex items-center gap-1 px-3 py-1.5 bg-purple-600 text-white text-xs font-semibold rounded-xl hover:bg-purple-700 transition-colors"
        >
          <AddIcon className="text-sm" /> 새 덱
        </button>
      </div>

      {isLoading ? (
        <div className="flex-1 flex items-center justify-center"><Spinner /></div>
      ) : !isLoggedIn ? (
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center gap-3">
          <StyleIcon className="text-4xl text-slate-300" />
          <p className="font-semibold text-slate-600">로그인이 필요합니다</p>
          <p className="text-sm text-slate-400">플래시카드를 저장하려면 로그인하세요.</p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto">
          {decks.length > 0 && (
            <div className="bg-white border-b border-slate-100 px-4 py-3 flex items-center gap-4">
              <div className="flex items-center gap-1.5">
                <span className="text-xl font-bold text-slate-800">{decks.length}</span>
                <span className="text-xs text-slate-500 font-medium">덱</span>
              </div>
              <div className="w-px h-5 bg-slate-200" />
              <div className="flex items-center gap-1.5">
                <span className="text-xl font-bold text-purple-600">{totalDue}</span>
                <span className="text-xs text-slate-500 font-medium">오늘 복습</span>
              </div>
              {totalDue > 0 && (
                <span className="ml-auto px-2.5 py-0.5 bg-purple-100 text-purple-700 text-xs font-bold rounded-full animate-pulse">복습 필요</span>
              )}
            </div>
          )}

          <div className="p-4 space-y-3 max-w-2xl mx-auto w-full">
            {decks.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center gap-4">
                <div className="w-20 h-20 bg-purple-50 rounded-full flex items-center justify-center">
                  <StyleIcon className="text-4xl text-purple-300" />
                </div>
                <div>
                  <p className="font-semibold text-slate-600">플래시카드 덱이 없습니다</p>
                  <p className="text-sm text-slate-400 mt-1">이 교재에서 카드를 자동 생성하세요.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowGenerate(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-xl font-semibold hover:bg-purple-700 text-sm"
                >
                  <AddIcon className="text-base" /> 첫 번째 덱 만들기
                </button>
              </div>
            ) : (
              decks.map(deck => (
                <div key={deck.id} className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-slate-800 truncate">{deck.title}</h3>
                      <div className="flex items-center gap-3 mt-1.5">
                        <span className="text-xs text-slate-500">{deck.totalCards}장</span>
                        {deck.dueCards > 0 ? (
                          <span className="text-xs font-semibold text-purple-600 bg-purple-50 px-2 py-0.5 rounded-full">{deck.dueCards}장 복습 대기</span>
                        ) : (
                          <span className="text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded-full font-semibold">오늘 완료</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        type="button"
                        onClick={() => setStudyingDeck(deck)}
                        className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold transition-colors ${
                          deck.dueCards > 0 ? 'bg-purple-600 text-white hover:bg-purple-700' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        <BrainIcon className="text-base" /> 학습
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(deck.id)}
                        className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <TrashIcon className="text-base" />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {showGenerate && (
        <GenerateModal
          document={document}
          onClose={() => setShowGenerate(false)}
          onCreated={handleDeckCreated}
        />
      )}
    </div>
  );
};
