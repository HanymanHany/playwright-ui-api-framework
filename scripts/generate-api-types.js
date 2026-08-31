/**
 * scripts/generate-api-types.js — regenerates api/generated/schema.d.ts.
 *
 *     npm run api:types
 *
 * Why a script instead of putting the command in package.json?
 *
 * Because the URL was written twice: once in `config/env.ts` as OPENAPI_URL, once as
 * a literal in the npm script. Point the framework at a staging environment and the
 * tests would read one spec while the generator downloaded another — and nothing
 * would say so. The types would simply describe a different server.
 *
 * Plain CommonJS on purpose: this runs before anything is compiled, so it must not
 * need ts-node or tsx. It reads .env the same way config/env.ts does, and applies the
 * same default, which is the one duplicate that cannot be removed without compiling.
 */
const { spawnSync } = require('child_process')

require('dotenv').config()

const API_BASE_URL = process.env.API_BASE_URL ?? 'https://api.practicesoftwaretesting.com'
const OPENAPI_URL = process.env.OPENAPI_URL ?? `${API_BASE_URL}/docs`
const OUTPUT = 'api/generated/schema.d.ts'

console.log(`Generating ${OUTPUT} from ${OPENAPI_URL}`)

const result = spawnSync('npx', ['openapi-typescript', OPENAPI_URL, '-o', OUTPUT], {
	stdio: 'inherit',
	shell: process.platform === 'win32',
})

if (result.status !== 0) {
	console.error(`\nFailed to generate types from ${OPENAPI_URL}`)
	process.exit(result.status ?? 1)
}
