import * as React from 'react';

type Tone = 'default' | 'elevated' | 'soft' | 'outline';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  tone?: Tone;
  interactive?: boolean;
  padded?: boolean;
}

const TONE_CLS: Record<Tone, string> = {
  default:  'bg-white border border-ink-200 shadow-soft',
  elevated: 'bg-white border border-ink-200/70 shadow-card',
  soft:     'bg-ink-50 border border-ink-200/60',
  outline:  'bg-white border border-ink-200',
};

export const Card: React.FC<CardProps> = ({
  tone = 'default',
  interactive,
  padded = true,
  className = '',
  children,
  ...rest
}) => (
  <div
    className={[
      'rounded-2xl',
      TONE_CLS[tone],
      interactive ? 'transition-all duration-200 hover:shadow-lift hover:-translate-y-0.5 cursor-pointer' : '',
      padded ? 'p-5' : '',
      className,
    ].join(' ')}
    {...rest}
  >
    {children}
  </div>
);

export const CardHeader: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ className = '', children, ...rest }) => (
  <div className={['flex items-center gap-2 mb-3', className].join(' ')} {...rest}>
    {children}
  </div>
);

export const CardTitle: React.FC<React.HTMLAttributes<HTMLHeadingElement>> = ({ className = '', children, ...rest }) => (
  <h3 className={['text-sm font-bold text-ink-800', className].join(' ')} {...rest}>
    {children}
  </h3>
);

export const CardEyebrow: React.FC<React.HTMLAttributes<HTMLParagraphElement>> = ({ className = '', children, ...rest }) => (
  <p className={['text-[11px] font-bold uppercase tracking-wider text-ink-400', className].join(' ')} {...rest}>
    {children}
  </p>
);
