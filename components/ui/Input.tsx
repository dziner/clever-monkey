import * as React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
  error?: string | null;
  leftIcon?: React.ReactNode;
  rightSlot?: React.ReactNode;
}

const FIELD_BASE = [
  'w-full text-sm text-ink-900 placeholder:text-ink-400',
  'bg-white border border-ink-200 rounded-xl',
  'transition-colors duration-150',
  'focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20',
  'disabled:bg-ink-50 disabled:text-ink-400 disabled:cursor-not-allowed',
].join(' ');

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ label, hint, error, leftIcon, rightSlot, className = '', id, ...rest }, ref) => {
    const inputId = id || React.useId();
    return (
      <div className="w-full">
        {label && (
          <label htmlFor={inputId} className="block text-xs font-semibold text-ink-600 mb-1.5 ml-0.5">
            {label}
          </label>
        )}
        <div className="relative">
          {leftIcon && (
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400 pointer-events-none">
              {leftIcon}
            </span>
          )}
          <input
            ref={ref}
            id={inputId}
            className={[
              FIELD_BASE,
              leftIcon ? 'pl-10' : 'pl-4',
              rightSlot ? 'pr-12' : 'pr-4',
              'py-2.5',
              error ? 'border-danger-500 focus:border-danger-500 focus:ring-danger-500/20' : '',
              className,
            ].join(' ')}
            {...rest}
          />
          {rightSlot && (
            <span className="absolute right-2 top-1/2 -translate-y-1/2">{rightSlot}</span>
          )}
        </div>
        {error ? (
          <p className="mt-1.5 text-xs text-danger-600 font-medium">{error}</p>
        ) : hint ? (
          <p className="mt-1.5 text-xs text-ink-500">{hint}</p>
        ) : null}
      </div>
    );
  }
);
Input.displayName = 'Input';

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  hint?: string;
  error?: string | null;
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, hint, error, className = '', id, ...rest }, ref) => {
    const inputId = id || React.useId();
    return (
      <div className="w-full">
        {label && (
          <label htmlFor={inputId} className="block text-xs font-semibold text-ink-600 mb-1.5 ml-0.5">
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          id={inputId}
          className={[
            FIELD_BASE,
            'px-4 py-3 resize-none',
            error ? 'border-danger-500 focus:border-danger-500 focus:ring-danger-500/20' : '',
            className,
          ].join(' ')}
          {...rest}
        />
        {error ? (
          <p className="mt-1.5 text-xs text-danger-600 font-medium">{error}</p>
        ) : hint ? (
          <p className="mt-1.5 text-xs text-ink-500">{hint}</p>
        ) : null}
      </div>
    );
  }
);
Textarea.displayName = 'Textarea';
