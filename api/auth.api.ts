/**
 * api/auth.api.ts — authentication client + token provider.
 *
 * THE TRAP: the Toolshop API issues JWTs with a 300-second lifetime.
 * Verified, not assumed — `tests/api/auth.spec.ts` asserts `exp - iat === 300`.
 * A token fetched once in global-setup is dead before a medium suite finishes.
 *
 * A NOTE ON THE PATTERN I ALMOST USED
 *
 * On a work project the token handling is a file: global-setup logs every account
 * in once, writes the tokens to disk, and workers read them synchronously. Clean,
 * zero repeated logins. I started porting it here and it does not survive contact
 * with a 300-second TTL — either every worker races to rewrite the same file, or
 * they all read a token that expired four minutes ago.
 *
 * So the file holds CREDENTIALS (core/run-user.ts) and each worker keeps its own
 * in-memory cache, re-authenticating when its token approaches expiry. One cheap
 * POST per worker per four minutes, no shared mutable state, no races.
 *
 * Same problem, different constraint, different answer. Copying a pattern without
 * re-checking its constraints is exactly the failure mode this framework guards against.
 */
import { API_BASE_URL, staticAccounts, StaticAccountKey } from '../config/env'
import { readRunUser } from '../core/run-user'
import { createLogger } from '../utils/logger'

import { createApiClient, toRaw, unwrap, type ApiClient } from './client'

import type { TokenResponse } from './types'

const log = createLogger('AuthApi')

export class AuthApi {
	private readonly client: ApiClient

	constructor(baseUrl: string = API_BASE_URL) {
		this.client = createApiClient(baseUrl)
	}

	/** Logs in with explicit credentials. Returns the raw JWT string. */
	async login(email: string, password: string): Promise<string> {
		const result = await this.client.POST('/users/login', { body: { email, password } })
		return (unwrap(result, 'POST /users/login') as TokenResponse).access_token
	}

	/** Raw login attempt for negative tests — returns status + body, never throws. */
	async loginRaw(email: string, password: string): Promise<{ status: number; body: unknown }> {
		const result = await this.client.POST('/users/login', { body: { email, password } })
		return toRaw(result)
	}
}

// ── Token provider with TTL-aware caching ─────────────────────────────────────

/** Refresh 60s before the 300s expiry to leave headroom for slow requests. */
const TOKEN_REFRESH_AFTER_MS = 240_000

interface CachedToken {
	token: string
	fetchedAt: number
}

/** Per-worker process cache. Workers are separate processes, so no cross-worker races. */
const cache = new Map<string, CachedToken>()

async function cachedLogin(key: string, credentials: { email: string; password: string }): Promise<string> {
	const cached = cache.get(key)
	if (cached && Date.now() - cached.fetchedAt < TOKEN_REFRESH_AFTER_MS) {
		return cached.token
	}
	log.info(`Token for "${key}" missing or stale — logging in`)
	const token = await new AuthApi().login(credentials.email, credentials.password)
	cache.set(key, { token, fetchedAt: Date.now() })
	return token
}

/**
 * Token for the user this run registered — what every test uses.
 *
 * Always call it at the point of use. Hoisting the result into a long-lived
 * variable reintroduces the exact expiry bug this provider exists to prevent.
 */
export async function getToken(): Promise<string> {
	const user = readRunUser()
	return cachedLogin(`run:${user.email}`, user)
}

/**
 * Token for a static account. Only teardown needs this: a user cannot delete
 * itself (the API answers 403), so removing the run user takes the admin role.
 */
export async function getStaticToken(account: StaticAccountKey): Promise<string> {
	return cachedLogin(`static:${account}`, staticAccounts[account])
}
