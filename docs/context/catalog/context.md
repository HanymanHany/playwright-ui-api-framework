# Context: Catalog (Home page)

**Last updated:** 2026-06-10
**Sources:** explore (live DOM dump + API probing)
**Covers:** `/` (product grid, filters, search, sort)

## Routes

| Path           | Description                                                       |
| -------------- | ----------------------------------------------------------------- |
| `/`            | Catalog: product grid (9 per page), filters sidebar, search, sort |
| `/product/:id` | Product detail page (direct navigation works)                     |

## data-test Attributes Map (verified in DOM 2026-06-10)

| Element            | data-test                             | Notes                                                                       |
| ------------------ | ------------------------------------- | --------------------------------------------------------------------------- |
| Search input       | `search-query`                        |                                                                             |
| Search submit      | `search-submit`                       |                                                                             |
| Search reset       | `search-reset`                        | X button, appears after search                                              |
| Sort select        | `sort`                                | options: name asc/desc, price asc/desc                                      |
| Category checkbox  | `category-{categoryId}`               | **ID comes from the API** — resolve via `/categories/tree` or data snapshot |
| Brand checkbox     | `brand-{brandId}`                     | same pattern                                                                |
| Product card link  | `product-{productId}`                 | navigates to `/product/{id}`                                                |
| Product card name  | `product-name`                        | `<h5>`, scoped inside card                                                  |
| Product card price | `product-price`                       | `<span>`, format `$14.15`                                                   |
| Out of stock badge | `out-of-stock`                        | only on out-of-stock cards                                                  |
| Pagination         | `pagination-prev` / `pagination-next` |                                                                             |

## UI Behavior Map

| Element           | Trigger       | Result                                                                    |
| ----------------- | ------------- | ------------------------------------------------------------------------- |
| Category checkbox | check         | grid reloads filtered (XHR to `/products?by_category=...`), no URL change |
| Search submit     | click         | grid shows matches, "Searched for: X" caption appears                     |
| Sort select       | choose option | grid reorders without reload                                              |
| Product card      | click         | navigates to `/product/{id}`                                              |

## Test Data Patterns

- Category for filtering: pick a **leaf** category from the data snapshot (`pickLeafCategory`)
- Product for direct navigation: pick an **in-stock** product (`pickInStockProduct`)
- Expected filtered product names: `GET /products?by_category={categoryId}` — compare UI grid against API truth.
  **`by_category` takes the category ID, not the slug** (a slug returns 0 results, verified 2026-08-29).
  An undocumented `by_category_slug={slug}` also works but is absent from the OpenAPI spec — do not use it

## Known Pitfalls

- Grid re-renders after filter/search — wait for response or for grid contents, not a fixed timeout
- Product card `product-name`/`product-price` are repeated per card — always scope to the card locator
