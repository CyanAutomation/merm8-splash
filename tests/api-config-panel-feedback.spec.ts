import { test, expect } from '@playwright/test'

test('shows success feedback for a valid endpoint after connection test', async ({ page }) => {
  // Clear any existing routes
  await page.unroute('**/*')
  
  await page.route('**/v1/healthz', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ status: 'ok' }),
    })
  })

  await page.goto('/?api=https://api.example.test')
  const testButton = page.getByRole('button', { name: 'Test' })
  await expect(testButton).toBeEnabled({ timeout: 10000 })
  await testButton.click()

  const successMessage = page.getByText('Connection successful.')
  await expect(successMessage).toBeVisible()
  await expect(successMessage).toHaveCount(1)
})

test('shows unreachable feedback for a valid endpoint when health check fails', async ({ page }) => {
  // Clear any existing routes
  await page.unroute('**/*')
  
  await page.route('**/v1/healthz', async (route) => {
    await route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: JSON.stringify({ status: 'down' }),
    })
  })

  await page.goto('/?api=https://api.example.test')
  const testButton = page.getByRole('button', { name: 'Test' })
  await expect(testButton).toBeEnabled({ timeout: 10000 })
  await testButton.click()

  const unreachableMessage = page.getByText('Could not reach endpoint. Check URL and server status.')
  await expect(unreachableMessage).toBeVisible()
  await expect(unreachableMessage).toHaveCount(1)
})

test('endpoint changes during checking reset status and allow a fresh successful test', async ({ page }) => {
  // Clear any existing routes
  await page.unroute('**/*')

  await page.route('**/v1/healthz', async (route) => {
    const requestUrl = route.request().url()

    if (requestUrl.includes('api.example.test')) {
      await new Promise((resolve) => setTimeout(resolve, 1200))
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ status: 'ok' }),
      })
      return
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ status: 'ok' }),
    })
  })

  await page.goto('/?api=https://api.example.test')

  const testButton = page.getByRole('button', { name: 'Test' })
  const endpointInput = page.getByPlaceholder('https://api.merm8.app')

  await expect(testButton).toBeEnabled({ timeout: 10000 })
  await testButton.click()
  await expect(page.getByText('Checking...')).toBeVisible()

  await endpointInput.fill('https://api.changed.test')
  await expect(page.getByText('Not tested')).toBeVisible()

  await page.waitForTimeout(1400)
  await expect(page.getByText('Connection successful.')).toHaveCount(0)

  await testButton.click()
  await expect(page.getByText('Connection successful.')).toBeVisible()
})

test('shows validation error for invalid endpoint format', async ({ page }) => {
  // Clear any existing routes
  await page.unroute('**/*')
  
  await page.goto('/')

  const endpointInput = page.getByPlaceholder('https://api.merm8.app')
  await endpointInput.focus()
  await endpointInput.fill('not-a-valid-url')
  await endpointInput.blur()

  await expect(
    page.getByText('Enter a valid URL (example: https://api.merm8.app).')
  ).toBeVisible({ timeout: 5000 })
})
