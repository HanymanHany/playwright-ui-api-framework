#!/usr/bin/env node
// Ties the review stage to the commit stage.
//
// The review and the commit are deliberately two skills, on two models, with two
// separate human approvals — a step that starts out intending to commit is worse at
// finding reasons not to. But nothing stopped a commit from skipping the review
// entirely, which made the whole gate optional in practice.
//
// So the review leaves a fingerprint of what it reviewed, and the commit refuses to
// proceed against a different one. Not a lock — a check that answers precisely
// "was THIS diff reviewed, or a different one?"
//
//   node .claude/scripts/review-marker.mjs write   # after a clean review
//   node .claude/scripts/review-marker.mjs check   # before committing
//
// Exit code 0 = fine, 1 = stale or missing. The marker is gitignored: it describes
// this working copy at this moment, and means nothing to anyone else.

import { execSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'

const MARKER = '.claude/.last-review.json'

const fingerprint = () => ({
	head: execSync('git rev-parse HEAD').toString().trim(),
	diff: createHash('sha1').update(execSync('git diff HEAD').toString()).digest('hex'),
})

const mode = process.argv[2]

if (mode === 'write') {
	const state = { ...fingerprint(), at: new Date().toISOString() }
	mkdirSync(dirname(MARKER), { recursive: true })
	writeFileSync(MARKER, JSON.stringify(state, null, 2))
	console.log(`Review recorded for diff ${state.diff.slice(0, 8)} at ${state.at}`)
	process.exit(0)
}

if (mode === 'check') {
	if (!existsSync(MARKER)) {
		console.error('No review on record for this working copy. Run the review stage first.')
		process.exit(1)
	}

	const recorded = JSON.parse(readFileSync(MARKER, 'utf8'))
	const current = fingerprint()

	if (recorded.head !== current.head) {
		console.error(
			`The review ran against commit ${recorded.head.slice(0, 8)}, HEAD is now ${current.head.slice(0, 8)}. Review again.`
		)
		process.exit(1)
	}

	if (recorded.diff !== current.diff) {
		console.error(
			`The working tree changed since the review at ${recorded.at}. What is about to be committed is not what was reviewed.`
		)
		process.exit(1)
	}

	console.log(`Reviewed at ${recorded.at}, unchanged since.`)
	process.exit(0)
}

console.error('Usage: review-marker.mjs write|check')
process.exit(1)
