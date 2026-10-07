import { parseDiagramType } from '@/lib/diagramTypes'
import { detectMermaidErrorInSvg, isMermaidErrorHtml } from './diagramPreviewUtils'
import { createMermaidRenderId } from './diagramRenderIds'

export type DiagramColorMode = 'dark' | 'light'

const BEAUTIFUL_SUPPORTED_TYPES = new Set(['flowchart', 'sequence', 'class', 'state', 'er', 'xychart'])

const BEAUTIFUL_RENDER_TOKENS: Record<DiagramColorMode, { bg: string; fg: string; accent: string }> = {
  dark: { bg: '#1c1c1e', fg: '#e1e1e1', accent: '#0a84ff' },
  light: { bg: '#ffffff', fg: '#1f2937', accent: '#0a84ff' },
}

const MERMAID_THEME_CONFIG: Record<DiagramColorMode, {
  theme: 'dark' | 'default'
  darkMode: boolean
  themeVariables: {
    primaryColor: string
    primaryTextColor: string
    primaryBorderColor: string
    lineColor: string
    background: string
    mainBkg: string
  }
}> = {
  dark: {
    theme: 'dark',
    darkMode: true,
    themeVariables: {
      primaryColor: '#0a84ff',
      primaryTextColor: '#e1e1e1',
      primaryBorderColor: '#444444',
      lineColor: '#a0a0a0',
      background: '#1c1c1e',
      mainBkg: '#2c2c2e',
    },
  },
  light: {
    theme: 'default',
    darkMode: false,
    themeVariables: {
      primaryColor: '#0a84ff',
      primaryTextColor: '#1f2937',
      primaryBorderColor: '#9ca3af',
      lineColor: '#4b5563',
      background: '#ffffff',
      mainBkg: '#f9fafb',
    },
  },
}

export interface RenderDiagramOptions {
  code: string
  useBeautifulRenderer: boolean
  colorMode: DiagramColorMode
  stableId: string
  container: HTMLDivElement
  nextRenderNumber: () => number
  beforeMermaidRender: () => void
  onMermaidRenderStart: (renderId: string) => void
}

export interface RenderedDiagram {
  svg: string
  renderId?: string
}

async function tryBeautifulRenderer(
  code: string,
  colorMode: DiagramColorMode,
  enabled: boolean
): Promise<string | null> {
  if (!enabled) return null
  const diagramType = parseDiagramType(code)
  if (!diagramType || !BEAUTIFUL_SUPPORTED_TYPES.has(diagramType)) return null

  try {
    const beautifulMermaid = await import('beautiful-mermaid')
    const tokens = BEAUTIFUL_RENDER_TOKENS[colorMode]
    const svg = beautifulMermaid.renderMermaidSVG(code, {
      bg: tokens.bg,
      fg: tokens.fg,
      accent: tokens.accent,
      transparent: true,
    })
    const renderError = detectMermaidErrorInSvg(svg)
    if (renderError) throw new Error(renderError)
    return svg
  } catch (error) {
    console.debug(
      'beautiful-mermaid render failed, falling back to standard mermaid:',
      error instanceof Error ? error.message : error
    )
    return null
  }
}

function removeMermaidFallbackOutput(container: HTMLDivElement, renderId: string, svg: string): string {
  container.querySelectorAll('[id^="dmermaid-"]').forEach((node) => node.remove())
  container.querySelector(`#d${renderId}`)?.remove()
  return isMermaidErrorHtml(svg) ? '' : svg
}

async function renderWithMermaid(options: RenderDiagramOptions): Promise<RenderedDiagram> {
  const mermaid = (await import('mermaid')).default
  const theme = MERMAID_THEME_CONFIG[options.colorMode]
  mermaid.initialize({
    startOnLoad: false,
    theme: theme.theme,
    darkMode: theme.darkMode,
    themeVariables: theme.themeVariables,
    securityLevel: 'strict',
    logLevel: 'error',
  })

  const renderId = createMermaidRenderId(options.stableId, options.nextRenderNumber())
  options.beforeMermaidRender()
  options.onMermaidRenderStart(renderId)
  const result = await mermaid.render(renderId, options.code, options.container)
  const svg = removeMermaidFallbackOutput(options.container, renderId, result.svg)
  const renderError = detectMermaidErrorInSvg(svg)
  if (renderError) throw new Error(renderError)
  if (!svg.trim() || svg.includes('aria-roledescription="error"')) {
    throw new Error('Mermaid returned error SVG')
  }

  return { svg, renderId }
}

export async function renderDiagramSvg(options: RenderDiagramOptions): Promise<RenderedDiagram> {
  const beautifulSvg = await tryBeautifulRenderer(
    options.code,
    options.colorMode,
    options.useBeautifulRenderer
  )
  if (beautifulSvg !== null) return { svg: beautifulSvg }
  return renderWithMermaid(options)
}
