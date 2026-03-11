import { test, expect, type Page } from '@playwright/test'

const mockResults = [
  { rule_id: 'ERR_12', severity: 'error', message: 'error with line 12', line: 12 },
] as const

async function stubApi(page: Page) {
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
      body: JSON.stringify({
        diagram_type: 'flowchart',
        results: mockResults,
      }),
    })
  })
}

test('copying then immediate unmount does not trigger unmounted state warnings', async ({ page }) => {
  await stubApi(page)

  const consoleErrors: string[] = []
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text())
    }
  })

  await page.addInitScript(() => {
    const pending = {
      resolve: null as null | (() => void),
    }

    Object.defineProperty(window, '__copyPending', {
      value: pending,
      configurable: true,
      writable: true,
    })

    Object.defineProperty(navigator, 'clipboard', {
      value: {
        writeText: () =>
          new Promise<void>((resolve) => {
            pending.resolve = resolve
          }),
      },
      configurable: true,
    })
  })

  await page.goto('http://localhost:3000/?api=https://api.example.test')
  await page.getByRole('button', { name: 'Test' }).click()
  await expect(page.getByRole('row', { name: /ERR_12/ })).toBeVisible()

  await page.getByTitle('Copy').click()

  await page.evaluate(() => {
    document.getElementById('__next')?.remove()
    ;(window as Window & { __copyPending?: { resolve: null | (() => void) } }).__copyPending?.resolve?.()
  })

  await page.waitForTimeout(50)

  expect(consoleErrors).not.toContainEqual(expect.stringContaining("Can't perform a React state update on an unmounted component"))
})
