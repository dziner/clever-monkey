import * as React from 'react';
import { IconButton } from './Button';
import { XIcon } from '../icons';

type Size = 'sm' | 'md' | 'lg';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  description?: React.ReactNode;
  size?: Size;
  /** Lock backdrop click & escape (e.g. mandatory first-time prompts). */
  dismissible?: boolean;
  children: React.ReactNode;
  footer?: React.ReactNode;
  zIndex?: number;
}

const SIZE_CLS: Record<Size, string> = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
};

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  description,
  size = 'md',
  dismissible = true,
  children,
  footer,
  zIndex = 100,
}) => {
  React.useEffect(() => {
    if (!isOpen || !dismissible) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, dismissible, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 flex items-end justify-center p-3 sm:items-center sm:p-4" style={{ zIndex }}>
      <div
        className="absolute inset-0 bg-ink-900/50 backdrop-blur-sm animate-fade-in"
        onClick={dismissible ? onClose : undefined}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        className={[
          'relative w-full bg-white rounded-t-3xl sm:rounded-2xl shadow-sheet',
          'max-h-[calc(100dvh-1.5rem)] sm:max-h-[calc(100dvh-2rem)] overflow-y-auto animate-scale-in',
          SIZE_CLS[size],
        ].join(' ')}
      >
        {(title || dismissible) && (
          <div className="flex items-start gap-3 px-5 pt-5 pb-2 sm:px-7 sm:pt-7">
            <div className="flex-1 min-w-0">
              {title && (
                <h2 className="text-lg sm:text-xl font-bold text-ink-900 font-display tracking-tight">{title}</h2>
              )}
              {description && (
                <p className="mt-1.5 text-sm text-ink-500">{description}</p>
              )}
            </div>
            {dismissible && (
              <IconButton variant="ghost" size="md" aria-label="Close" onClick={onClose}>
                <XIcon className="text-xl" />
              </IconButton>
            )}
          </div>
        )}
        <div className="px-5 pb-5 pt-3 sm:px-7 sm:pb-7">{children}</div>
        {footer && <div className="px-5 pb-5 -mt-2 sm:px-7 sm:pb-7 sm:-mt-3">{footer}</div>}
      </div>
    </div>
  );
};
