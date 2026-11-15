// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest'

const rendererMocks = vi.hoisted(() => ({
  beautifulRender: vi.fn(),
  mermaidInitialize: vi.fn(),
  mermaidRender: vi.fn(),
}))

vi.mock('beautiful-mermaid', () => ({ renderMermaidSVG: rendererMocks.beautifulRender }))
vi.mock('mermaid', () => ({
  default: {
    initialize: rendererMocks.mermaidInitialize,
    render: rendererMocks.mermaidRender,
  },
}))

import { renderDiagramSvg } from '../app/components/diagramRenderer'

const beautifulSvg = '<svg><g>beautiful</g></svg>'
const mermaidSvg = '<svg><g>standard</g></svg>'

function renderOptions(overrides: Partial<Parameters<typeof renderDiagramSvg>[0]> = {}) {
  return {
    code: 'flowchart TD\nA --> B',
    useBeautifulRenderer: true,
    colorMode: 'light' as const,
    stableId: 'preview-1',
    container: document.createElement('div'),
    nextRenderNumber: vi.fn(() => 1),
    beforeMermaidRender: vi.fn(),
    onMermaidRenderStart: vi.fn(),
    ...overrides,
  }
}

beforeEach(() => {
  rendererMocks.beautifulRender.mockReset().mockReturnValue(beautifulSvg)
  rendererMocks.mermaidInitialize.mockReset()
  rendererMocks.mermaidRender.mockReset().mockResolvedValue({ svg: mermaidSvg })
})

afterEach(() => {
  vi.restoreAllMocks()
})

it('uses the beautiful renderer for a supported diagram and selected color mode', async () => {
  const result = await renderDiagramSvg(renderOptions())

  expect(result).toEqual({ svg: beautifulSvg })
  expect(rendererMocks.beautifulRender).toHaveBeenCalledWith('flowchart TD\nA --> B', {
    bg: '#ffffff',
    fg: '#1f2937',
    accent: '#0a84ff',
    transparent: true,
  })
  expect(rendererMocks.mermaidInitialize).not.toHaveBeenCalled()
})

it('falls back to standard Mermaid when the alternate renderer is disabled or unsupported', async () => {
  const disabled = renderOptions({ useBeautifulRenderer: false })
  const disabledResult = await renderDiagramSvg(disabled)
  expect(disabledResult).toMatchObject({ svg: mermaidSvg, renderId: 'mermaid-preview-1-1' })
  expect(rendererMocks.beautifulRender).not.toHaveBeenCalled()
  expect(disabled.beforeMermaidRender).toHaveBeenCalledOnce()
  expect(disabled.onMermaidRenderStart).toHaveBeenCalledWith('mermaid-preview-1-1')

  rendererMocks.mermaidRender.mockClear()
  const unsupported = renderOptions({ code: 'pie\n  "A": 1' })
  await renderDiagramSvg(unsupported)
  expect(rendererMocks.beautifulRender).not.toHaveBeenCalled()
  expect(rendererMocks.mermaidRender).toHaveBeenCalledOnce()
})

it('falls back to standard Mermaid when beautiful-mermaid throws or returns an error SVG', async () => {
  const debug = vi.spyOn(console, 'debug').mockImplementation(() => {})
  rendererMocks.beautifulRender.mockImplementationOnce(() => {
    throw new Error('renderer failed')
  })

  expect(await renderDiagramSvg(renderOptions())).toMatchObject({ svg: mermaidSvg })
  expect(debug).toHaveBeenCalledOnce()

  rendererMocks.beautifulRender.mockReturnValueOnce('<svg>Parse error</svg>')
  expect(await renderDiagramSvg(renderOptions())).toMatchObject({ svg: mermaidSvg })
  expect(rendererMocks.mermaidRender).toHaveBeenCalledTimes(2)
})

it('raises standard Mermaid parse errors after cleaning its fallback output', async () => {
  rendererMocks.mermaidRender.mockResolvedValueOnce({ svg: '<svg>Parse error</svg>' })

  await expect(renderDiagramSvg(renderOptions({ useBeautifulRenderer: false })))
    .rejects.toThrow('Parse error in diagram')
})
