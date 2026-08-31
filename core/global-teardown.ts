/**
 * core/global-teardown.ts — runs ONCE after all tests, pass or fail.
 *
 * Cleanup order matters: entities first (as their owner), then the owner itself.
 *
 * The user cannot delete itself — the API answers 403, verified against the live
 * endpoint — so the account is removed with the admin role. On an environment
 * where admin is not available this simply logs a warning: leaving one throwaway
 * account behind is a smaller problem than a teardown that fails the whole run.
 *
 * Nothing here is allowed to throw. Teardown that crashes turns a red test into a
 * red run with a misleading cause, and that costs an hour of someone's morning.
 */
import * as fs from 'fs'

import { FavoritesApi } from '../api/favorites.api'
import { UsersApi } from '../api/users.api'
import { AUTH_STATE_FILE, DATA_SNAPSHOT_FILE, OPENAPI_SPEC_FILE } from '../config/env'
import { createLogger } from '../utils/logger'

import { deleteRunUserFile, readRunUser } from './run-user'

const log = createLogger('GlobalTeardown')

function removeIfExists(file: string): void {
	if (fs.existsSync(file)) fs.unlinkSync(file)
}

export default async function globalTeardown(): Promise<void> {
	try {
		const user = readRunUser()

		const removed = await new FavoritesApi().clearAll().catch(() => -1)
		if (removed >= 0) log.info(`Removed ${removed} leftover favorite(s)`)

		const { status } = await new UsersApi().deleteAsAdmin(user.id)
		if (status >= 200 && status < 300) {
			log.info(`Run user ${user.email} deleted`)
		} else {
			log.warn(`Could not delete run user ${user.email} (HTTP ${status}) — left behind`)
		}
	} catch (error) {
		log.warn(`Teardown skipped: ${(error as Error).message}`)
	} finally {
		deleteRunUserFile()
		removeIfExists(AUTH_STATE_FILE)
		removeIfExists(DATA_SNAPSHOT_FILE)
		removeIfExists(OPENAPI_SPEC_FILE)
	}
}
