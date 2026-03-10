import { test, expect } from '@playwright/test'

test('ResultsPanel renders analysis hints from analyze error payload', async ({ page }) => {
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
      status: 400,
      contentType: 'application/json',
      body: JSON.stringify({
        message: 'Unable to analyze diagram',
        hints: ['Ensure the first line declares a diagram type', 'line 2 contains invalid syntax'],
      }),
    })
  })

  await page.goto('http://localhost:3000/?api=https://api.example.test')
  await page.getByRole('button', { name: 'Test' }).click()

  await expect(page.getByText('Connection successful.')).toBeVisible()
  await expect(page.getByText('⚠ Unable to analyze diagram')).toBeVisible()
  await expect(page.getByText('Hints')).toBeVisible()
  await expect(page.getByText('Ensure the first line declares a diagram type')).toBeVisible()
  await expect(page.getByText('line 2 contains invalid syntax')).toBeVisible()
})
