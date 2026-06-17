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
  /** Mobile presentation. Most dialogs stay as sheets; auth reads better as a full-screen flow. */
  mobilePresentation?: 'sheet' | 'fullscreen';
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
  mobilePresentation = 'sheet',
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

  React.useEffect(() => {
    if (!isOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previousOverflow; };
  }, [isOpen]);

  if (!isOpen) return null;

  const isFullscreenMobile = mobilePresentation === 'fullscreen';
  const containerClassName = isFullscreenMobile
    ? 'fixed inset-0 flex items-stretch justify-stretch overflow-hidden p-0 sm:items-center sm:justify-center sm:overflow-y-auto sm:p-4'
    : 'fixed inset-0 flex items-end justify-center overflow-y-auto overscroll-contain p-0 sm:items-center sm:p-4';
  const dialogSizeClassName = isFullscreenMobile
    ? {
        sm: 'max-w-none sm:max-w-sm',
        md: 'max-w-none sm:max-w-md',
        lg: 'max-w-none sm:max-w-lg',
      }[size]
    : SIZE_CLS[size];
  const dialogClassName = isFullscreenMobile
    ? [
        'relative flex h-dvh max-h-dvh min-h-0 w-full flex-col overflow-hidden bg-white rounded-none shadow-sheet animate-fade-in',
        'sm:my-auto sm:h-auto sm:max-h-[calc(100dvh_-_2rem)] sm:rounded-2xl sm:animate-scale-in',
        dialogSizeClassName,
      ].join(' ')
    : [
        'relative mt-auto flex min-h-0 w-full flex-col bg-white rounded-t-3xl sm:my-auto sm:rounded-2xl shadow-sheet',
        'max-h-[calc(100dvh_-_env(safe-area-inset-top))] sm:max-h-[calc(100dvh_-_2rem)] overflow-hidden animate-slide-in-up sm:animate-scale-in',
        dialogSizeClassName,
      ].join(' ');
  const renderFloatingClose = isFullscreenMobile && dismissible && !title && !description;

  return (
    <div
      className={containerClassName}
      style={{ zIndex, WebkitOverflowScrolling: 'touch', touchAction: 'pan-y' }}
    >
      <div
        className="absolute inset-0 bg-ink-900/50 backdrop-blur-sm animate-fade-in"
        onClick={dismissible ? onClose : undefined}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        className={dialogClassName}
      >
        {renderFloatingClose && (
          <IconButton
            variant="ghost"
            size="md"
            aria-label="Close"
            onClick={onClose}
            className="absolute right-5 top-[max(1rem,env(safe-area-inset-top))] z-10 sm:right-4 sm:top-4"
          >
            <XIcon className="text-xl" />
          </IconButton>
        )}
        {(title || dismissible) && !renderFloatingClose && (
          <div className={[
            'flex items-start gap-3 px-5 pb-2 sm:px-7 sm:pt-7',
            isFullscreenMobile ? 'pt-[max(1rem,env(safe-area-inset-top))]' : 'pt-5',
          ].join(' ')}>
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
        <div
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-3 sm:px-7 sm:pb-7"
          style={{ WebkitOverflowScrolling: 'touch', touchAction: 'pan-y' }}
        >
          {children}
        </div>
        {footer && <div className="px-5 pb-5 -mt-2 sm:px-7 sm:pb-7 sm:-mt-3">{footer}</div>}
      </div>
    </div>
  );
};
