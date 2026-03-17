import { test, expect, type Page } from '@playwright/test'

async function stubApi(page: Page) {
  // Clear any existing routes first
  await page.unroute('**/*')
  
  await page.route('**/v1/healthz', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ status: 'ok' }),
    })
  })

  await page.route('**/v1/rules', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ rules: [] }),
    })
  })

  await page.route('**/v1/analyze', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ diagram_type: 'flowchart', results: [] }),
    })
  })
}

test('body scroll stays locked until the last open modal closes', async ({ page }) => {
  await stubApi(page)

  await page.goto('http://localhost:3000/?api=https://api.example.test')

  await page.getByRole('button', { name: 'API' }).click()
  await expect(page.getByRole('heading', { name: 'API Configuration' })).toBeVisible()

  await expect.poll(async () => page.evaluate(() => document.body.style.overflow)).toBe('hidden')

  await page.getByRole('button', { name: '⊞ Rules' }).click()
  await expect(page.getByRole('heading', { name: 'Rules Configuration' })).toBeVisible()

  await expect.poll(async () => page.evaluate(() => document.body.style.overflow)).toBe('hidden')

  const rulesHeader = page.getByRole('heading', { name: 'Rules Configuration' })
  await rulesHeader.locator('xpath=..').getByRole('button', { name: 'Close modal' }).click()
  await expect(page.getByRole('heading', { name: 'Rules Configuration' })).toHaveCount(0)

  await expect.poll(async () => page.evaluate(() => document.body.style.overflow)).toBe('hidden')

  const apiHeader = page.getByRole('heading', { name: 'API Configuration' })
  await apiHeader.locator('xpath=..').getByRole('button', { name: 'Close modal' }).click()
  await expect(page.getByRole('heading', { name: 'API Configuration' })).toHaveCount(0)

  await expect.poll(async () => page.evaluate(() => document.body.style.overflow)).toBe('')
})
