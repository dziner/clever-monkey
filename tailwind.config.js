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
        sans:    ['var(--font-sans)'],
        display: ['var(--font-display)'],
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
