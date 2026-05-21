import { useState, useCallback, useRef, useEffect } from 'react';

export interface AIGenerationState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  generate: () => Promise<void>;
  cancel: () => void;
  reset: () => void;
}

export function useAIGeneration<T>(
  fn: (signal: AbortSignal) => Promise<T>
): AIGenerationState<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  // Use a ref so generate() is always stable (never stale-closes over fn)
  const fnRef = useRef(fn);
  fnRef.current = fn;

  // Cancel on unmount
  useEffect(() => () => { abortRef.current?.abort(); }, []);

  const generate = useCallback(async () => {
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    setLoading(true);
    setError(null);
    try {
      const result = await fnRef.current(abortRef.current.signal);
      setData(result);
    } catch (e: unknown) {
      if (e instanceof Error && e.name === 'AbortError') return;
      setError(e instanceof Error ? e.message : 'Generation failed.');
    } finally {
      setLoading(false);
    }
  }, []); // intentionally empty — fnRef keeps it fresh

  const cancel = useCallback(() => { abortRef.current?.abort(); }, []);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    setData(null);
    setError(null);
    setLoading(false);
  }, []);

  return { data, loading, error, generate, cancel, reset };
}
