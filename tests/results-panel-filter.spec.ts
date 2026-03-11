import { test, expect, type Page } from '@playwright/test'

const mockResults = [
  { rule_id: 'ERR_12', severity: 'error', message: 'error with line 12', line: 12 },
  { rule_id: 'WARN_NL', severity: 'warning', message: 'warning with no line', line: null },
  { rule_id: 'ERR_4', severity: 'error', message: 'error with line 4', line: 4 },
  { rule_id: 'ERR_NL', severity: 'error', message: 'error with no line', line: null },
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

test('results panel filter and line sort keep expected rows and empty-state copy', async ({ page }) => {
  await stubApi(page)

  await page.goto('http://localhost:3000/?api=https://api.example.test')
  await page.getByRole('button', { name: 'Test' }).click()

  await expect(page.getByText('Connection successful.')).toBeVisible()

  // Initial mixed severities and mixed line/null-line rows.
  await expect(page.getByRole('row', { name: /ERR_12/ })).toBeVisible()
  await expect(page.getByRole('row', { name: /WARN_NL/ })).toBeVisible()
  await expect(page.getByRole('row', { name: /ERR_4/ })).toBeVisible()
  await expect(page.getByRole('row', { name: /ERR_NL/ })).toBeVisible()

  // Open filter modal and keep only errors.
  await page.getByRole('button', { name: '⚲ Filter' }).click()
  await page.getByLabel('Severity').selectOption('error')

  await expect(page.getByRole('row', { name: /ERR_12/ })).toBeVisible()
  await expect(page.getByRole('row', { name: /ERR_4/ })).toBeVisible()
  await expect(page.getByRole('row', { name: /ERR_NL/ })).toBeVisible()
  await expect(page.getByRole('row', { name: /WARN_NL/ })).toHaveCount(0)

  // Sort by line and assert numeric lines ascend, with missing line values at the end.
  await page.getByLabel('Sort').selectOption('line')
  await expect(page.getByText('Filter: Error • Sort: Line')).toBeVisible()

  const rows = page.locator('tbody tr')
  await expect(rows).toHaveCount(3)
  await expect(rows.nth(0)).toContainText('ERR_4')
  await expect(rows.nth(1)).toContainText('ERR_12')
  await expect(rows.nth(2)).toContainText('ERR_NL')

  const lineCells = page.locator('tbody tr td:nth-child(4)')
  await expect(lineCells).toHaveText(['4', '12', '—'])

  // Empty-state copy for a severity absent from current results.
  await page.getByLabel('Severity').selectOption('info')
  await expect(page.getByText('No results match current filter (Filter: Info)')).toBeVisible()
})
