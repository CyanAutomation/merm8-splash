export function createMermaidRenderId(stableId: string, renderNumber: number): string {
  const selectorSafeId = stableId.replace(/[^a-zA-Z0-9_-]/g, '-')
  return `mermaid-${selectorSafeId}-${renderNumber}`
}
