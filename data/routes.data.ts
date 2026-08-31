/**
 * data/routes.data.ts — all UI routes used by page objects and tests.
 * Rule: no hardcoded paths anywhere else.
 */
export const routes = {
	home: '/',
	login: '/auth/login',
	register: '/auth/register',
	account: '/account',
	profile: '/account/profile',
	favorites: '/account/favorites',
	checkout: '/checkout',
	product: (id: string): string => `/product/${id}`,
} as const
