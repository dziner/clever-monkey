export const ROUTES = {
  STUDY: '/',
  WRONG_ANSWERS: '/wrong-answers',
  FLASHCARDS: '/flashcards',
  PROFILE: '/profile',
  DASHBOARD: '/dashboard',
  ADMIN: '/admin',
} as const;

export type AppRoute = typeof ROUTES[keyof typeof ROUTES];
