#!/usr/bin/env node
/**
 * Refuses a tag that is not in the registry.
 *
 * `tests/tags.ts` makes a mistyped tag a compile error — but only for code that uses
 * it. Nothing stops the next person from writing `{ tag: ['@smok'] }` directly, and
 * that mistake is invisible: no error, no red test, the test simply drops out of the
 * smoke run and nobody finds out until the release it should have caught.
 *
 * So this runs with the other static gates, before anything launches a browser:
 *
 *   node scripts/check-tags.mjs
 *
 * It fails on two things — a raw '@tag' string inside a `tag:` option, and a tag
 * referenced through the registry that the registry does not define. Plain Node, no
 * dependencies, because it runs on Windows locally and on Linux in CI.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

const TESTS_DIR = 'tests'
const REGISTRY = 'tests/tags.ts'

/** Every key defined in TAGS — parsed from the source, so there is one definition. */
function registryKeys() {
	const source = readFileSync(REGISTRY, 'utf8')
	const body = source.slice(source.indexOf('export const TAGS'), source.indexOf('} as const'))
	return new Set([...body.matchAll(/^\t(\w+):\s*'@[\w-]+'/gm)].map((match) => match[1]))
}

function specFiles(dir) {
	return readdirSync(dir).flatMap((entry) => {
		const full = join(dir, entry)
		if (statSync(full).isDirectory()) return specFiles(full)
		return full.endsWith('.spec.ts') ? [full] : []
	})
}

const keys = registryKeys()
if (keys.size === 0) {
	console.error(`${REGISTRY}: could not read any tag from the registry — has its shape changed?`)
	process.exit(1)
}

const problems = []

for (const file of specFiles(TESTS_DIR)) {
	const source = readFileSync(file, 'utf8')
	const lines = source.split('\n')

	lines.forEach((line, index) => {
		const option = /tag:\s*\[([^\]]*)\]/.exec(line)
		if (!option) return
		const where = `${file}:${index + 1}`

		for (const [, literal] of option[1].matchAll(/['"](@[\w-]+)['"]/g)) {
			problems.push(`${where}  raw tag ${literal} — use the constant from ${REGISTRY}`)
		}
		for (const [, key] of option[1].matchAll(/TAGS\.(\w+)/g)) {
			if (!keys.has(key)) problems.push(`${where}  TAGS.${key} is not defined in ${REGISTRY}`)
		}
	})
}

if (problems.length > 0) {
	console.error(`Tag check failed (${problems.length}):\n${problems.map((p) => `  ${p}`).join('\n')}`)
	process.exit(1)
}

console.log(`Tags OK — ${keys.size} registered, no raw literals in ${TESTS_DIR}/.`)
