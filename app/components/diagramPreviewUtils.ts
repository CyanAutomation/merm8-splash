export interface DiagramFitDimensions {
  width: number
  height: number
}

export function extractErrorFirstLine(message: string | null): string | null {
  if (!message) return null
  return message.split('\n')[0] || message
}

export function detectMermaidErrorInSvg(svg: string): string | null {
  if (!svg) return null

  const hasErrorIndicator =
    svg.includes('aria-roledescription="error"') ||
    svg.includes('Syntax error') ||
    svg.includes('Parse error') ||
    (svg.includes('mermaid version') && svg.includes('text'))

  if (!hasErrorIndicator) return null
  if (svg.includes('Syntax error')) return 'Syntax error in diagram (line error detected)'
  if (svg.includes('Parse error')) return 'Parse error in diagram'
  if (svg.includes('mermaid version')) return 'Mermaid diagram rendering error'
  return 'Diagram error'
}

export function isMermaidErrorHtml(html: string): boolean {
  return html.includes('aria-roledescription="error"') && html.includes('dmermaid-')
}

export function calculateDiagramFit(
  containerWidth: number,
  containerHeight: number,
  diagramWidth: number,
  diagramHeight: number,
  padding = 32
): DiagramFitDimensions | null {
  if (containerWidth <= 0 || containerHeight <= 0 || diagramWidth <= 0 || diagramHeight <= 0) {
    return null
  }

  const availableWidth = containerWidth - padding
  const availableHeight = containerHeight - padding
  const scale = Math.min(availableWidth / diagramWidth, availableHeight / diagramHeight, 1)

  return {
    width: diagramWidth * scale,
    height: diagramHeight * scale,
  }
}
