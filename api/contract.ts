/**
 * api/contract.ts — runtime validation of live responses against the OpenAPI spec.
 *
 * WHY THIS EXISTS ALONGSIDE THE GENERATED TYPES
 *
 * `npm run api:types` gives us compile-time safety: rename a field on the backend,
 * regenerate, and TypeScript points at every line that breaks. But a generated type
 * is only a claim about the spec — it says nothing about what the server actually
 * sends today. The two failure modes are different and both are real:
 *
 *   spec says X, code says Y   → caught by `npm run typecheck` after regeneration
 *   spec says X, server says Z → caught only here, at runtime, against live data
 *
 * The second one is the expensive one. It is how an API test suite stays green for
 * three weeks while the mobile team is already broken in production.
 *
 * The spec is downloaded ONCE in global-setup (`.auth/openapi.json`) so every worker
 * validates against exactly the same document — a contract test that races the
 * backend's deploy is worse than no contract test.
 */
import * as fs from 'fs'

import Ajv2020, { type ErrorObject } from 'ajv/dist/2020'
import addFormats from 'ajv-formats'

import { OPENAPI_SPEC_FILE } from '../config/env'

interface OpenApiDocument {
	openapi: string
	info: { title: string; version: string }
	paths: Record<string, Record<string, unknown>>
	components: { schemas: Record<string, unknown> }
}

let cached: OpenApiDocument | null = null

export function readSpec(): OpenApiDocument {
	if (cached) return cached
	if (!fs.existsSync(OPENAPI_SPEC_FILE)) {
		throw new Error(`OpenAPI spec not found at ${OPENAPI_SPEC_FILE} — global-setup did not run or failed`)
	}
	cached = JSON.parse(fs.readFileSync(OPENAPI_SPEC_FILE, 'utf-8')) as OpenApiDocument
	return cached
}

/**
 * Pulls the JSON schema of a documented response out of the spec.
 * Throws when the operation or status is missing — which is itself a finding:
 * it means the framework calls something the API no longer documents.
 */
export function responseSchema(path: string, method: string, status: string): object {
	const spec = readSpec()
	const operation = spec.paths[path]?.[method.toLowerCase()] as
		| { responses?: Record<string, { content?: Record<string, { schema?: object }> }> }
		| undefined

	if (!operation) throw new Error(`Spec has no operation ${method.toUpperCase()} ${path}`)

	const schema = operation.responses?.[status]?.content?.['application/json']?.schema
	if (!schema) {
		throw new Error(`Spec has no application/json schema for ${method.toUpperCase()} ${path} → ${status}`)
	}
	return schema
}

export interface ValidationResult {
	valid: boolean
	/** Human-readable, one line per violation — goes straight into the assertion message. */
	errors: string[]
}

/**
 * Validates data against a schema taken from the spec.
 *
 * `components` is attached to the compiled root so that `$ref: "#/components/..."`
 * inside the schema resolves without registering the whole document separately.
 */
export function validateAgainstSchema(schema: object, data: unknown): ValidationResult {
	const ajv = new Ajv2020({ allErrors: true, strict: false })
	addFormats(ajv)

	const validate = ajv.compile({ ...schema, components: readSpec().components })
	const valid = validate(data) as boolean

	return {
		valid,
		errors: (validate.errors ?? []).map(describe),
	}
}

function describe(error: ErrorObject): string {
	const where = error.instancePath || '(root)'
	const extra = error.params && Object.keys(error.params).length ? ` ${JSON.stringify(error.params)}` : ''
	return `${where} ${error.message}${extra}`
}

/** Convenience wrapper: validate `data` against the documented response of an operation. */
export function validateResponse(path: string, method: string, status: string, data: unknown): ValidationResult {
	return validateAgainstSchema(responseSchema(path, method, status), data)
}
