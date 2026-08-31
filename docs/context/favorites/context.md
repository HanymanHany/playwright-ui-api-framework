# Context: Favorites

**Last updated:** 2026-06-10
**Sources:** explore (live DOM dump + API probing)
**Covers:** `/account/favorites`, API `/favorites`

## data-test Attributes Map (verified in DOM 2026-06-10)

| Element           | data-test               | Notes                              |
| ----------------- | ----------------------- | ---------------------------------- |
| Page title        | `page-title`            | "Favorites"                        |
| Favorite card     | `favorite-{favoriteId}` | id = FAVORITE id (not product id!) |
| Card product name | `product-name`          | scoped inside card                 |
| Delete button     | `delete`                | one per card, scope to card        |

## API field mapping (verified live 2026-06-10)

| Endpoint                         | Verified behavior                                                          |
| -------------------------------- | -------------------------------------------------------------------------- |
| `GET /favorites`                 | array of `{id, user_id, product_id, product:{...}}`; requires Bearer token |
| `POST /favorites` `{product_id}` | 201 → `{product_id, user_id, id}`                                          |
| `DELETE /favorites/{id}`         | 204                                                                        |

## Known Pitfalls

- The card data-test uses the **favorite id**, not the product id — capture the id from the POST response
- The shared demo database resets periodically and other visitors mutate it — tests must create their own
  favorite via API, assert on THAT id, and clean up in afterAll (never assert absolute list counts)
