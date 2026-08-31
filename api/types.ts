/**
 * api/types.ts — domain types derived from the live OpenAPI contract.
 *
 * `api/generated/schema.d.ts` is GENERATED — never edit it by hand:
 *
 *     npm run api:types      # re-downloads /docs and regenerates
 *
 * Why a layer on top of the generated file instead of using it directly?
 *
 * The Toolshop spec marks almost nothing as `required`, so every generated field
 * comes out optional (`id?: string`). Using those types raw means either a `!` on
 * every property access or `possibly undefined` errors everywhere — both hide the
 * real question, which is: does the API actually send this field?
 *
 * So we do two things, and they are deliberately different jobs:
 *   1. Field NAMES and shapes come from the generated schema (compile time).
 *      Rename a field on the backend, regenerate, and `npm run typecheck` points
 *      at every line that breaks.
 *   2. Whether those fields are really PRESENT is verified at runtime by
 *      `tests/api/contract.spec.ts`, which validates live responses against the
 *      same spec. A generated type is a promise; a contract test is the proof.
 *
 * `Ensure<T, K>` below narrows exactly the fields our tests depend on. If the
 * contract test goes red, this file is lying and must be updated — that is the
 * signal we want, and it is why the two mechanisms are kept separate.
 */
import type { components, operations } from './generated/schema'

type Schemas = components['schemas']

/** Makes the listed optional keys required and non-nullable. */
type Ensure<T, K extends keyof T> = Omit<T, K> & { [P in K]-?: NonNullable<T[P]> }

/** Unwraps the JSON body of a documented 2xx response. */
type JsonResponse<T> = T extends { content: { 'application/json': infer B } } ? B : never

// ── Catalog ───────────────────────────────────────────────────────────────────

export type Brand = Ensure<Schemas['BrandResponse'], 'id' | 'name' | 'slug'>

export type Category = Ensure<Schemas['CategoryResponse'], 'id' | 'name' | 'slug'>

export type CategoryNode = Ensure<Schemas['CategoryTreeResponse'], 'id' | 'name' | 'slug'> & {
	sub_categories: Category[]
}

export type Product = Ensure<Schemas['ProductResponse'], 'id' | 'name' | 'price' | 'in_stock'> & {
	category: Category
	brand: Brand
}

/**
 * The pagination envelope is declared inline in the path, not in `components`,
 * so we pull it out of the generated operation rather than re-typing it.
 */
type ProductsPage = JsonResponse<operations['getProducts']['responses']['200']>

export type Paginated<T> = Omit<ProductsPage, 'data'> & { data: T[] }

export type ProductsPageResponse = Paginated<Product>

// ── Users ─────────────────────────────────────────────────────────────────────

export type User = Ensure<Schemas['UserResponse'], 'id' | 'first_name' | 'last_name' | 'email'>

/** Registration payload — this one the spec DOES mark required, so it is used as-is. */
export type NewUser = Schemas['UserRequest']

export type TokenResponse = Ensure<
	JsonResponse<operations['login-customer']['responses']['200']>,
	'access_token' | 'expires_in'
>

// ── Favorites ─────────────────────────────────────────────────────────────────

export type Favorite = Ensure<Schemas['FavoriteResponse'], 'id' | 'product_id'>

export type FavoriteWithProduct = Ensure<Schemas['FavoriteWithProductResponse'], 'id' | 'product_id'> & {
	product: Product
}
