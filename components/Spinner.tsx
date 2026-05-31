import * as React from 'react';

interface SpinnerProps {
    size?: 'sm' | 'md' | 'lg';
    className?: string;
}

const SIZE: Record<NonNullable<SpinnerProps['size']>, string> = {
    sm: 'w-5 h-5 border-2',
    md: 'w-8 h-8 border-[3px]',
    lg: 'w-12 h-12 border-4',
};

export const Spinner: React.FC<SpinnerProps> = ({ size = 'lg', className = '' }) => (
    <div
        className={[
            'border-brand-600 border-t-transparent rounded-full animate-spin',
            SIZE[size],
            className,
        ].join(' ')}
        role="status"
        aria-label="Loading"
    />
);
