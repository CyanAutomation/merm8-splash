import { test, expect } from '@playwright/test'

test('Rules panel shows server-defaults badge when rules metadata is unavailable', async ({ page }) => {
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
      body: JSON.stringify({}),
    })
  })

  await page.goto('http://localhost:3000/?api=https://api.example.test')
  await page.getByRole('button', { name: 'Test' }).click()

  await expect(page.getByText('Connection successful.')).toBeVisible()

  await page.getByRole('button', { name: '⊞ Rules' }).click()

  await expect(page.getByText('Server defaults')).toBeVisible()
  await expect(page.getByText('Analysis uses server defaults for linting.')).toBeVisible()
  await expect(page.getByText('Rules metadata unavailable for this API endpoint.')).toBeVisible()
  await expect(page.getByText(/\d+\/\d+/)).toHaveCount(0)
})
