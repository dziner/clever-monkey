import * as React from 'react';

/**
 * Hand-drawn doodle accents — sprinkled around hero, CTAs, empty spaces
 * to break the SaaS-templated look. Each doodle:
 * - Uses currentColor so it tints with the parent
 * - stroke-linecap=round / stroke-linejoin=round for friendly edges
 * - Slight imperfection in the path so it feels drawn, not vector
 *
 * Pass a tilt class (e.g. "tilt-1r") on the parent if you want them
 * to feel even more thrown-in-place.
 */

type DoodleProps = React.SVGProps<SVGSVGElement>;

export const DoodleStar: React.FC<DoodleProps> = (props) => (
    <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" {...props}>
        <path
            d="M20 5 L23.2 15.2 L34 16 L25.5 22.8 L28.2 33 L20 27.2 L11.8 33 L14.5 22.8 L6 16 L16.8 15.2 Z"
            stroke="currentColor" strokeWidth="2.4" strokeLinejoin="round" strokeLinecap="round" fill="none"
        />
    </svg>
);

export const DoodleSparkle: React.FC<DoodleProps> = (props) => (
    <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" {...props}>
        <path d="M20 4 L22 18 L36 20 L22 22 L20 36 L18 22 L4 20 L18 18 Z"
            fill="currentColor" />
        <path d="M32 8 L33 12 L37 13 L33 14 L32 18 L31 14 L27 13 L31 12 Z" fill="currentColor" />
    </svg>
);

export const DoodleArrow: React.FC<DoodleProps> = (props) => (
    <svg viewBox="0 0 60 40" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" {...props}>
        {/* Hand-drawn curved arrow pointing right-down */}
        <path
            d="M4 8 C 18 6, 32 10, 44 22"
            stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" fill="none"
        />
        <path
            d="M37 16 L44 22 L40 30"
            stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" fill="none"
        />
    </svg>
);

export const DoodleSwoosh: React.FC<DoodleProps> = (props) => (
    <svg viewBox="0 0 80 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" {...props}>
        <path
            d="M4 14 C 14 4, 28 4, 38 12 C 48 20, 62 20, 76 10"
            stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" fill="none"
        />
    </svg>
);

export const DoodleUnderline: React.FC<DoodleProps> = (props) => (
    <svg viewBox="0 0 200 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" preserveAspectRatio="none" {...props}>
        {/* Wobbly hand-drawn underline — two passes for "drew it twice" feel */}
        <path
            d="M4 9 C 30 6, 70 12, 110 8 C 140 5, 170 11, 196 7"
            stroke="currentColor" strokeWidth="3" strokeLinecap="round" fill="none"
        />
        <path
            d="M8 13 C 40 11, 80 14, 120 11 C 150 9, 175 14, 192 12"
            stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" fill="none" opacity="0.5"
        />
    </svg>
);

export const DoodleCircle: React.FC<DoodleProps> = (props) => (
    <svg viewBox="0 0 80 60" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" preserveAspectRatio="none" {...props}>
        {/* Hand-drawn oval that closes imperfectly */}
        <path
            d="M14 30 C 14 12, 40 8, 58 12 C 72 16, 70 38, 56 48 C 38 56, 12 50, 14 32"
            stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" fill="none"
        />
    </svg>
);
