export const ROUTES = {
  STUDY: '/',
  WRONG_ANSWERS: '/wrong-answers',
  FLASHCARDS: '/flashcards',
  MINDMAP: '/mindmap',
  SLIDES: '/slides',
  PODCAST: '/podcast',
  PROFILE: '/profile',
} as const;

export type AppRoute = typeof ROUTES[keyof typeof ROUTES];
