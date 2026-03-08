import { test, expect } from '@playwright/test'

test.describe('Main Page Panel Visibility Diagnostic', () => {
  test('check main page DOM structure', async ({ page }) => {
    await page.goto('http://localhost:3000')
    
    // Wait a bit for hydration
    await page.waitForTimeout(1000)
    
    // Take screenshot
    await page.screenshot({ path: '/tmp/main-page.png' })
    
    // Check if main content container exists
    const mainContent = await page.locator('div[style*="flex: 1"]').first()
    const mainContentVisible = await mainContent.isVisible()
    console.log('Main content div visible:', mainContentVisible)
    
    // Check for PanelGroup
    const panelGroup = await page.locator('[data-panel-group-direction]').first()
    const panelGroupVisible = await panelGroup.isVisible().catch(() => false)
    console.log('PanelGroup exists:', await panelGroup.count() > 0)
    console.log('PanelGroup visible:', panelGroupVisible)
    
    if (await panelGroup.count() > 0) {
      const pgBox = await panelGroup.boundingBox()
      console.log('PanelGroup bounding box:', pgBox)
      
      // Get computed styles
      const pgComputedStyle = await panelGroup.evaluate((el) => {
        const style = window.getComputedStyle(el)
        return {
          display: style.display,
          width: style.width,
          height: style.height,
          overflow: style.overflow,
          visibility: style.visibility,
          opacity: style.opacity,
        }
      })
      console.log('PanelGroup computed styles:', pgComputedStyle)
    }
    
    // Check for all panels
    const panels = await page.locator('[data-panel]').all()
    console.log('Total panels found:', panels.length)
    
    for (let i = 0; i < panels.length; i++) {
      const panel = panels[i]
      const panelId = await panel.getAttribute('data-panel-id')
      const visible = await panel.isVisible().catch(() => false)
      const box = await panel.boundingBox()
      
      const computedStyle = await panel.evaluate((el) => {
        const style = window.getComputedStyle(el)
        return {
          display: style.display,
          width: style.width,
          height: style.height,
          overflow: style.overflow,
          visibility: style.visibility,
        }
      })
      
      console.log(`Panel ${i} (id: ${panelId}):`, {
        visible,
        box,
        computedStyle,
      })
    }
    
    // Check for editor component
    const editor = await page.locator('textarea').first()
    const editorExists = await editor.count() > 0
    const editorVisible = await editor.isVisible().catch(() => false)
    console.log('Editor textarea exists:', editorExists)
    console.log('Editor textarea visible:', editorVisible)
    if (editorExists) {
      const editorBox = await editor.boundingBox()
      console.log('Editor bounding box:', editorBox)
    }
    
    // Check for API config panel
    const apiConfig = await page.locator('text=/API Configuration/i').first()
    const apiConfigExists = await apiConfig.count() > 0
    const apiConfigVisible = await apiConfig.isVisible().catch(() => false)
    console.log('API Config text exists:', apiConfigExists)
    console.log('API Config text visible:', apiConfigVisible)
    
    // Check CSS applied to resizable panels
    const allElements = await page.locator('*[data-panel-group-direction], *[data-panel], *[data-panel-resize-handle-enabled]').all()
    console.log('Resizable panel elements found:', allElements.length)
  })
  
  test('compare container hierarchy structure', async ({ page }) => {
    await page.goto('http://localhost:3000')
    await page.waitForTimeout(1000)
    
    // Get the main content container structure
    const structure = await page.evaluate(() => {
      const root = document.body
      
      const walkDOM = (el: Element, depth: number = 0): any => {
        if (depth > 5) return null // Limit depth
        
        const info = {
          tag: el.tagName?.toLowerCase() || 'unknown',
          class: el.className || 'no-class',
          id: el.id || 'no-id',
          dataAttrs: {} as Record<string, string>,
          style: {
            display: (el as HTMLElement).style?.display || '',
            height: (el as HTMLElement).style?.height || '',
            width: (el as HTMLElement).style?.width || '',
            flex: (el as HTMLElement).style?.flex || '',
            overflow: (el as HTMLElement).style?.overflow || '',
          },
          children: [] as any[],
        }
        
        // Get data attributes
        if (el.attributes) {
          for (let i = 0; i < el.attributes.length; i++) {
            const attr = el.attributes[i]
            if (attr.name.startsWith('data-')) {
              info.dataAttrs[attr.name] = attr.value
            }
          }
        }
        
        // Walk children
        for (let child of Array.from(el.children).slice(0, 3)) {
          const childInfo = walkDOM(child as HTMLElement, depth + 1)
          if (childInfo) {
            info.children.push(childInfo)
          }
        }
        
        return info
      }
      
      return walkDOM(root)
    })
    
    console.log('DOM Structure:', JSON.stringify(structure, null, 2))
  })
  
  test('compare test-layout page structure', async ({ page }) => {
    await page.goto('http://localhost:3000/test-layout')
    await page.waitForTimeout(500)
    
    const panels = await page.locator('[data-panel]').all()
    console.log('Test-layout panels found:', panels.length)
    
    const panelGroup = await page.locator('[data-panel-group-direction]').first()
    if (await panelGroup.count() > 0) {
      const box = await panelGroup.boundingBox()
      const style = await panelGroup.evaluate((el) => {
        const s = window.getComputedStyle(el)
        return {
          display: s.display,
          width: s.width,
          height: s.height,
          visibility: s.visibility,
          opacity: s.opacity,
        }
      })
      console.log('Test-layout PanelGroup:', { box, style })
    }
  })
})
