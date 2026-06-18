import * as React from 'react';

export type AiJobKind =
  | 'chat'
  | 'quiz'
  | 'mindmap'
  | 'flashcards'
  | 'podcast_script'
  | 'podcast_audio'
  | 'study_tips'
  | 'frq_grading';

export interface AiJob {
  id: string;
  kind: AiJobKind;
  label: string;
  documentId: string;
  startedAt: number;
}

interface AiJobInput {
  kind: AiJobKind;
  documentId: string;
  label?: string;
}

type AiJobStartResult =
  | { ok: true; job: AiJob; finish: () => void }
  | { ok: false; activeJob: AiJob };

interface AiJobContextValue {
  activeJob: AiJob | null;
  tryStartJob: (input: AiJobInput) => AiJobStartResult;
}

const JOB_LABELS: Record<AiJobKind, string> = {
  chat: '채팅 답변 생성',
  quiz: '퀴즈 생성',
  mindmap: '마인드맵 생성',
  flashcards: '플래시카드 생성',
  podcast_script: '팟캐스트 스크립트 생성',
  podcast_audio: '팟캐스트 음성 합성',
  study_tips: '학습 팁 생성',
  frq_grading: '서술형 채점',
};

const AiJobContext = React.createContext<AiJobContextValue | null>(null);

function createJob(input: AiJobInput): AiJob {
  return {
    id: `${input.kind}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    kind: input.kind,
    label: input.label ?? JOB_LABELS[input.kind],
    documentId: input.documentId,
    startedAt: Date.now(),
  };
}

export function aiJobBusyMessage(job: AiJob): string {
  return `지금 ${job.label} 중이라 다른 AI 생성을 잠시 멈췄어요. 완료되면 다시 시도해 주세요.`;
}

export function getAiJobLabel(kind: AiJobKind): string {
  return JOB_LABELS[kind];
}

export const AiJobProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeJob, setActiveJob] = React.useState<AiJob | null>(null);
  const activeJobRef = React.useRef<AiJob | null>(null);

  const finishJob = React.useCallback((jobId: string) => {
    if (activeJobRef.current?.id !== jobId) return;
    activeJobRef.current = null;
    setActiveJob(null);
  }, []);

  const tryStartJob = React.useCallback((input: AiJobInput): AiJobStartResult => {
    if (activeJobRef.current) {
      return { ok: false, activeJob: activeJobRef.current };
    }

    const job = createJob(input);
    activeJobRef.current = job;
    setActiveJob(job);

    return {
      ok: true,
      job,
      finish: () => finishJob(job.id),
    };
  }, [finishJob]);

  const value = React.useMemo(
    () => ({ activeJob, tryStartJob }),
    [activeJob, tryStartJob],
  );

  return (
    <AiJobContext.Provider value={value}>
      {children}
    </AiJobContext.Provider>
  );
};

const fallbackGate: AiJobContextValue = {
  activeJob: null,
  tryStartJob: (input) => {
    const job = createJob(input);
    return { ok: true, job, finish: () => undefined };
  },
};

export function useAiJobGate(): AiJobContextValue {
  return React.useContext(AiJobContext) ?? fallbackGate;
}
