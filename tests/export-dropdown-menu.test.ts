// @vitest-environment jsdom
import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, expect, it, vi } from 'vitest'
import ExportDropdownMenu from '../app/components/ExportDropdownMenu'

type Props = Parameters<typeof ExportDropdownMenu>[0]

let root: Root | null = null
let host: HTMLDivElement | null = null
let props: Props

function createProps(): Props {
  return {
    open: true,
    copying: null,
    isExporting: false,
    hoveredItem: null,
    onToggleOpen: vi.fn(),
    onHover: vi.fn(),
    onExportSarif: vi.fn(),
    onExportJson: vi.fn(),
    onExportMarkdown: vi.fn(),
    onExportText: vi.fn(),
  }
}

function renderMenu(overrides: Partial<Props> = {}) {
  props = { ...props, ...overrides }
  if (!root) {
    host = document.createElement('div')
    document.body.appendChild(host)
    root = createRoot(host)
  }

  act(() => root?.render(createElement(ExportDropdownMenu, props)))
}

afterEach(() => {
  if (root) act(() => root?.unmount())
  root = null
  host?.remove()
  host = null
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

it('renders actions, forwards hover and click events, and disables actions during export', () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  props = createProps()
  renderMenu()

  const buttons = Array.from(host!.querySelectorAll('button'))
  expect(buttons).toHaveLength(5)
  const jsonButton = buttons.find((button) => button.textContent === '↓ JSON')!

  act(() => jsonButton.dispatchEvent(new MouseEvent('mouseover', { bubbles: true })))
  expect(props.onHover).toHaveBeenCalledWith('↓ JSON')
  act(() => jsonButton.dispatchEvent(new MouseEvent('mouseout', { bubbles: true })))
  expect(props.onHover).toHaveBeenLastCalledWith(null)

  renderMenu({ hoveredItem: '↓ JSON' })
  const hoveredJsonButton = Array.from(host!.querySelectorAll('button'))
    .find((button) => button.textContent === '↓ JSON')!
  expect(hoveredJsonButton.style.background).toBe('var(--color-bg-primary)')
  act(() => hoveredJsonButton.click())
  expect(props.onExportJson).toHaveBeenCalledOnce()

  const toggleButton = Array.from(host!.querySelectorAll('button'))
    .find((button) => button.textContent?.includes('Export'))!
  act(() => toggleButton.click())
  expect(props.onToggleOpen).toHaveBeenCalledOnce()

  renderMenu({ isExporting: true, copying: 'JSON', hoveredItem: null })
  const exportingButtons = Array.from(host!.querySelectorAll('button'))
  expect(exportingButtons[0]?.textContent).toContain('Copied (JSON)')
  expect(exportingButtons.slice(1).every((button) => button.disabled)).toBe(true)
  expect(exportingButtons.slice(1).every((button) => button.textContent === 'Exporting…')).toBe(true)
  act(() => exportingButtons[1]?.click())
  expect(props.onExportSarif).not.toHaveBeenCalled()
})

it('hides the actions when closed', () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  props = createProps()
  renderMenu({ open: false })

  expect(host?.querySelectorAll('button')).toHaveLength(1)
  expect(host?.textContent).toContain('↓ Export')
})
