# Context: Cart / Checkout

**Last updated:** 2026-06-10
**Sources:** explore (live DOM dump)
**Covers:** `/product/:id` (add to cart), `/checkout` (multi-step wizard)

## data-test Attributes Map (verified in DOM 2026-06-10)

### Product page

| Element             | data-test                                 |
| ------------------- | ----------------------------------------- |
| Product name        | `product-name` (`<h1>`)                   |
| Unit price          | `unit-price` (number, no `$`)             |
| Quantity input      | `quantity`                                |
| Increase / decrease | `increase-quantity` / `decrease-quantity` |
| Add to cart         | `add-to-cart`                             |
| Add to favorites    | `add-to-favorites`                        |

### Checkout step 1 (cart)

| Element                    | data-test                  |
| -------------------------- | -------------------------- |
| Cart icon counter (header) | `cart-quantity`            |
| Line title                 | `product-title`            |
| Line quantity input        | `product-quantity`         |
| Line unit price            | `product-price` (`$14.15`) |
| Line total                 | `line-price`               |
| Cart total                 | `cart-total`               |
| Proceed to step 2          | `proceed-1`                |

### Checkout steps 2-4 (present in DOM together, hidden until reached)

Step 2 — sign in: `email`, `password`, `login-submit` (same attrs as login page)
Step 3 — address: `street`, `city`, `state`, `country`, `postal_code`, `proceed-3`
Step 4 — payment: `payment-method`, `finish`

## UI Behavior Map

| Element                     | Trigger | Result                                                       |
| --------------------------- | ------- | ------------------------------------------------------------ |
| Add to cart                 | click   | toast appears, `cart-quantity` in header increments          |
| Cart is per-browser-context | —       | fresh context = empty cart; storageState does not carry cart |

## Known Pitfalls

- After `add-to-cart`, the header counter updates asynchronously — assert on `cart-quantity` text, not on the toast
- All checkout steps exist in DOM simultaneously — assert on **visible** state, not on existence
- Out-of-stock products have no quantity controls — always pick in-stock product from snapshot
