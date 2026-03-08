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

  test('should render PanelGroup structure', async ({ page }) => {
    // Check that PanelGroup exists in DOM
    const panelGroups = await page.locator('[data-panel-group-direction]').count()
    // Should have multiple PanelGroups (nested)
    expect(panelGroups).toBeGreaterThanOrEqual(1)
    console.log(`Found ${panelGroups} PanelGroups`)
  })

  test('should allow Editor to receive input', async ({ page }) => {
    const textarea = page.locator('textarea').first()
    await expect(textarea).toBeVisible()
    
    const sampleCode = 'graph LR\n    A[Test] --> B[Diagram]'
    await textarea.fill(sampleCode)
    
    const value = await textarea.inputValue()
    expect(value).toBe(sampleCode)
  })

  test('should show panel layout without isMounted delay', async ({ page }) => {
    // The page should render all panels immediately without hydration mismatch
    // This is a quick test to ensure panels are not hidden behind a loading state
    
    const mainContent = page.locator('div[style*="flex: 1"]').first()
    await expect(mainContent).toBeVisible()
    
    // Try to find all major panels
    const editor = page.locator('text=Diagram Editor')
    const rules = page.locator('text=Rules')
    const preview = page.locator('text=Diagram Preview')
    const results = page.locator('text=Results')
    
    await expect(editor).toBeVisible()
    await expect(rules).toBeVisible()
    await expect(preview).toBeVisible()
    await expect(results).toBeVisible()
  })

  test('should take screenshot of full layout', async ({ page }) => {
    // Take a screenshot for visual verification
    const screenshot = await page.screenshot({ fullPage: true })
    console.log('Full page screenshot captured')
    expect(screenshot).toBeTruthy()
  })
})
