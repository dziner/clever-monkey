import * as React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
  error?: string | null;
  leftIcon?: React.ReactNode;
  rightSlot?: React.ReactNode;
}

const FIELD_BASE = [
  'w-full text-base text-ink-900 placeholder:text-ink-400',
  'bg-white border border-ink-200 rounded-lg',
  'transition-colors duration-200',
  'focus:outline-none focus:border-brand-500',
  'disabled:bg-ink-150 disabled:text-ink-400 disabled:cursor-not-allowed',
].join(' ');

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ label, hint, error, leftIcon, rightSlot, className = '', id, ...rest }, ref) => {
    const inputId = id || React.useId();
    return (
      <div className="w-full">
        {label && (
          <label htmlFor={inputId} className="block text-sm font-semibold text-ink-800 mb-2">
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
              leftIcon ? 'pl-11' : 'pl-4',
              rightSlot ? 'pr-12' : 'pr-4',
              'h-12',
              error ? 'border-danger-500 focus:border-danger-500' : '',
              className,
            ].join(' ')}
            {...rest}
          />
          {rightSlot && (
            <span className="absolute right-2 top-1/2 -translate-y-1/2">{rightSlot}</span>
          )}
        </div>
        {error ? (
          <p className="mt-2 text-13 text-danger-600">{error}</p>
        ) : hint ? (
          <p className="mt-2 text-13 text-ink-500">{hint}</p>
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
          <label htmlFor={inputId} className="block text-sm font-semibold text-ink-800 mb-2">
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          id={inputId}
          className={[
            FIELD_BASE,
            'px-4 py-3 resize-none',
            error ? 'border-danger-500 focus:border-danger-500' : '',
            className,
          ].join(' ')}
          {...rest}
        />
        {error ? (
          <p className="mt-2 text-13 text-danger-600">{error}</p>
        ) : hint ? (
          <p className="mt-2 text-13 text-ink-500">{hint}</p>
        ) : null}
      </div>
    );
  }
);
Textarea.displayName = 'Textarea';
