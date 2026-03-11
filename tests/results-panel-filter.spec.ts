import { test, expect, type Page } from '@playwright/test'

const mockResults = [
  { rule_id: 'E_30', severity: 'error', message: 'error high line', line: 30 },
  { rule_id: 'W_12', severity: 'warning', message: 'warning line', line: 12 },
  { rule_id: 'I_2', severity: 'info', message: 'info line', line: 2 },
  { rule_id: 'E_5', severity: 'error', message: 'error low line', line: 5 },
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

async function openAppAndRunAnalysis(page: Page) {
  await stubApi(page)

  await page.goto('http://localhost:3000/?api=https://api.example.test')
  await page.getByRole('button', { name: 'Test' }).click()

  await expect(page.getByText('Connection successful.')).toBeVisible()
  await expect(page.getByRole('row', { name: /E_30/ })).toBeVisible()
  await expect(page.getByRole('row', { name: /W_12/ })).toBeVisible()
  await expect(page.getByRole('row', { name: /I_2/ })).toBeVisible()
}

async function applyErrorFilterAndLineSort(page: Page) {
  await page.getByRole('button', { name: '⚲ Filter' }).click()

  await page.getByLabel('Severity').selectOption('error')
  await expect(page.getByRole('row', { name: /E_30/ })).toBeVisible()
  await expect(page.getByRole('row', { name: /E_5/ })).toBeVisible()
  await expect(page.getByRole('row', { name: /W_12/ })).toHaveCount(0)
  await expect(page.getByRole('row', { name: /I_2/ })).toHaveCount(0)

  await page.getByLabel('Sort').selectOption('line')
  await expect(page.getByText('Filter: Error • Sort: Line')).toBeVisible()

  const lineCells = page.locator('tbody tr td:nth-child(4)')
  await expect(lineCells).toHaveCount(2)

  const lines = (await lineCells.allTextContents()).map((value) => Number(value.trim()))
  expect(lines).toEqual([5, 30])
}

test('results filter keeps only errors and line sort orders ascending', async ({ page }) => {
  await openAppAndRunAnalysis(page)
  await applyErrorFilterAndLineSort(page)
})

test('filtered results remain visible when parse error text is present', async ({ page }) => {
  await openAppAndRunAnalysis(page)
  await applyErrorFilterAndLineSort(page)

  await page.getByRole('textbox').first().fill('flowchart TD\nA-->')

  await expect(page.getByText('⚠ Syntax Error')).toBeVisible()
  await expect(page.getByRole('row', { name: /E_5/ })).toBeVisible()
  await expect(page.getByRole('row', { name: /E_30/ })).toBeVisible()
  await expect(page.getByRole('row', { name: /W_12/ })).toHaveCount(0)
})
