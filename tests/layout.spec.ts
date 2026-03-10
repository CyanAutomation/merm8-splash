import { test, expect } from '@playwright/test'

test.describe('Layout and Panels Visibility', () => {
  test.beforeEach(async ({ page }) => {
    // Start dev server should be running on localhost:3000
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle' })
  })

  test.describe('Core UI panels', () => {
    const panels = [
      { name: 'API Configuration', textLocator: 'text=API Configuration' },
      { name: 'Diagram Editor', textLocator: 'text=✎ Diagram Editor' },
      { name: 'Rules', textLocator: 'text=Rules' },
      { name: 'Diagram Preview', textLocator: 'text=◈ Diagram Preview' },
      { name: 'Results', textLocator: 'text=Results' },
    ]

    for (const panel of panels) {
      test(`should display ${panel.name} panel`, async ({ page }) => {
        const element = page.locator(panel.textLocator).first()
        await expect(element).toBeVisible()
      })
    }
  })


  test('should allow Editor to receive input', async ({ page }) => {
    const textarea = page.locator('textarea').first()
    await expect(textarea).toBeVisible()
    
    const sampleCode = 'graph LR\n    A[Test] --> B[Diagram]'
    await textarea.fill(sampleCode)
    
    const value = await textarea.inputValue()
    expect(value).toBe(sampleCode)
  })
})
