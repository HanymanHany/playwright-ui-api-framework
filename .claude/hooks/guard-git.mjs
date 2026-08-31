#!/usr/bin/env node
// PreToolUse guard for Bash.
//
// Refuses the three git operations this project bans outright. All of them are easy to
// reach for when something is in the way, and all of them destroy information that
// somebody else is going to need.

const BANNED = [
	{
		pattern: /git\s+push\b[^\n]*(--force\b|--force-with-lease\b|\s-f\b)/,
		reason:
			'Force-push rewrites history that someone else may already have pulled. If the ' +
			'branch needs correcting, add a commit that corrects it.',
	},
	{
		pattern: /git\s+(commit|push)\b[^\n]*--no-verify/,
		reason:
			'--no-verify skips the hooks that exist to catch exactly the commit being made. ' +
			'Fix what the hook reports instead of silencing it.',
	},
	{
		pattern: /git\s+commit\b[^\n]*--amend/,
		reason:
			'--amend rewrites a commit that may already be pushed, and hides what actually ' + 'happened. Make a new commit.',
	},
]

let raw = ''
process.stdin.on('data', (chunk) => (raw += chunk))
process.stdin.on('end', () => {
	let command = ''
	try {
		command = JSON.parse(raw)?.tool_input?.command ?? ''
	} catch {
		process.exit(0)
	}

	const hit = BANNED.find(({ pattern }) => pattern.test(command))
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
