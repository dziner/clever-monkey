# Clever Monkey — AI Learning Assistant

## Project Overview

React + TypeScript SPA built with Vite. AI-powered study tool with PDF viewer, chat, quizzes, mindmap, slides, and podcast generation.

## Stack

- **Frontend**: React 18, TypeScript, Tailwind CSS, React Router v6
- **AI**: Google Gemini via Netlify Function proxy (`/api/gemini`)
- **Backend**: Supabase (auth, database, storage)
- **Build**: Vite, deployed on Netlify
- **PDF**: pdf.js (CDN), loaded as `window.pdfjsLib`

## File Structure

```
/                    # project root (no src/ subfolder)
├── App.tsx          # root layout, auth, routing
├── routes.ts        # ROUTES constants
├── types.ts         # all shared TypeScript types
├── components/      # shared UI components
├── pages/           # route-level page components
├── contexts/        # React contexts (DocumentContext, UserContext)
├── hooks/           # custom hooks (useAIGeneration, useKeyboardShortcuts…)
├── services/        # API layer (geminiService, supabaseClient…)
├── netlify/functions/gemini.ts  # Gemini proxy (server-side)
└── tests/
    ├── e2e/         # Playwright E2E tests
    └── unit/        # Vitest unit tests
```

## Development

```bash
npm run dev          # start dev server (http://localhost:5173)
npm run build        # production build
npm run preview      # preview production build
```

## Testing

```bash
npm test                  # unit tests (vitest)
npm run test:watch        # unit tests in watch mode
npm run test:coverage     # unit tests with coverage report
npx playwright test       # E2E tests (requires dev server or webServer config)
npm run test:api          # API/service unit tests
```

## Verification Checklist

코드 변경 후 반드시:
1. `npm run build` — TypeScript 오류 없이 빌드 통과
2. `npm test` — 유닛 테스트 통과
3. 관련 E2E 시나리오 실행: `npx playwright test`
4. lint/type check: `npx tsc --noEmit`

## Key Conventions

- **No `src/` folder** — all files at project root
- **Route constants** — always use `ROUTES.*` from `routes.ts`, never hardcode strings
- **AI generation** — use `useAIGeneration` hook for all Gemini calls with AbortController
- **Auth state** — consume via `useUser()` hook, never re-implement
- **Document state** — use `useDocuments()` context, dispatch actions
- **JSON from Gemini** — always use `cleanAndParseJSON()` + `responseMimeType: 'application/json'`
- **No `any` types** — use proper interfaces; `window.*` CDN globals are acceptable exceptions
- **Commit to main** — always merge feature branch to `main` and push after completing work

## Branch Strategy

- Feature branch: `claude/ai-learning-assistant-BkLZ0`
- **Always merge to `main` and push after every set of changes**
- Netlify auto-deploys from `main`
