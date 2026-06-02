import * as React from 'react';

/**
 * Button primitive — follows Kopay design guideline:
 *  - Hierarchy by weight (font-bold), not size.
 *  - Press feedback: active:scale-[.98] + transition-transform (§5.6).
 *  - Heights & radii align to the spacing scale (4px multiples, lg=14px radius).
 *  - Primary uses brand-500/hover=brand-600/pressed=brand-800 (orange ramp).
 *  - Shadow is at most `shadow-card` — never custom.
 */

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline';
type Size = 'sm' | 'md' | 'lg';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  fullWidth?: boolean;
}

const VARIANT_CLS: Record<Variant, string> = {
  primary:   'bg-brand-500 text-white hover:bg-brand-600 active:bg-brand-800 disabled:bg-brand-300 disabled:hover:bg-brand-300',
  secondary: 'bg-ink-900  text-white hover:bg-ink-800   active:bg-ink-950  disabled:bg-ink-400',
  ghost:     'bg-transparent text-ink-700 hover:bg-ink-150 active:bg-ink-200 disabled:text-ink-400',
  outline:   'bg-white text-ink-800 border border-ink-200 hover:bg-ink-50 hover:border-ink-250 active:bg-ink-100 disabled:opacity-50',
  danger:    'bg-danger-600 text-white hover:bg-danger-700 active:bg-danger-700 disabled:bg-danger-500/50',
};

const SIZE_CLS: Record<Size, string> = {
  sm: 'h-9  px-3 text-sm  gap-2 rounded-lg',  /* 36px tall */
  md: 'h-11 px-4 text-base gap-2 rounded-lg', /* 44px tall — comfortable mobile tap */
  lg: 'h-14 px-5 text-base gap-2 rounded-2xl', /* 56px tall — primary CTA (§7.1) */
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', loading, leftIcon, rightIcon, fullWidth, className = '', children, disabled, type = 'button', ...rest }, ref) => (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      className={[
        'inline-flex items-center justify-center font-bold whitespace-nowrap select-none',
        'transition-[transform,background-color,border-color,color] duration-200 ease-out',
        'active:scale-[0.98]',
        'disabled:cursor-not-allowed disabled:active:scale-100',
        fullWidth ? 'w-full' : '',
        VARIANT_CLS[variant],
        SIZE_CLS[size],
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
  )
);
Button.displayName = 'Button';

interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'ghost' | 'subtle' | 'solid' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  'aria-label': string;
}

const ICON_VARIANT: Record<NonNullable<IconButtonProps['variant']>, string> = {
  ghost:  'text-ink-500 hover:text-ink-800 hover:bg-ink-150 active:bg-ink-200',
  subtle: 'text-ink-700 bg-ink-150 hover:bg-ink-200 active:bg-ink-250',
  solid:  'text-white bg-brand-500 hover:bg-brand-600 active:bg-brand-800',
  danger: 'text-danger-600 hover:text-danger-700 hover:bg-danger-50 active:bg-danger-100',
};

const ICON_SIZE: Record<NonNullable<IconButtonProps['size']>, string> = {
  sm: 'w-9  h-9  rounded-lg text-lg',
  md: 'w-10 h-10 rounded-lg text-xl',
  lg: 'w-11 h-11 rounded-lg text-xl',
};

export const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ variant = 'ghost', size = 'md', className = '', type = 'button', children, ...rest }, ref) => (
    <button
      ref={ref}
      type={type}
      className={[
        'inline-flex items-center justify-center transition-[transform,background-color,color] duration-200 ease-out active:scale-[0.94]',
        'disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100',
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
