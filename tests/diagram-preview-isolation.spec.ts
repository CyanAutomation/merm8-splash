import { test, expect } from '@playwright/test'

test('one diagram preview cleanup does not remove other preview output', async ({ page }) => {
  await page.goto('/diagram-preview-isolation')

  await expect(page.locator('#right-preview svg')).toHaveCount(1)
  await expect(page.locator('#left-preview svg')).toHaveCount(1)

  await page.click('#left-invalid-btn')

  await expect(page.locator('#right-preview svg')).toHaveCount(1)
  await expect(page.locator('#left-preview').getByText('⚠ Syntax Error')).toBeVisible()
})


test('rapid left preview updates keep right preview rendered', async ({ page }) => {
  await page.goto('/diagram-preview-isolation')

  await expect(page.locator('#right-preview svg')).toHaveCount(1)
  await expect(page.locator('#left-preview svg')).toHaveCount(1)

  await page.click('#left-rapid-btn')

  await page.waitForTimeout(50)

  await expect(page.locator('#left-preview').getByText('⚠ Syntax Error')).toBeVisible()
  await expect(page.locator('#right-preview svg')).toHaveCount(1)
})

test('overlapping preview renders keep right preview alive while left errors', async ({ page }) => {
  await page.goto('/diagram-preview-isolation')

  await expect(page.locator('#right-preview svg')).toHaveCount(1)
  await expect(page.locator('#left-preview svg')).toHaveCount(1)

  await page.click('#overlap-renders-btn')

  await page.waitForTimeout(50)

  await expect(page.locator('#left-preview').getByText('⚠ Syntax Error')).toBeVisible()
  await expect(page.locator('#right-preview svg')).toHaveCount(1)
})
