import forms from '@tailwindcss/forms';
import typography from '@tailwindcss/typography';

/**
 * Tailwind theme — Kopay-style guideline (styles/KP-design-guideline.md).
 *
 * Theme is intentionally minimal here. Semantic tokens (colors, radii,
 * shadows, motion) live in CSS variables (styles/tokens.css) so a single
 * source of truth is reachable from CSS and JS, and themes can swap at
 * runtime without rebuilding.
 *
 * Color convention: `colors.brand.500` → `rgb(var(--brand-500) / <alpha-value>)`
 * so utilities like `bg-brand-500/30` (alpha) keep working.
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
        ink:     inkPalette(),
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
      // Per guideline §2.2: hierarchy comes from WEIGHT, not size. These are
      // the only allowed sizes (10/11/12/13/14/15/16/17/18/20/22/24/26/28…).
      // Body default is 16px; the type scale composers in components.css
      // enforce semantic weights on top of these.
      fontSize: {
        '2xs':  ['0.6875rem', { lineHeight: '1rem' }],          /* 11px */
        xs:     ['0.75rem',   { lineHeight: '1.05rem' }],       /* 12px */
        '13':   ['0.8125rem', { lineHeight: '1.18rem' }],       /* 13px caption */
        sm:     ['0.875rem',  { lineHeight: '1.3rem' }],        /* 14px */
        '15':   ['0.9375rem', { lineHeight: '1.4rem' }],        /* 15px */
        base:   ['1rem',      { lineHeight: '1.5rem' }],        /* 16px body */
        lg:     ['1.125rem',  { lineHeight: '1.55rem' }],       /* 18px section title */
        xl:     ['1.25rem',   { lineHeight: '1.7rem' }],        /* 20px */
        '22':   ['1.375rem',  { lineHeight: '1.85rem' }],       /* 22px */
        '2xl':  ['1.5rem',    { lineHeight: '2rem' }],          /* 24px */
        '26':   ['1.625rem',  { lineHeight: '2.15rem' }],       /* 26px */
        '3xl':  ['1.75rem',   { lineHeight: '2.275rem' }],      /* 28px hero */
        '4xl':  ['2rem',      { lineHeight: '2.5rem' }],        /* 32px */
        '5xl':  ['2.5rem',    { lineHeight: '3rem' }],          /* 40px */
        '6xl':  ['3rem',      { lineHeight: '3.5rem' }],        /* 48px */
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
        // The only three shadows permitted by the guideline.
        card:    'var(--shadow-card)',
        sheet:   'var(--shadow-sheet)',
        brand:   'var(--shadow-brand)',
        // Aliases for legacy class names — all collapse to `card` to enforce
        // the "essentially one shadow" rule.
        soft:    'var(--shadow-card)',
        lift:    'var(--shadow-card)',
        pop:     'var(--shadow-sheet)',
        'inner-soft': 'var(--shadow-inner-soft)',
      },
      transitionDuration: {
        // Allowed values per guideline §5.1
        100: '100ms',
        200: '200ms',
        300: '300ms',
        500: '500ms',
        700: '700ms',
      },
      transitionTimingFunction: {
        out:        'var(--ease-out)',
        emphasized: 'var(--ease-emphasized)',
      },
      keyframes: {
        // Only spin & pulse exist per guideline §5.4. Everything else uses
        // transitions. We keep a small set of common entrance animations
        // (fade-in, scale-in) because removing them en masse would break
        // modal/toast entrance — they are not custom keyframes used in many
        // places, just short utility entrances.
        'fade-in':   { from: { opacity: '0' }, to: { opacity: '1' } },
        'fade-in-up':{ from: { opacity: '0', transform: 'translateY(8px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
        'scale-in':  { from: { opacity: '0', transform: 'scale(0.98)' }, to: { opacity: '1', transform: 'scale(1)' } },
        'slide-in-up': { from: { transform: 'translateY(100%)' }, to: { transform: 'translateY(0)' } },
      },
      animation: {
        'fade-in':     'fade-in 200ms ease-out forwards',
        'fade-in-up':  'fade-in-up 300ms ease-out forwards',
        'scale-in':    'scale-in 200ms ease-out forwards',
        'slide-in-up': 'slide-in-up 300ms ease-out forwards',
      },
    },
  },
  plugins: [forms({ strategy: 'class' }), typography],
};

// ─── helpers ────────────────────────────────────────────────────────────────
function palette(name) {
  const stops = ['50','100','200','300','400','500','600','700','800','900','950'];
  return Object.fromEntries(stops.map(s => [s, `rgb(var(--${name}-${s}) / <alpha-value>)`]));
}
function inkPalette() {
  // Ink has extra stops for fine-grained borders (per guideline §1.2).
  const stops = ['50','100','150','200','250','300','400','500','600','700','800','900','950'];
  return Object.fromEntries(stops.map(s => [s, `rgb(var(--ink-${s}) / <alpha-value>)`]));
}
function paletteSemantic(name) {
  const stops = ['50','100','500','600','700'];
  return Object.fromEntries(stops.map(s => [s, `rgb(var(--${name}-${s}) / <alpha-value>)`]));
}
