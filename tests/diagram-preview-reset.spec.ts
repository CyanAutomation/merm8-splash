import { test, expect } from '@playwright/test'

test.describe('Diagram preview recovery after transient invalid input', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
  })

  test('recovers to SVG preview after invalid text then valid mermaid', async ({ page }) => {
    const editorTextarea = page.locator('textarea').first()

    await editorTextarea.fill('')
    await expect(page.getByText('No diagram code yet')).toBeVisible()

    await editorTextarea.fill('invalid diagram syntax ][}{')
    await expect(page.getByText('⚠ Syntax Error')).toBeVisible()

    await editorTextarea.fill('graph TD\n  A[Start] --> B[End]')

    await page.waitForTimeout(100)
    await expect(page.getByText('⚠ Component Error')).not.toBeVisible()
    await expect(page.locator('svg').first()).toBeVisible()
  })
})
