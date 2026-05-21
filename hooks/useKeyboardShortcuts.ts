import { useEffect, useRef } from 'react';

export interface Shortcut {
  key: string;
  meta?: boolean;
  shift?: boolean;
  handler: () => void;
}

export function useKeyboardShortcuts(shortcuts: Shortcut[]): void {
  const shortcutsRef = useRef(shortcuts);
  shortcutsRef.current = shortcuts;

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return;

      for (const s of shortcutsRef.current) {
        const keyMatch = e.key.toLowerCase() === s.key.toLowerCase();
        const metaMatch = s.meta ? (e.metaKey || e.ctrlKey) : (!e.metaKey && !e.ctrlKey);
        const shiftMatch = s.shift ? e.shiftKey : !e.shiftKey;
        if (keyMatch && metaMatch && shiftMatch) {
          e.preventDefault();
          s.handler();
          return;
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []); // stable — uses shortcutsRef
}
