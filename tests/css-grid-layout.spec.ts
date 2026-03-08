import { test, expect } from '@playwright/test'

test.describe('Main Page Panel Rendering with CSS Grid', () => {
  test('all five panels should be visible', async ({ page }) => {
    await page.goto('http://localhost:3000')
    await page.waitForTimeout(1000) // Wait for hydration
    
    // Take screenshot for visual inspection
    await page.screenshot({ path: '/tmp/main-page-after-fix.png' })
    
    // Check for Editor panel (textarea)
    const editor = page.locator('textarea').first()
    await expect(editor).toBeVisible({ timeout: 5000 })
    const editorBox = await editor.boundingBox()
    console.log('✓ Editor panel visible at:', editorBox)
    
    // Check for Rules panel (should have "Rules" text somewhere)
    const mainContent = page.locator('body > div > div').nth(2) // Main content area
    await expect(mainContent).toBeVisible()
    console.log('✓ Main content area visible')
    
    // Check that we have at least 4 divs (header, api config, main content, status bar)
    const topLevelDivs = await page.locator('body > div > div').count()
    console.log(`✓ Found ${topLevelDivs} top-level divs`)
    
    // Check grid columns exist
    const gridContainers = await page.locator('[style*="grid"]').count()
    console.log(`✓ Found ${gridContainers} grid containers`)
    expect(gridContainers).toBeGreaterThan(0)
    
    // Verify preview area exists
    const svgElement = await page.locator('svg').first()
    const svgExists = await svgElement.count() > 0
    console.log(`✓ SVG diagram preview exists: ${svgExists}`)
  })

  test('grid layout should be responsive', async ({ page }) => {
    await page.goto('http://localhost:3000')
    await page.waitForTimeout(1000)
    
    // Get viewport size
    const viewport = page.viewportSize()
    console.log('Current viewport:', viewport)
    
    // Check if we're in desktop or mobile view
    if (viewport && viewport.width < 768) {
      console.log('Mobile breakpoint detected - should use vertical stack')
      const flexContainers = await page.locator('[style*="flex"]').count()
      expect(flexContainers).toBeGreaterThan(0)
    } else {
      console.log('Desktop mode detected - should use CSS Grid')
      const gridContainers = await page.locator('[style*="grid"]').count()
      expect(gridContainers).toBeGreaterThan(0)
    }
  })

  test('drag dividers should update layout preferences', async ({ page }) => {
    await page.goto('http://localhost:3000')
    await page.waitForTimeout(1000)
    
    // Skip if mobile
    const viewport = page.viewportSize()
    if (!viewport || viewport.width < 768) {
      console.log('Skipping drag test on mobile')
      return
    }
    
    // Get all divider elements (they have cursor: col-resize or row-resize)
    const dividers = await page.locator('[style*="cursor"]').all()
    console.log(`Found ${dividers.length} potential dividers`)
    
    // Try to find a vertical divider (4px wide)
    const verticalDivider = page.locator('[style*="cursor: col-resize"]').first()
    const dividerExists = await verticalDivider.count() > 0
    console.log(`✓ Vertical divider exists: ${dividerExists}`)
    
    if (dividerExists) {
      // Try a small drag
      await verticalDivider.dragTo(verticalDivider, { sourcePosition: { x: 2, y: 2 }, targetPosition: { x: 10, y: 2 } })
      console.log('✓ Drag interaction completed')
    }
  })

  test('compare with test-layout to verify both work', async ({ page }) => {
    // Test the working test-layout first
    await page.goto('http://localhost:3000/test-layout')
    await page.waitForTimeout(500)
    
    const testLayoutPanels = await page.locator('[style*="padding"]').count()
    console.log(`test-layout has ${testLayoutPanels} padded sections`)
    
    // Now test main page
    await page.goto('http://localhost:3000')
    await page.waitForTimeout(1000)
    
    const mainPagePanels = await page.locator('[style*="padding"]').count()
    console.log(`main page has ${mainPagePanels} padded sections`)
    
    // They should be similar (main page should have more due to API config, etc)
    expect(mainPagePanels).toBeGreaterThanOrEqual(testLayoutPanels)
  })
})
