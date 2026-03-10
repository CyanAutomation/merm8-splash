import { test, expect } from '@playwright/test'

test.describe('Diagram Preview Fit Functionality', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:3000')
  })

  test('should display SVG diagram when valid code is entered', async ({ page }) => {
    // Verify that a valid diagram renders to SVG (basic rendering check)
    const editorTextarea = page.locator('textarea').first()
    await editorTextarea.fill('graph TD\n    A[Start] --> B[End]')

    // Wait for SVG to render
    const svg = page.locator('div[style*="overflow: auto"] svg').first()
    await expect(svg).toBeVisible()

    // SVG should have dimensions set by the rendering engine
    const width = await svg.getAttribute('width')
    const height = await svg.getAttribute('height')
    expect(parseFloat(width || '0')).toBeGreaterThan(0)
    expect(parseFloat(height || '0')).toBeGreaterThan(0)
  })

  test('should NOT show Fit button when diagram has errors', async ({ page }) => {
    // Verify that UI correctly reflects error state
    const editorTextarea = page.locator('textarea').first()
    await editorTextarea.fill('invalid diagram syntax ][}{')

    // Wait for error message to appear
    await page.waitForSelector('text=Syntax Error', { timeout: 5000 })

    // Fit button should not be visible during error state
    const fitButton = page.locator('button', { hasText: '↔ Fit' })
    await expect(fitButton).not.toBeVisible()
  })
})
