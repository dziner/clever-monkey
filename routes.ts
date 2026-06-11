export const ROUTES = {
  STUDY: '/',
  PROFILE: '/profile',
  ADMIN: '/admin',
  PRIVACY: '/privacy',
  TERMS: '/terms',
} as const;

export type AppRoute = typeof ROUTES[keyof typeof ROUTES];
