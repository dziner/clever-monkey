import forms from '@tailwindcss/forms';
import typography from '@tailwindcss/typography';

/**
 * Tailwind theme is intentionally minimal here — semantic tokens (colors,
 * radii, shadows, motion) live in CSS variables (styles/tokens.css). This
 * keeps a single source of truth that's reachable from CSS, lets us swap
 * themes at runtime (light/dark, custom workspaces) without rebuilding, and
 * still gives Tailwind full IntelliSense + tree-shaking.
 *
 * Convention: `colors.brand.600` → `rgb(var(--brand-600) / <alpha-value>)`
 * so utilities like `bg-brand-600/10` (alpha) keep working.
 */

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './App.tsx',
    './index.tsx',
    './routes.ts',
    './types.ts',
    './pages/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './contexts/**/*.{ts,tsx}',
    './hooks/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        brand:   palette('brand'),
        ink:     palette('ink'),
        success: paletteSemantic('success'),
        warning: paletteSemantic('warning'),
        danger:  paletteSemantic('danger'),
        info:    paletteSemantic('info'),
      },
      fontFamily: {
        sans:        ['var(--font-sans)'],
        display:     ['var(--font-display)'],
        handwritten: ['var(--font-handwritten)'],
      },
      borderRadius: {
        xs:    'var(--radius-xs)',
        sm:    'var(--radius-sm)',
        md:    'var(--radius-md)',
        lg:    'var(--radius-lg)',
        xl:    'var(--radius-xl)',
        '2xl': 'var(--radius-2xl)',
        '3xl': 'var(--radius-3xl)',
      },
      boxShadow: {
        soft:        'var(--shadow-soft)',
        card:        'var(--shadow-card)',
        lift:        'var(--shadow-lift)',
        pop:         'var(--shadow-pop)',
        brand:       'var(--shadow-brand)',
        'inner-soft':'var(--shadow-inner-soft)',
        // Duolingo "shelf" — the colored bottom band that creates 3D depth
        'shelf-brand':   'var(--shelf-brand)',
        'shelf-success': 'var(--shelf-success)',
        'shelf-warning': 'var(--shelf-warning)',
        'shelf-danger':  'var(--shelf-danger)',
        'shelf-ink':     'var(--shelf-ink)',
        'shelf-white':   'var(--shelf-white)',
      },
      // Consistent type scale — used by .text-* component classes and ad-hoc Tailwind use.
      fontSize: {
        '2xs':         ['0.6875rem', { lineHeight: '1rem',    letterSpacing: '0.01em',  fontWeight: '600' }],
        xs:            ['0.75rem',   { lineHeight: '1.125rem' }],
        sm:            ['0.875rem',  { lineHeight: '1.375rem' }],
        base:          ['1rem',      { lineHeight: '1.5rem' }],
        lg:            ['1.125rem',  { lineHeight: '1.625rem' }],
        xl:            ['1.25rem',   { lineHeight: '1.75rem',  letterSpacing: '-0.005em' }],
        '2xl':         ['1.5rem',    { lineHeight: '2rem',     letterSpacing: '-0.01em' }],
        '3xl':         ['1.875rem',  { lineHeight: '2.25rem',  letterSpacing: '-0.015em' }],
        '4xl':         ['2.25rem',   { lineHeight: '2.625rem', letterSpacing: '-0.02em' }],
        '5xl':         ['3rem',      { lineHeight: '3.25rem',  letterSpacing: '-0.025em' }],
        '6xl':         ['3.75rem',   { lineHeight: '4rem',     letterSpacing: '-0.03em' }],
      },
      transitionDuration: {
        250: '250ms',
        400: '400ms',
      },
      transitionTimingFunction: {
        out: 'var(--ease-out)',
        emphasized: 'var(--ease-emphasized)',
      },
      keyframes: {
        'slide-in-up':  { from: { transform: 'translateY(100%)', opacity: '0.9' }, to: { transform: 'translateY(0)', opacity: '1' } },
        'fade-in-up':   { from: { opacity: '0', transform: 'translateY(15px)' },   to: { opacity: '1', transform: 'translateY(0)' } },
        'fade-in':      { from: { opacity: '0' },                                  to: { opacity: '1' } },
        'scale-in':     { from: { opacity: '0', transform: 'scale(0.96)' },        to: { opacity: '1', transform: 'scale(1)' } },
        'pulse-brand':  { '0%, 100%': { boxShadow: '0 0 0 0 rgb(var(--brand-500) / 0.5)' }, '50%': { boxShadow: '0 0 0 8px rgb(var(--brand-500) / 0)' } },
        shimmer:        { '0%': { backgroundPosition: '-200% 0' }, '100%': { backgroundPosition: '200% 0' } },
      },
      animation: {
        'slide-in-up': 'slide-in-up 0.3s var(--ease-out) forwards',
        'fade-in-up':  'fade-in-up 0.4s var(--ease-out) forwards',
        'fade-in':     'fade-in 0.2s var(--ease-out) forwards',
        'scale-in':    'scale-in 0.2s var(--ease-out) forwards',
        'pulse-brand': 'pulse-brand 2s ease-in-out infinite',
        shimmer:       'shimmer 2s linear infinite',
      },
    },
  },
  plugins: [forms({ strategy: 'class' }), typography],
};

// ─── helpers ────────────────────────────────────────────────────────────────
// Build a Tailwind palette object whose values reference CSS custom properties.
// Allows `bg-brand-600/30` (alpha) and `text-ink-900` to resolve through tokens.
function palette(name) {
  const stops = ['50','100','200','300','400','500','600','700','800','900','950'];
  return Object.fromEntries(stops.map(s => [s, `rgb(var(--${name}-${s}) / <alpha-value>)`]));
}
function paletteSemantic(name) {
  const stops = ['50','100','500','600','700'];
  return Object.fromEntries(stops.map(s => [s, `rgb(var(--${name}-${s}) / <alpha-value>)`]));
}
