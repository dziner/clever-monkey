import * as React from 'react';

type Tone = 'brand' | 'neutral' | 'success' | 'warning' | 'danger' | 'info';
type Variant = 'solid' | 'soft' | 'outline';
type Size = 'sm' | 'md';

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: Tone;
  variant?: Variant;
  size?: Size;
  dot?: boolean;
}

const SOLID: Record<Tone, string> = {
  brand:   'bg-brand-600 text-white',
  neutral: 'bg-ink-700 text-white',
  success: 'bg-success-600 text-white',
  warning: 'bg-warning-600 text-white',
  danger:  'bg-danger-600 text-white',
  info:    'bg-info-600 text-white',
};

const SOFT: Record<Tone, string> = {
  brand:   'bg-brand-50 text-brand-700 border border-brand-100',
  neutral: 'bg-ink-100 text-ink-700 border border-ink-200',
  success: 'bg-success-50 text-success-700 border border-success-100',
  warning: 'bg-warning-50 text-warning-700 border border-warning-100',
  danger:  'bg-danger-50 text-danger-700 border border-danger-100',
  info:    'bg-info-50 text-info-700 border border-info-100',
};

const OUTLINE: Record<Tone, string> = {
  brand:   'border border-brand-300 text-brand-700',
  neutral: 'border border-ink-300 text-ink-700',
  success: 'border border-success-500/40 text-success-700',
  warning: 'border border-warning-500/40 text-warning-700',
  danger:  'border border-danger-500/40 text-danger-700',
  info:    'border border-info-500/40 text-info-700',
};

const SIZE: Record<Size, string> = {
  sm: 'h-5 px-1.5 text-[10px] tracking-wider rounded-md',
  md: 'h-6 px-2 text-xs rounded-lg',
};

const DOT_COLOR: Record<Tone, string> = {
  brand:   'bg-brand-500',
  neutral: 'bg-ink-500',
  success: 'bg-success-500',
  warning: 'bg-warning-500',
  danger:  'bg-danger-500',
  info:    'bg-info-500',
};

export const Badge: React.FC<BadgeProps> = ({
  tone = 'neutral',
  variant = 'soft',
  size = 'md',
  dot,
  className = '',
  children,
  ...rest
}) => {
  const variantCls = variant === 'solid' ? SOLID[tone] : variant === 'outline' ? OUTLINE[tone] : SOFT[tone];
  return (
    <span
      className={[
        'inline-flex items-center gap-1 font-semibold uppercase whitespace-nowrap',
        SIZE[size],
        variantCls,
        className,
      ].join(' ')}
      {...rest}
    >
      {dot && <span className={['w-1.5 h-1.5 rounded-full', DOT_COLOR[tone]].join(' ')} />}
      {children}
    </span>
  );
};
