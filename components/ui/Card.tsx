import * as React from 'react';

/**
 * Card primitive — Kopay guideline §3.3 / §4: surface separated by
 * tone + radius, single shadow-card (no shadow stacking).
 */
type Tone = 'default' | 'elevated' | 'soft' | 'outline';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  tone?: Tone;
  interactive?: boolean;
  padded?: boolean;
}

const TONE_CLS: Record<Tone, string> = {
  default:  'bg-white border border-ink-200 shadow-card',
  elevated: 'bg-white border border-ink-200 shadow-card',
  soft:     'bg-ink-150',
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
      'rounded-lg',
      TONE_CLS[tone],
      interactive ? 'transition-transform duration-200 active:scale-[0.99] cursor-pointer' : '',
      padded ? 'p-4' : '',
      className,
    ].join(' ')}
    {...rest}
  >
    {children}
  </div>
);

export const CardHeader: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ className = '', children, ...rest }) => (
  <div className={['flex items-center justify-between mb-4', className].join(' ')} {...rest}>
    {children}
  </div>
);

export const CardTitle: React.FC<React.HTMLAttributes<HTMLHeadingElement>> = ({ className = '', children, ...rest }) => (
  <h3 className={['text-h2', className].join(' ')} {...rest}>
    {children}
  </h3>
);

export const CardEyebrow: React.FC<React.HTMLAttributes<HTMLParagraphElement>> = ({ className = '', children, ...rest }) => (
  <p className={['text-eyebrow', className].join(' ')} {...rest}>
    {children}
  </p>
);
