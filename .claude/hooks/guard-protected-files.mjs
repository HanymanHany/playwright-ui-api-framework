#!/usr/bin/env node
// PreToolUse guard for Edit / Write.
//
// Some rules in .claude/rules/ are stated as prose and hold only for as long as the
// reader remembers them. These four hold mechanically instead — the tool call is
// refused before it happens, with the remedy in the refusal.
//
// Plain Node with no dependencies on purpose: this project is developed on Windows and
// runs in CI on Linux, and a hook that only works in one of those is worse than none.

const PROTECTED = [
	{
		pattern: /api[\\/]generated[\\/]/,
		reason:
			'api/generated/ is produced by `npm run api:types` from the live OpenAPI spec. ' +
			'Editing it by hand makes the types disagree with the server silently — which is ' +
			'exactly the failure the generator exists to prevent. Regenerate instead, and ' +
			'commit the result on its own.',
	},
	{
		pattern: /(^|[\\/])\.env$/,
		reason:
			'.env is gitignored and machine-local. Defaults for every variable live in ' +
			'config/env.ts — change them there, or ask the user to edit .env themselves.',
	},
	{
		pattern: /(^|[\\/])\.auth[\\/]/,
		reason:
			'.auth/ holds what global-setup writes for the current run: the run user, the ' +
			'storage state, the data snapshot and the downloaded OpenAPI document. It is ' +
			'rebuilt on every run — editing it changes nothing and hides the real state.',
	},
	{
		pattern: /package-lock\.json$/,
		reason:
			'package-lock.json is written by npm. Change dependencies through npm so the ' +
			'lockfile and package.json cannot disagree.',
	},
]

let raw = ''
process.stdin.on('data', (chunk) => (raw += chunk))
process.stdin.on('end', () => {
	let filePath = ''
	try {
		filePath = JSON.parse(raw)?.tool_input?.file_path ?? ''
	} catch {
		process.exit(0)
	}

	const hit = PROTECTED.find(({ pattern }) => pattern.test(filePath))
	if (!hit) process.exit(0)

	process.stdout.write(
		JSON.stringify({
			hookSpecificOutput: {
				hookEventName: 'PreToolUse',
				permissionDecision: 'deny',
				permissionDecisionReason: hit.reason,
			},
		})
	)
	process.exit(0)
})
