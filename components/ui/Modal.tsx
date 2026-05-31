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
    <div className="fixed inset-0 flex items-center justify-center p-4" style={{ zIndex }}>
      <div
        className="absolute inset-0 bg-ink-900/50 backdrop-blur-sm animate-fade-in"
        onClick={dismissible ? onClose : undefined}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        className={[
          'relative w-full bg-white rounded-3xl shadow-pop ring-1 ring-ink-900/5',
          'overflow-hidden animate-scale-in',
          SIZE_CLS[size],
        ].join(' ')}
      >
        {(title || dismissible) && (
          <div className="flex items-start gap-3 px-7 pt-7 pb-2">
            <div className="flex-1 min-w-0">
              {title && (
                <h2 className="text-xl font-bold text-ink-900 font-display tracking-tight">{title}</h2>
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
        <div className="px-7 pb-7 pt-3">{children}</div>
        {footer && <div className="px-7 pb-7 -mt-3">{footer}</div>}
      </div>
    </div>
  );
};
