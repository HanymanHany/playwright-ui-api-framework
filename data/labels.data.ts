/**
 * data/labels.data.ts — UI copy used in assertions.
 * Rule: when the app changes a label, we update ONE line here, not N tests.
 */
export const labels = {
	account: {
		pageTitle: 'My account',
	},
	profile: {
		pageTitle: 'Profile',
	},
	favorites: {
		pageTitle: 'Favorites',
	},
	login: {
		invalidCredentials: 'Invalid email or password',
	},
} as const
