import { test, expect } from '@playwright/test'

test.describe('Diagram Preview Auto-Fit', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:3000')
  })

  test('should auto-fit a simple diagram on load', async ({ page }) => {
    // Enter a simple diagram code
    const editorTextarea = page.locator('textarea').first()
    await editorTextarea.fill('graph TD\n    A[Start] --> B[End]')

    // Wait for the diagram to render
    await page.waitForSelector('svg', { timeout: 5000 })

    // Get the SVG element
    const svg = page.locator('div[style*="overflow: auto"] svg').first()

    // Check that SVG has width and height attributes set
    const width = await svg.getAttribute('width')
    const height = await svg.getAttribute('height')

    console.log(`SVG dimensions: ${width} x ${height}`)

    // Both should be set and numeric
    expect(width).toBeTruthy()
    expect(height).toBeTruthy()
    expect(parseFloat(width!)).toBeGreaterThan(0)
    expect(parseFloat(height!)).toBeGreaterThan(0)
  })

  test('should have a "Fit" button that exists when diagram is valid', async ({ page }) => {
    // Enter diagram code
    const editorTextarea = page.locator('textarea').first()
    await editorTextarea.fill('graph LR\n    A[Input] --> B[Process] --> C[Output]')

    // Wait for the diagram to render
    await page.waitForSelector('svg', { timeout: 5000 })

    // Look for the "Fit" button
    const fitButton = page.locator('button', { hasText: '↔ Fit' })
    await expect(fitButton).toBeVisible()
  })

  test('should recalculate fit when button is clicked', async ({ page }) => {
    // Enter diagram code
    const editorTextarea = page.locator('textarea').first()
    await editorTextarea.fill('graph TD\n    A[Start] --> B[Middle] --> C[End]')

    // Wait for the diagram to render
    await page.waitForSelector('svg', { timeout: 5000 })

    // Get initial SVG dimensions
    const svg = page.locator('div[style*="overflow: auto"] svg').first()
    const initialWidth = await svg.getAttribute('width')

    // Click the Fit button
    const fitButton = page.locator('button', { hasText: '↔ Fit' })
    await fitButton.click()

    // Wait a bit for recalculation
    await page.waitForTimeout(100)

    // Get new dimensions (should be close to the same, but proves it was called)
    const newWidth = await svg.getAttribute('width')

    console.log(`Initial: ${initialWidth}, After click: ${newWidth}`)

    // Should have width set
    expect(newWidth).toBeTruthy()
  })

  test('should NOT show Fit button when diagram has errors', async ({ page }) => {
    // Enter invalid diagram code
    const editorTextarea = page.locator('textarea').first()
    await editorTextarea.fill('invalid diagram syntax ][}{')

    // Wait for error message to appear
    await page.waitForSelector('text=Syntax Error', { timeout: 5000 })

    // Look for the "Fit" button - should not exist
    const fitButton = page.locator('button', { hasText: '↔ Fit' })
    await expect(fitButton).not.toBeVisible()
  })

  test('should fit large diagram to container', async ({ page }) => {
    // Enter a larger diagram
    const largeDiagram = `graph TD
    A[1] --> B[2]
    B --> C[3]
    C --> D[4]
    D --> E[5]
    E --> F[6]
    F --> G[7]
    G --> H[8]
    H --> I[9]`

    const editorTextarea = page.locator('textarea').first()
    await editorTextarea.fill(largeDiagram)

    // Wait for the diagram to render
    await page.waitForSelector('svg', { timeout: 5000 })

    // Get the container and SVG dimensions
    const container = page.locator('div[style*="overflow: auto"]').first()
    const svg = container.locator('svg').first()

    const containerBox = await container.boundingBox()
    const svgWidth = parseFloat(await svg.getAttribute('width') || '0')

    console.log(`Container width: ${containerBox?.width}, SVG width: ${svgWidth}`)

    // SVG should fit within container (accounting for some padding)
    if (containerBox) {
      expect(svgWidth).toBeLessThanOrEqual(containerBox.width)
    }
  })
})
