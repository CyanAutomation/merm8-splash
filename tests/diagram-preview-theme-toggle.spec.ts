import { test, expect, type Locator, type Page } from '@playwright/test'

const DARK_THEME_TOKENS = ['#1c1c1e', '#2c2c2e', '#e1e1e1', '#444444']
const LIGHT_THEME_TOKENS = ['#ffffff', '#f9fafb', '#1f2937', '#9ca3af']

function getPreviewPanel(page: Page): Locator {
  return page.locator('.panel').filter({ has: page.getByText('◈ Diagram Preview') }).first()
}

function getModeToggle(previewPanel: Locator): Locator {
  return previewPanel.getByRole('button', { name: /Toggle diagram mode\. Current mode:/i })
}

async function getRenderedSvg(previewPanel: Locator): Promise<Locator> {
  const svg = previewPanel.locator('svg').first()
  await expect(svg).toBeVisible()
  return svg
}

async function getSvgMarkup(svg: Locator): Promise<string> {
  return svg.evaluate((node) => node.outerHTML)
}

function detectThemeFromSvg(svgMarkup: string): 'dark' | 'light' | 'unknown' {
  const normalized = svgMarkup.toLowerCase()
  const darkScore = DARK_THEME_TOKENS.filter((token) => normalized.includes(token)).length
  const lightScore = LIGHT_THEME_TOKENS.filter((token) => normalized.includes(token)).length

  if (darkScore > lightScore) return 'dark'
  if (lightScore > darkScore) return 'light'
  return 'unknown'
}

test('diagram mode toggle updates state and preview SVG theme output', async ({ page }) => {
  await page.goto('/')

  const previewPanel = getPreviewPanel(page)
  const toggle = getModeToggle(previewPanel)
  const svg = await getRenderedSvg(previewPanel)

  const initialAriaLabel = await toggle.getAttribute('aria-label')
  expect(initialAriaLabel).not.toBeNull()

  const initialMarkup = await getSvgMarkup(svg)
  const initialTheme = detectThemeFromSvg(initialMarkup)
  expect(initialTheme).not.toBe('unknown')

  await toggle.click()

  await expect(toggle).not.toHaveAttribute('aria-label', initialAriaLabel ?? '')

  const updatedMarkup = await expect
    .poll(async () => {
      const nextSvg = await getRenderedSvg(previewPanel)
      return getSvgMarkup(nextSvg)
    })
    .not.toBe(initialMarkup)

  const updatedTheme = detectThemeFromSvg(updatedMarkup)

  expect(updatedTheme).not.toBe(initialTheme)
  expect(updatedTheme).not.toBe('unknown')
})

test('diagram mode toggle only updates preview SVG and does not mutate global page theme vars', async ({ page }) => {
  await page.goto('/')

  const previewPanel = getPreviewPanel(page)
  const toggle = getModeToggle(previewPanel)
  const svg = await getRenderedSvg(previewPanel)

  const rootBgBefore = await page.evaluate(() =>
    getComputedStyle(document.documentElement).getPropertyValue('--color-bg-primary').trim()
  )
  const bodyBgBefore = await page.evaluate(() => getComputedStyle(document.body).backgroundColor)
  const svgBefore = await getSvgMarkup(svg)

  await toggle.click()

  await expect
    .poll(async () => {
      const nextSvg = await getRenderedSvg(previewPanel)
      return getSvgMarkup(nextSvg)
    })
    .not.toBe(svgBefore)

  const rootBgAfter = await page.evaluate(() =>
    getComputedStyle(document.documentElement).getPropertyValue('--color-bg-primary').trim()
  )
  const bodyBgAfter = await page.evaluate(() => getComputedStyle(document.body).backgroundColor)

  expect(rootBgAfter).toBe(rootBgBefore)
  expect(bodyBgAfter).toBe(bodyBgBefore)
})

test('fit control remains functional after switching diagram mode', async ({ page }) => {
  await page.goto('/')

  const previewPanel = getPreviewPanel(page)
  const toggle = getModeToggle(previewPanel)
  const fitButton = previewPanel.getByRole('button', { name: '↔ Fit' })

  const applyArtificialSmallSize = async () => {
    const currentSvg = await getRenderedSvg(previewPanel)
    await currentSvg.evaluate((node) => {
      const svgNode = node as SVGSVGElement
      svgNode.style.setProperty('width', '40px', 'important')
      svgNode.style.setProperty('height', '40px', 'important')
    })
  }

  const getSvgRenderedWidth = async () => {
    const currentSvg = await getRenderedSvg(previewPanel)
    return currentSvg.evaluate((node) => {
      return Math.round((node as SVGSVGElement).getBoundingClientRect().width)
    })
  }

  await applyArtificialSmallSize()
  await fitButton.click()

  await expect.poll(getSvgRenderedWidth).toBeGreaterThan(40)

  await toggle.click()
  await getRenderedSvg(previewPanel)

  await applyArtificialSmallSize()
  await fitButton.click()

  await expect.poll(getSvgRenderedWidth).toBeGreaterThan(40)
})
