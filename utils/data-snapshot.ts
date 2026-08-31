/**
 * utils/data-snapshot.ts — API reference data shared by the whole suite.
 *
 * Pattern: global-setup fetches the catalog's stable parts from the API ONCE
 * (categories, brands, the first pages of products) into `.auth/data-snapshot.json`.
 * Spec files read it synchronously in `beforeAll` instead of re-fetching — instant,
 * and every test works against the same consistent view of the catalog.
 *
 * What belongs here: data the tests READ and never change.
 * What must never be here: anything the tests create or mutate (favorites, cart,
 * profile). A snapshot of mutable state is a stale assertion with a delay fuse —
 * tests fetch that live.
 */
import * as fs from 'fs'

import { DATA_SNAPSHOT_FILE } from '../config/env'

import type { Brand, CategoryNode, Product } from '../api/types'

export interface DataSnapshot {
	builtAt: string
	categories: CategoryNode[]
	brands: Brand[]
	/** Enough of the catalog to serve every allocation below, with headroom. */
	products: Product[]
}

export function writeDataSnapshot(snapshot: DataSnapshot): void {
	fs.writeFileSync(DATA_SNAPSHOT_FILE, JSON.stringify(snapshot, null, 2))
}

export function readDataSnapshot(): DataSnapshot {
	if (!fs.existsSync(DATA_SNAPSHOT_FILE)) {
		throw new Error(`Data snapshot not found at ${DATA_SNAPSHOT_FILE} — global-setup did not run or failed`)
	}
	return JSON.parse(fs.readFileSync(DATA_SNAPSHOT_FILE, 'utf-8')) as DataSnapshot
}

// ── Product allocation ────────────────────────────────────────────────────────

/**
 * Which spec file gets how many products.
 *
 * THE PROBLEM THIS SOLVES
 *
 * `fullyParallel` is on and all specs act as the SAME run user, so two files must
 * never favourite the same product — the API rejects the duplicate and one of them
 * fails, in a different worker, roughly once in twenty runs.
 *
 * The first version handled this with index arithmetic inside each spec:
 * `pickInStockProducts(snapshot, 4)` in one file, `pickInStockProducts(snapshot, 8).slice(4)`
 * in another. It worked, and it was a trap. The contract between those two files
 * existed nowhere: nothing named it, nothing checked it, and the third spec to be
 * added would have silently overlapped. That is the kind of bug you get to debug at
 * 3am six months later.
 *
 * This registry makes the contract explicit. Offsets are computed from declaration
 * order, so adding a consumer cannot collide with an existing one — and if the
 * catalog shrinks below what is needed, setup fails immediately with a message that
 * says exactly what to do.
 *
 * Files whose state is browser-local (the cart lives in the browser context) do not
 * strictly need this, but they take a slice anyway: it keeps one rule instead of two,
 * and "this one is fine because of where its state lives" is a footnote nobody reads.
 */
const PRODUCT_ALLOCATIONS = {
	'api/favorites': 3,
	'hybrid/favorites': 2,
	'ui/cart': 2,
} as const

export type ProductConsumer = keyof typeof PRODUCT_ALLOCATIONS

/** Total in-stock products the snapshot must contain for the suite to run. */
export const REQUIRED_PRODUCTS = Object.values(PRODUCT_ALLOCATIONS).reduce((sum, n) => sum + n, 0)

/**
 * Returns the product slice reserved for a spec file. Distinct consumers always get
 * distinct products.
 *
 * ```ts
 * products = productsFor(snapshot, 'hybrid/favorites')
 * ```
 */
export function productsFor(snapshot: DataSnapshot, consumer: ProductConsumer): Product[] {
	const inStock = snapshot.products.filter((p) => p.in_stock)

	let offset = 0
	for (const [name, count] of Object.entries(PRODUCT_ALLOCATIONS)) {
		if (name !== consumer) {
			offset += count
			continue
		}
		const slice = inStock.slice(offset, offset + count)
		if (slice.length < count) {
			throw new Error(
				`Snapshot has ${inStock.length} in-stock products, "${consumer}" needs ${count} at offset ${offset}. ` +
					`The suite requires ${REQUIRED_PRODUCTS} in total — increase the pages fetched in global-setup.`
			)
		}
		return slice
	}

	throw new Error(`Unknown product consumer "${consumer}"`)
}

// ── Other picks ───────────────────────────────────────────────────────────────

/** Any in-stock product, for tests that need one and do not care which. */
export function pickInStockProduct(snapshot: DataSnapshot): Product {
	const product = snapshot.products.find((p) => p.in_stock)
	if (!product) {
		throw new Error('Data snapshot has no in-stock products — check the target environment')
	}
	return product
}

/** A leaf category (no sub-categories) — the UI renders those as filter checkboxes. */
export function pickLeafCategory(snapshot: DataSnapshot): CategoryNode {
	for (const root of snapshot.categories) {
		const leaf = root.sub_categories.find((c) => (c.sub_categories?.length ?? 0) === 0)
		if (leaf) return leaf as CategoryNode
	}
	throw new Error('Data snapshot has no leaf categories')
}

/**
 * A search term taken from the live catalog, rather than a word typed into the test.
 *
 * `searchProducts('pliers')` reads fine until the demo catalog is reseeded without
 * pliers, and then a search test fails for a reason that has nothing to do with
 * search. This picks a word that several real product names share, so the query is
 * guaranteed to return more than one row and the assertion stays meaningful.
 */
export function pickSearchTerm(snapshot: DataSnapshot): string {
	const counts = new Map<string, number>()

	for (const product of snapshot.products) {
		// Distinct words only — "Claw Hammer with Grip" must not count "Hammer" twice
		const words = new Set(
			product.name
				.toLowerCase()
				.split(/[^a-z]+/)
				.filter((w) => w.length >= 5)
		)
		for (const word of words) {
			counts.set(word, (counts.get(word) ?? 0) + 1)
		}
	}

	const shared = [...counts.entries()].filter(([, n]) => n >= 2).sort((a, b) => b[1] - a[1])

	if (shared.length === 0) {
		throw new Error('No word is shared by two product names — cannot derive a search term')
	}
	return shared[0]![0]
}
