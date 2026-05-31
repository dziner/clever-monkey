import * as React from 'react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline' | 'raised' | 'raised-ghost' | 'raised-success' | 'raised-danger';
type Size = 'sm' | 'md' | 'lg';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  fullWidth?: boolean;
}

/**
 * `raised*` variants are Duolingo-style: solid fill, colored "shelf"
 * shadow below for 3D depth, a small lift on hover, and a satisfying
 * drop-to-flat on press. Use them for primary CTAs and gamified actions.
 * Other variants are the flat (Linear/Notion-style) buttons.
 */

const VARIANT_CLS: Record<Variant, string> = {
  primary:   'bg-brand-600 text-white hover:bg-brand-700 active:bg-brand-800 shadow-brand disabled:bg-brand-300 disabled:shadow-none',
  secondary: 'bg-ink-900 text-white hover:bg-ink-800 active:bg-ink-700 shadow-soft disabled:bg-ink-400',
  ghost:     'bg-transparent text-ink-700 hover:bg-ink-100 active:bg-ink-200 disabled:text-ink-400',
  outline:   'bg-white text-ink-700 border-2 border-ink-200 hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700 active:bg-brand-100 disabled:opacity-50',
  danger:    'bg-danger-600 text-white hover:bg-danger-700 active:bg-danger-700 shadow-soft disabled:bg-danger-500/50',
  // ── Duolingo raised buttons ────────────────────────────────────────────────
  'raised':          'bg-brand-500   text-white   shadow-shelf-brand   hover:bg-brand-600   hover:-translate-y-px active:translate-y-1 active:shadow-none',
  'raised-success':  'bg-success-500 text-white   shadow-shelf-success hover:bg-success-600 hover:-translate-y-px active:translate-y-1 active:shadow-none',
  'raised-danger':   'bg-danger-500  text-white   shadow-shelf-danger  hover:bg-danger-600  hover:-translate-y-px active:translate-y-1 active:shadow-none',
  'raised-ghost':    'bg-white       text-ink-700 border-2 border-ink-200 shadow-shelf-white hover:bg-ink-50 hover:-translate-y-px active:translate-y-1 active:shadow-none',
};

const SIZE_CLS: Record<Size, string> = {
  sm: 'h-9 px-3 text-xs gap-1.5 rounded-xl',
  md: 'h-11 px-4 text-sm gap-2 rounded-xl',
  lg: 'h-12 px-5 text-base gap-2.5 rounded-2xl',
};

// Raised buttons use heavier uppercase styling for the Duolingo feel
const RAISED_SIZE_OVERRIDE: Record<Size, string> = {
  sm: 'h-10 px-4 text-xs gap-1.5 rounded-xl tracking-wider uppercase font-extrabold',
  md: 'h-12 px-5 text-sm gap-2 rounded-2xl tracking-wider uppercase font-extrabold',
  lg: 'h-14 px-6 text-base gap-2.5 rounded-2xl tracking-wider uppercase font-extrabold',
};

const isRaised = (v: Variant) => v.startsWith('raised');

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', loading, leftIcon, rightIcon, fullWidth, className = '', children, disabled, type = 'button', ...rest }, ref) => {
    const raised = isRaised(variant);
    return (
      <button
        ref={ref}
        type={type}
        disabled={disabled || loading}
        className={[
          'inline-flex items-center justify-center font-semibold whitespace-nowrap select-none',
          'transition-all duration-100 ease-out',
          'disabled:cursor-not-allowed',
          fullWidth ? 'w-full' : '',
          raised ? RAISED_SIZE_OVERRIDE[size] : SIZE_CLS[size],
          VARIANT_CLS[variant],
          raised ? 'disabled:opacity-50 disabled:shadow-none disabled:active:translate-y-0' : '',
          className,
        ].join(' ')}
        {...rest}
      >
        {loading ? (
          <span className="inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
        ) : leftIcon}
        {children && <span>{children}</span>}
        {!loading && rightIcon}
      </button>
    );
  }
);
Button.displayName = 'Button';

interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'ghost' | 'subtle' | 'solid' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  'aria-label': string;
}

const ICON_VARIANT: Record<NonNullable<IconButtonProps['variant']>, string> = {
  ghost:  'text-ink-500 hover:text-ink-800 hover:bg-ink-100 active:bg-ink-200',
  subtle: 'text-ink-600 bg-ink-100 hover:bg-ink-200 active:bg-ink-300',
  solid:  'text-white bg-brand-600 hover:bg-brand-700 active:bg-brand-800 shadow-soft',
  danger: 'text-danger-600 hover:text-danger-700 hover:bg-danger-50 active:bg-danger-100',
};

const ICON_SIZE: Record<NonNullable<IconButtonProps['size']>, string> = {
  sm: 'w-8 h-8 rounded-lg',
  md: 'w-9 h-9 rounded-lg',
  lg: 'w-10 h-10 rounded-xl',
};

export const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ variant = 'ghost', size = 'md', className = '', type = 'button', children, ...rest }, ref) => (
    <button
      ref={ref}
      type={type}
      className={[
        'inline-flex items-center justify-center transition-colors duration-150',
        'disabled:opacity-40 disabled:cursor-not-allowed',
        ICON_VARIANT[variant],
        ICON_SIZE[size],
        className,
      ].join(' ')}
      {...rest}
    >
      {children}
    </button>
  )
);
IconButton.displayName = 'IconButton';
