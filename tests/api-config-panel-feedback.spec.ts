import { test, expect } from '@playwright/test'

test('shows success feedback for a valid endpoint after connection test', async ({ page }) => {
  await page.route('**/v1/healthz', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ status: 'ok' }),
    })
  })

  await page.goto('http://localhost:3000/?api=https://api.example.test')
  await page.getByRole('button', { name: 'Test' }).click()

  const successMessage = page.getByText('Connection successful.')
  await expect(successMessage).toBeVisible()
  await expect(successMessage).toHaveCount(1)
})

test('shows unreachable feedback for a valid endpoint when health check fails', async ({ page }) => {
  await page.route('**/v1/healthz', async (route) => {
    await route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: JSON.stringify({ status: 'down' }),
    })
  })

  await page.goto('/?api=')
  await page.getByRole('button', { name: 'Test' }).click()

  const unreachableMessage = page.getByText('Could not reach endpoint. Check URL and server status.')
  await expect(unreachableMessage).toBeVisible()
  await expect(unreachableMessage).toHaveCount(1)
})

test('shows validation error for invalid endpoint format', async ({ page }) => {
  await page.goto('/')

  const endpointInput = page.getByPlaceholder('https://api.merm8.app')
  await endpointInput.fill('not-a-valid-url')

  await expect(
    page.getByText('Enter a valid URL (example: https://api.merm8.app).')
  ).toBeVisible()
})
