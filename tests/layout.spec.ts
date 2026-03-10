import { test, expect } from '@playwright/test'

test.describe('Layout and Panels Visibility', () => {
  test.beforeEach(async ({ page }) => {
    // Start dev server should be running on localhost:3000
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle' })
  })

  test('should display API Configuration panel', async ({ page }) => {
    const apiConfigPanel = page.locator('text=API Configuration').first()
    await expect(apiConfigPanel).toBeVisible()
  })

  test('should display Diagram Editor panel', async ({ page }) => {
    const editorPanel = page.locator('text=✎ Diagram Editor')
    await expect(editorPanel).toBeVisible()
  })

  test('should display Rules panel', async ({ page }) => {
    const rulesPanel = page.locator('text=Rules')
    await expect(rulesPanel).toBeVisible()
  })

  test('should display Diagram Preview panel', async ({ page }) => {
    const previewPanel = page.locator('text=◈ Diagram Preview')
    await expect(previewPanel).toBeVisible()
  })

  test('should display Results panel', async ({ page }) => {
    const resultsPanel = page.locator('text=Results')
    await expect(resultsPanel).toBeVisible()
  })

  test('should have draggable resize handles', async ({ page }) => {
    // Look for PanelResizeHandle elements by their data attributes
    const handles = await page.locator('[data-panel-resize-handle-enabled]').count()
    // Should have at least 3 handles: left↔right, editor↔rules, preview↔results
    expect(handles).toBeGreaterThanOrEqual(3)
  })



  test('should allow Editor to receive input', async ({ page }) => {
    const textarea = page.locator('textarea').first()
    await expect(textarea).toBeVisible()
    
    const sampleCode = 'graph LR\n    A[Test] --> B[Diagram]'
    await textarea.fill(sampleCode)
    
    const value = await textarea.inputValue()
    expect(value).toBe(sampleCode)
  })

  test('should show all panels immediately after hydration (no loading state)', async ({ page }) => {
    // Verify that panels render without delay and no content shift during hydration.
    // This catches issues where panels briefly hide or shift position on mount.
    
    const panels = [
      page.locator('text=Diagram Editor'),
      page.locator('text=Rules'),
      page.locator('text=Diagram Preview'),
      page.locator('text=Results'),
    ]
    
    for (const panel of panels) {
      await expect(panel).toBeVisible({ timeout: 500 })
    }
  })


})
