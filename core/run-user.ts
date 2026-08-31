/**
 * core/run-user.ts — the user this suite run owns.
 *
 * WHY THIS EXISTS
 *
 * The target is a public demo store. The shared `customer@practicesoftwaretesting.com`
 * account is used by everyone reading the docs, by the demo's own reseed job, and —
 * the part that actually bites — by every worker of our own suite at the same time.
 * One worker empties the cart while another asserts it has one line, and you get a
 * flake that reproduces once every twenty runs and never on your machine.
 *
 * Adding retries to that test would hide it. The fix is one level down: stop sharing.
 * `global-setup` registers a brand-new user for this run, every test acts as that user,
 * and nothing outside the run can touch its data. That is what makes `fullyParallel`
 * honest rather than optimistic.
 *
 * The same idea, one size up, is how you parallelise a real suite: a unique prefix or
 * a unique tenant per run, so N workers never collide on shared entities.
 *
 * The payload itself comes from `data/test-user.data.ts` — the one place that knows
 * what a valid account looks like on this API.
 */
import * as fs from 'fs'
import * as path from 'path'

import { RUN_USER_FILE } from '../config/env'
import { buildApiUser, TestUser } from '../data/test-user.data'

/** Credentials plus the id the API assigned — everything a worker needs to act as this user. */
export interface RunUser {
	id: string
	email: string
	password: string
	firstName: string
	lastName: string
	registeredAt: string
}

/** The registration payload for this run's own account. */
export function buildRunUser(): TestUser {
	return buildApiUser('suite')
}

export function saveRunUser(user: RunUser): void {
	fs.mkdirSync(path.dirname(RUN_USER_FILE), { recursive: true })
	fs.writeFileSync(RUN_USER_FILE, JSON.stringify(user, null, 2))
}

/**
 * Read by workers, not by tests directly — `getToken()` and the fixtures use it.
 * Synchronous on purpose: it is a local file read, not a network call.
 */
export function readRunUser(): RunUser {
	if (!fs.existsSync(RUN_USER_FILE)) {
		throw new Error(`Run user not found at ${RUN_USER_FILE} — global-setup did not run or failed`)
	}
	return JSON.parse(fs.readFileSync(RUN_USER_FILE, 'utf-8')) as RunUser
}

export function deleteRunUserFile(): void {
	if (fs.existsSync(RUN_USER_FILE)) fs.unlinkSync(RUN_USER_FILE)
}
