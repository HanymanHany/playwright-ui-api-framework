/**
 * api/users.api.ts — registration and user profile.
 *
 * `register()` is what makes the run self-sufficient: the suite creates the account
 * it will act as instead of borrowing the shared demo customer.
 */
import { API_BASE_URL } from '../config/env'

import { getStaticToken, getToken } from './auth.api'
import { bearer, createApiClient, toRaw, unwrap, type ApiClient } from './client'

import type { NewUser, User } from './types'

export class UsersApi {
	private readonly client: ApiClient

	constructor(baseUrl: string = API_BASE_URL) {
		this.client = createApiClient(baseUrl)
	}

	/** Creates a new customer account. Public endpoint — no token needed. */
	async register(user: NewUser): Promise<User> {
		const result = await this.client.POST('/users/register', { body: user })
		return unwrap(result, 'POST /users/register') as User
	}

	/**
	 * Raw registration for negative tests — returns status + body, never throws.
	 * Takes a Partial on purpose: the point of these tests is sending a payload the
	 * API should refuse, so the body is cast past the generated type deliberately.
	 */
	async registerRaw(user: Partial<NewUser>): Promise<{ status: number; body: unknown }> {
		const result = await this.client.POST('/users/register', { body: user as NewUser })
		return toRaw(result)
	}

	/** Current user's profile — also a cheap "is my token still valid" check. */
	async me(): Promise<User> {
		const result = await this.client.GET('/users/me', { headers: bearer(await getToken()) })
		return unwrap(result, 'GET /users/me') as User
	}

	/**
	 * Profile of whoever owns the given token. Needed when a test acts as an
	 * account other than the run user — e.g. one it just registered through the UI
	 * and now has to clean up.
	 */
	async meAs(token: string): Promise<User> {
		const result = await this.client.GET('/users/me', { headers: bearer(token) })
		return unwrap(result, 'GET /users/me') as User
	}

	/** Updates the run user's own profile. */
	async updateMe(userId: string, changes: Partial<NewUser>): Promise<unknown> {
		const result = await this.client.PUT('/users/{userId}', {
			params: { path: { userId } },
			headers: bearer(await getToken()),
			body: changes as NewUser,
		})
		return unwrap(result, 'PUT /users/{userId}')
	}

	/**
	 * Deletes a user. Requires the admin role — a customer deleting itself gets 403
	 * (verified against the live API). Used only by global-teardown.
	 */
	async deleteAsAdmin(userId: string): Promise<{ status: number; body: unknown }> {
		const result = await this.client.DELETE('/users/{userId}', {
			params: { path: { userId } },
			headers: bearer(await getStaticToken('admin')),
		})
		return toRaw(result)
	}
}
