/**
 * tests/ui/cart.spec.ts — add to cart and checkout step 1.
 *
 * Data strategy: the product is picked from the API snapshot (in-stock only) and
 * opened directly at /product/{id}. No clicking through the grid to find it —
 * that would make a cart test fail whenever the catalog layout changes, which is
 * the wrong test failing for the wrong reason.
 *
 * The total is asserted against the API price, not a hardcoded string, so the test
 * survives a price change and still catches a currency-formatting bug.
 *
 * ISOLATION: the cart lives in the browser context, and every test gets a fresh
 * one — so these tests are naturally parallel-safe even though they share a user.
 */
import { test } from '../../fixtures/base.fixture'
import { readDataSnapshot, productsFor, DataSnapshot } from '../../utils/data-snapshot'

import type { Product } from '../../api/types'

let snapshot: DataSnapshot
let products: Product[]

test.beforeAll(() => {
	snapshot = readDataSnapshot()
	products = productsFor(snapshot, 'ui/cart')
})

test.describe('[UI / Cart]', () => {
	test(
		'an added product appears in checkout with the API price',
		{ tag: ['@ui', '@smoke'] },
		async ({ productPage, checkoutPage }) => {
			const product = products[0]!

			await test.step(`Prepare: open product "${product.name}" directly`, async () => {
				await productPage.goto(product.id)
				await productPage.assertPageLoaded()
				await productPage.assertProductName(product.name)
			})

			await test.step('Action: add the product to the cart', async () => {
				await productPage.addToCart()
			})

			await test.step('Verify: the header counter shows 1', async () => {
				await productPage.assertCartQuantity(1)
			})

			await test.step('Action: open checkout', async () => {
				await checkoutPage.goto()
				await checkoutPage.assertPageLoaded()
			})

			await test.step('Verify: the line matches the product and the API price', async () => {
				await checkoutPage.assertCartContains(product.name)
				await checkoutPage.assertLineQuantity(1)
				await checkoutPage.assertCartTotal(`$${product.price.toFixed(2)}`)
			})
		}
	)

	test(
		'adding the same product twice increases the quantity, not the line count',
		{ tag: ['@ui', '@regression'] },
		async ({ productPage, checkoutPage }) => {
			const product = products[1]!

			await test.step(`Prepare: open product "${product.name}"`, async () => {
				await productPage.goto(product.id)
				await productPage.assertPageLoaded()
			})

			await test.step('Action: add it to the cart twice', async () => {
				await productPage.addToCart()
				await productPage.assertCartQuantity(1)
				await productPage.addToCart()
			})

			await test.step('Verify: the header counter shows 2', async () => {
				await productPage.assertCartQuantity(2)
			})

			await test.step('Verify: checkout has one line of quantity 2, total doubled', async () => {
				await checkoutPage.goto()
				await checkoutPage.assertPageLoaded()
				await checkoutPage.assertLineCount(1)
				await checkoutPage.assertLineQuantity(2)
				await checkoutPage.assertCartTotal(`$${(product.price * 2).toFixed(2)}`)
			})
		}
	)
})
