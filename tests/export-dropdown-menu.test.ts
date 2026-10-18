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

it('runs the selected export action', () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  props = createProps()
  renderMenu()

  const jsonButton = Array.from(host!.querySelectorAll('button'))
    .find((button) => button.textContent === '↓ JSON')
  if (!jsonButton) throw new Error('Expected the JSON export action to render.')

  act(() => jsonButton.click())
  expect(props.onExportJson).toHaveBeenCalledOnce()
})

it('forwards clicks on the export toggle', () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  props = createProps()
  renderMenu()

  const toggleButton = Array.from(host!.querySelectorAll('button'))
    .find((button) => button.textContent?.includes('Export'))
  if (!toggleButton) throw new Error('Expected the export toggle to render.')

  act(() => toggleButton.click())
  expect(props.onToggleOpen).toHaveBeenCalledOnce()
})

it('reports the export item currently under the pointer', () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  props = createProps()
  renderMenu()

  const jsonButton = Array.from(host!.querySelectorAll('button'))
    .find((button) => button.textContent === '↓ JSON')
  if (!jsonButton) throw new Error('Expected the JSON export action to render.')

  act(() => jsonButton.dispatchEvent(new MouseEvent('mouseover', { bubbles: true })))
  expect(props.onHover).toHaveBeenCalledWith('↓ JSON')
  act(() => jsonButton.dispatchEvent(new MouseEvent('mouseout', { bubbles: true })))
  expect(props.onHover).toHaveBeenLastCalledWith(null)
})

it('prevents export actions while an export is in progress', () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  props = createProps()

  renderMenu({ isExporting: true })
  const buttons = Array.from(host!.querySelectorAll('button'))
  const exportActions = buttons.filter((button) => button.textContent === 'Exporting…')

  expect(exportActions).toHaveLength(4)
  expect(exportActions.every((button) => button.disabled)).toBe(true)

  for (const button of exportActions) {
    act(() => button.click())
  }

  expect(props.onExportSarif).not.toHaveBeenCalled()
  expect(props.onExportJson).not.toHaveBeenCalled()
  expect(props.onExportMarkdown).not.toHaveBeenCalled()
  expect(props.onExportText).not.toHaveBeenCalled()
})

it('hides the actions when closed', () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  props = createProps()
  renderMenu({ open: false })

  expect(host?.querySelectorAll('button')).toHaveLength(1)
  expect(host?.textContent).toContain('↓ Export')
})
