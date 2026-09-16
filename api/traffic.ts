/**
 * api/traffic.ts — what the suite said to the API, and what came back.
 *
 * WHY THIS EXISTS
 *
 * A failing UI test hands you a screenshot, a trace and the browser console. A
 * failing API test hands you one line: expected 201, received 422. The request that
 * caused it, the body the server objected to, and the calls that set the state up
 * are all gone, so the first move is always "reproduce it locally" — which on a
 * shared environment reproduces a slightly different situation.
 *
 * So every request goes through one place (`api/client.ts` installs the middleware),
 * every exchange is recorded, and a test that fails attaches the whole conversation
 * to the report. Passing tests attach nothing: this is diagnostics, not logging.
 *
 * Three rules shape the output below:
 *
 *  - **Secrets never reach the report.** Redaction happens here, on the way in, not
 *    at render time — a value that was never stored cannot leak later.
 *  - **The failed call comes first**, with both bodies. That is what the reader
 *    opened the attachment for.
 *  - **Every entry carries a `curl` that reproduces it.** Reading a failure and
 *    re-running it by hand are two different jobs; the attachment should not leave
 *    the second one as an exercise.
 */

/** One request/response pair, already redacted and trimmed. */
export interface Exchange {
	method: string
	/** Path template as called, without the base URL — what the reader recognises. */
	path: string
	url: string
	status: number
	ms: number
	/** Whether the call carried an Authorization header. The token itself is never kept. */
	authenticated: boolean
	requestBody?: unknown
	responseBody?: unknown
}

// ── Redaction ─────────────────────────────────────────────────────────────────

/** Keys whose value must never appear in a log, a report or an attachment. */
const SECRET_KEYS = new Set(['password', 'access_token', 'refresh_token', 'token', 'authorization', 'secret'])

const REDACTED = '[redacted]'
const MAX_BODY_CHARS = 2000
const MAX_ARRAY_ITEMS = 25
const MAX_DEPTH = 6

/**
 * Deep copy with secrets removed. Arrays are capped as well — a product listing is
 * 200 KB of JSON and nobody reads past the first few entries of it in a report.
 */
export function redact(value: unknown, depth = 0): unknown {
	if (depth > MAX_DEPTH || value === null || typeof value !== 'object') return value
	if (Array.isArray(value)) {
		const head = value.slice(0, MAX_ARRAY_ITEMS).map((item) => redact(item, depth + 1))
		return value.length > MAX_ARRAY_ITEMS ? [...head, `… ${value.length - MAX_ARRAY_ITEMS} more`] : head
	}

	const out: Record<string, unknown> = {}
	for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
		out[key] = SECRET_KEYS.has(key.toLowerCase()) ? REDACTED : redact(item, depth + 1)
	}
	return out
}

/** Parses a body if it is JSON, redacts it, and keeps the result small. */
export function sanitizeBody(raw: string | undefined): unknown {
	if (!raw) return undefined
	try {
		return redact(JSON.parse(raw))
	} catch {
		return raw.length > MAX_BODY_CHARS ? `${raw.slice(0, MAX_BODY_CHARS)}… (${raw.length} chars)` : raw
	}
}

// ── Recording ─────────────────────────────────────────────────────────────────

/**
 * Workers are separate processes and tests inside one worker run sequentially, so a
 * single module-level buffer is enough — there is no second test to interleave with.
 * Recording is OFF unless a test turned it on, which keeps global-setup, teardown and
 * any one-off script out of the report.
 */
let current: Exchange[] | null = null

export function startRecording(): void {
	current = []
}

export function stopRecording(): Exchange[] {
	const recorded = current ?? []
	current = null
	return recorded
}

export function isRecording(): boolean {
	return current !== null
}

export function record(exchange: Exchange): void {
	current?.push(exchange)
}

// ── Rendering ─────────────────────────────────────────────────────────────────

const RULE = '─'.repeat(72)

function text(body: unknown): string {
	if (body === undefined || body === null) return ''
	return typeof body === 'string' ? body : JSON.stringify(body)
}

/** POSIX shell quoting — the reader may be in Git Bash on Windows. */
function quote(value: string): string {
	return `'${value.replace(/'/g, `'\\''`)}'`
}

/**
 * One exchange as a command that can be pasted into a terminal.
 *
 * The token is deliberately `$TOKEN` rather than the real one: the attachment lands
 * in CI artifacts, and a live JWT in a build log is a security incident, not a
 * convenience. The header line above the report says how to get one.
 */
export function curlOf(exchange: Exchange): string {
	const parts = [`curl -i -X ${exchange.method} ${quote(exchange.url)}`]
	if (exchange.authenticated) parts.push(`  -H ${quote('Authorization: Bearer $TOKEN')}`)

	const body = text(exchange.requestBody)
	if (body) {
		parts.push(`  -H ${quote('Content-Type: application/json')}`)
		parts.push(`  -d ${quote(body)}`)
	}
	return parts.join(' \\\n')
}

function summary(exchange: Exchange, index: number): string {
	const who = exchange.authenticated ? ' (authenticated)' : ''
	return `[${String(index + 1).padStart(2)}] ${exchange.method} ${exchange.path} → ${exchange.status} (${exchange.ms} ms)${who}`
}

function detail(exchange: Exchange, index: number): string {
	const lines = [summary(exchange, index)]
	const request = text(exchange.requestBody)
	if (request) lines.push(`     request:  ${request}`)
	lines.push(`     response: ${text(exchange.responseBody) || '(empty)'}`)
	lines.push('     reproduce:')
	lines.push(
		curlOf(exchange)
			.split('\n')
			.map((line) => `       ${line}`)
			.join('\n')
	)
	return lines.join('\n')
}

/**
 * The whole conversation of one test: anything that was not 2xx first, in full, then
 * every call in order as one line each.
 *
 * When nothing failed at the HTTP level the last call gets the full treatment
 * instead — a test can fail on a perfectly good 200 whose body is wrong, and then the
 * last response is exactly what the reader needs to see.
 */
export function trafficReport(exchanges: Exchange[], title?: string): string {
	if (exchanges.length === 0) return 'No API traffic was recorded for this test.'

	const failed = exchanges.filter((exchange) => exchange.status < 200 || exchange.status >= 300)
	const out: string[] = []

	if (title) out.push(title, '')
	out.push(`${exchanges.length} request(s), ${failed.length} of them not 2xx.`)
	out.push(
		`Secrets appear as ${REDACTED} and have to be filled in before a curl will replay; ` +
			'an authenticated call needs `export TOKEN=<access_token from a login response>`.'
	)

	if (failed.length > 0) {
		out.push('', RULE, '  NOT 2xx', RULE, '')
		out.push(failed.map((exchange) => detail(exchange, exchanges.indexOf(exchange))).join('\n\n'))
	}

	out.push('', RULE, '  EVERY REQUEST, IN ORDER', RULE, '')
	out.push(exchanges.map((exchange, index) => summary(exchange, index)).join('\n'))

	const last = exchanges[exchanges.length - 1]
	if (failed.length === 0 && last) {
		out.push('', RULE, '  LAST REQUEST', RULE, '')
		out.push(detail(last, exchanges.length - 1))
	}

	return `${out.join('\n')}\n`
}
