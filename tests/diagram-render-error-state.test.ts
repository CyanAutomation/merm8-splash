// @vitest-environment jsdom
import { act, createElement, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'

const rendererMocks = vi.hoisted(() => ({ renderDiagramSvg: vi.fn() }))

vi.mock('../app/components/diagramRenderer', () => rendererMocks)

import { useDiagramRenderEffect } from '../app/components/useDiagramRenderEffect'

const dom = {
  clearPendingFitRaf: vi.fn(),
  renderSequenceRef: { current: 0 },
  containerRef: { current: document.createElement('div') },
  removeMermaidFallbackNodes: vi.fn(),
  lastRenderIdRef: { current: null as string | null },
  idCounterRef: { current: 0 },
  ownedRenderIdsRef: { current: new Set<string>() },
  commitSvg: vi.fn(),
  fitDiagramToContainer: vi.fn(),
}

function RenderErrorHarness({ onParseStateChange, code = 'invalid diagram', parseErrorMessage }: {
  onParseStateChange: (state: { hasParseError: boolean; message: string | null; fullMessage?: string | null }) => void
  code?: string
  parseErrorMessage?: string | null
}) {
  const [, setRenderError] = useState<string | null>(null)
  const [, setFullRenderError] = useState<string | null>(null)
  const [, setIsRendering] = useState(false)

  useDiagramRenderEffect({
    code,
    previewId: 'preview-1',
    stableId: 'preview-1',
    colorMode: 'dark',
    parseErrorMessage,
    useBeautifulRenderer: false,
    onParseStateChange,
    dom: dom as never,
    setRenderError,
    setFullRenderError,
    setIsRendering,
  })

  return null
}

let root: Root | null = null
let container: HTMLDivElement

beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  container = document.createElement('div')
  document.body.appendChild(container)
  dom.renderSequenceRef.current = 0
  dom.containerRef.current = document.createElement('div')
  rendererMocks.renderDiagramSvg.mockReset()
})

afterEach(() => {
  if (root) act(() => root?.unmount())
  root = null
  container.remove()
  vi.unstubAllGlobals()
})

it.each([
  ['empty code', { code: '' }],
  ['a known parse error', { parseErrorMessage: 'Unexpected token' }],
])('clears stale preview nodes for %s', (_label, props) => {
  dom.containerRef.current.append(document.createTextNode('stale preview text'), document.createElement('svg'))
  root = createRoot(container)

  act(() => {
    root?.render(createElement(RenderErrorHarness, { onParseStateChange: vi.fn(), ...props }))
  })

  expect(dom.containerRef.current.childNodes).toHaveLength(0)
})

it('reports both the short error and the full renderer details to shared parse state', async () => {
  const fullMessage = 'Unexpected token\nParse error on line 7\nDetailed parser trace'
  let resolveParseState!: () => void
  const parseStateReported = new Promise<void>((resolve) => {
    resolveParseState = resolve
  })
  const onParseStateChange = vi.fn(() => resolveParseState())
  rendererMocks.renderDiagramSvg.mockRejectedValue(new Error(fullMessage))
  dom.containerRef.current.append(document.createTextNode('stale preview text'), document.createElement('svg'))
  root = createRoot(container)

  act(() => {
    root?.render(createElement(RenderErrorHarness, { onParseStateChange }))
  })
  await act(async () => {
    await parseStateReported
  })

  expect(onParseStateChange).toHaveBeenCalledWith({
    hasParseError: true,
    message: 'Unexpected token',
    fullMessage,
  })
  expect(dom.containerRef.current.childNodes).toHaveLength(0)
})
