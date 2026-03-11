import { test, expect, type Page } from '@playwright/test'

async function assertRapidToggleEndsOnLastEvent(page: Page) {
  const toggle = page.getByRole('switch', { name: '✨ Beautiful' })
  await expect(toggle).toBeVisible()

  // Ensure toggle starts in a known state (unchecked)
  const initialState = await toggle.getAttribute('aria-checked')
  if (initialState === 'true') {
    await toggle.click()
    await expect(toggle).toHaveAttribute('aria-checked', 'false')
  }
  
  const sequence = [true, false, true, false, true, false]
  for (const expected of sequence) {
    await toggle.click()
    await expect(toggle).toHaveAttribute('aria-checked', String(expected))
  }

  await expect(toggle).toHaveAttribute('aria-checked', String(sequence.at(-1)))
}

test('desktop preview beautiful toggle keeps final state aligned with last rapid toggle', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.goto('/')

  await assertRapidToggleEndsOnLastEvent(page)
})
