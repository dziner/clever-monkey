export const ROUTES = {
  STUDY: '/',
  PROFILE: '/profile',
  ADMIN: '/admin',
} as const;

export type AppRoute = typeof ROUTES[keyof typeof ROUTES];
