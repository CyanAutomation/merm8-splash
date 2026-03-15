import { test, expect } from '@playwright/test'

test('Diagram Editor copy button is beside Example and shows success after clipboard write', async ({ page }) => {
  await page.addInitScript(() => {
    const clipboardState = {
      writes: [] as string[],
    }

    Object.defineProperty(window, '__diagramEditorClipboardState', {
      value: clipboardState,
      configurable: true,
      writable: true,
    })

    Object.defineProperty(navigator, 'clipboard', {
      value: {
        writeText: async (text: string) => {
          clipboardState.writes.push(text)
        },
      },
      configurable: true,
    })
  })

  await page.goto('/')

  const exampleButton = page.getByRole('button', { name: 'Example' })
  const actionRow = exampleButton.locator('xpath=..')
  const copyButton = actionRow.getByRole('button', { name: 'Copy diagram code' })

  await expect(copyButton).toBeVisible()

  const editorTextarea = page.locator('textarea').first()
  const diagramText = 'flowchart TD\n  A[Start] --> B{Check}'
  await editorTextarea.fill(diagramText)

  await copyButton.click()

  const copiedWrites = await page.evaluate(() => {
    return (
      window as Window & {
        __diagramEditorClipboardState?: { writes: string[] }
      }
    ).__diagramEditorClipboardState?.writes ?? []
  })

  expect(copiedWrites).toEqual([diagramText])
  await expect(copyButton).toHaveText('✓')
})

test('Diagram Editor copy button shows warning glyph when clipboard and fallback copy fail', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'clipboard', {
      value: {
        writeText: async () => {
          throw new Error('clipboard blocked')
        },
      },
      configurable: true,
    })

    Document.prototype.execCommand = () => false
  })

  await page.goto('/')

  const copyButton = page.getByRole('button', { name: 'Copy diagram code' })
  await copyButton.click()

  await expect(copyButton).toHaveText('⚠')
})
