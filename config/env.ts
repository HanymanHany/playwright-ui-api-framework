/**
 * config/env.ts — single source of truth for all environment variables.
 *
 * Rule: every other file imports from here. Nobody reads process.env directly.
 *
 * Why two .env files?
 *   .env         — local values; NEVER committed to git
 *   .env.example — committed template so anyone can see which variables exist
 *
 * Defaults point to the public Toolshop demo (https://practicesoftwaretesting.com),
 * so the project runs out of the box: clone → npm install → npm test.
 *
 * On a real project the defaults would be gone and `requireEnv()` would guard the
 * secrets — see the `requireEnv` doc comment for why fail-fast beats silent defaults.
 */
import * as dotenv from 'dotenv'
dotenv.config()

// ── Validation ────────────────────────────────────────────────────────────────

/**
 * Reads a variable that MUST be present. Throws at import time — before a single
 * test starts — instead of failing 40 minutes into a suite with a confusing 401.
 *
 * Nothing in this demo uses it (the public target needs no secrets), but it stays
 * here as the pattern to copy: the moment you point this framework at a real
 * environment, credentials go through `requireEnv`, never through `??` defaults.
 */
export function requireEnv(name: string): string {
	const value = process.env[name]
	if (!value) {
		throw new Error(`Missing required environment variable: ${name}. ` + `Copy .env.example to .env and fill it in.`)
	}
	return value
}

// ── Base URLs ─────────────────────────────────────────────────────────────────

export const UI_BASE_URL = process.env.UI_BASE_URL ?? 'https://practicesoftwaretesting.com'
export const API_BASE_URL = process.env.API_BASE_URL ?? 'https://api.practicesoftwaretesting.com'

/** The OpenAPI document the generated types and the contract test are built from. */
export const OPENAPI_URL = process.env.OPENAPI_URL ?? `${API_BASE_URL}/docs`

// ── Run identity ──────────────────────────────────────────────────────────────

/**
 * A short id unique to this suite run. Everything this run creates is namespaced
 * with it, which is what makes parallel execution on a SHARED environment safe:
 * two runs (or two workers) never touch the same entity.
 *
 * CI passes the workflow run id; locally it falls back to a timestamp.
 */
export const RUN_ID = process.env.RUN_ID ?? Date.now().toString(36)

// ── Static accounts ───────────────────────────────────────────────────────────
// Public demo credentials published by the Toolshop maintainers — not secrets.
// Real projects: keep credentials ONLY in .env and CI secret variables.
//
// NOTE: the shared `customer` account is deliberately NOT used by the suite.
// Tests run as a user this run registers for itself (see core/run-user.ts).
// `admin` is used only for teardown, because a user cannot delete itself (403).

export type StaticAccountKey = 'admin'

export interface Credentials {
	email: string
	password: string
}

export const staticAccounts: Record<StaticAccountKey, Credentials> = {
	admin: {
		email: process.env.ADMIN_EMAIL ?? 'admin@practicesoftwaretesting.com',
		password: process.env.ADMIN_PASSWORD ?? 'welcome01',
	},
}

// ── Runtime ───────────────────────────────────────────────────────────────────

/** HEADLESS=false → browser window is visible. Defaults to true. */
export const HEADLESS = process.env.HEADLESS !== 'false'

/** Number of parallel workers (separate browser processes). */
export const WORKERS = parseInt(process.env.WORKERS ?? '4', 10)

// ── Artifacts written by global-setup ─────────────────────────────────────────

/** Browser session (cookies + localStorage) of the run user. */
export const AUTH_STATE_FILE = '.auth/run-user-state.json'

/** Credentials + id of the user this run registered. */
export const RUN_USER_FILE = '.auth/run-user.json'

/** Reference data (categories, brands, products) fetched once from the API. */
export const DATA_SNAPSHOT_FILE = '.auth/data-snapshot.json'

/** The OpenAPI document, downloaded once so all workers validate against the same one. */
export const OPENAPI_SPEC_FILE = '.auth/openapi.json'
