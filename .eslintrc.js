module.exports = {
	root: true,
	parser: '@typescript-eslint/parser',
	parserOptions: {
		project: './tsconfig.json',
		tsconfigRootDir: __dirname,
	},
	plugins: ['@typescript-eslint', 'playwright'],
	extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended', 'plugin:playwright/recommended'],
	env: { node: true, es2022: true },
	rules: {
		// Playwright discipline — these rules are the automated half of our conventions
		'playwright/no-wait-for-timeout': 'error',
		'playwright/no-focused-test': 'error',
		'playwright/prefer-web-first-assertions': 'error',
		'playwright/no-conditional-in-test': 'error',
		'playwright/expect-expect': 'off', // assertions live in page object assert* methods

		'@typescript-eslint/no-explicit-any': 'error',
		'@typescript-eslint/no-floating-promises': 'error',
		'@typescript-eslint/explicit-function-return-type': ['warn', { allowExpressions: true }],
		'no-console': 'off', // logger uses console by design
	},
	ignorePatterns: ['node_modules/', 'playwright-report/', 'test-results/', 'allure-results/', 'allure-report/'],
}
