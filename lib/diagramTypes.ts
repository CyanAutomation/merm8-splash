/**
 * Diagram type detection and rule mapping utilities.
 *
 * Provides functions to:
 * - Parse diagram type from Mermaid code by checking first non-whitespace line
 * - Map diagram types to their applicable rule IDs
 * - Filter rules by diagram type for both API requests and UI display
 */

/**
 * Detects diagram type from Mermaid code by checking the first non-whitespace line.
 *
 * Supports:
 * - Flowchart/Graph: 'graph', 'flowchart' (TD, LR, etc.)
 * - Sequence: 'sequenceDiagram'
 * - Class: 'classDiagram'
 * - Entity-Relationship: 'erDiagram'
 * - State: 'stateDiagram'
 * - XY Charts: 'xychart-beta'
 *
 * @param code - The Mermaid diagram code
 * @returns The diagram type string, or null if unable to parse
 */
export function parseDiagramType(code: string): string | null {
  if (!code || typeof code !== 'string') {
    return null
  }

  let inDirectiveBlock = false

  for (const rawLine of code.split('\n')) {
    const line = rawLine.trim()
    if (!line) continue

    const directive = readDirectiveDeclaration(line, inDirectiveBlock)
    if (directive) {
      inDirectiveBlock = directive.inDirectiveBlock
      if (directive.diagramType) return directive.diagramType
      continue
    }

    if (line.startsWith('%%')) continue

    // The first meaningful declaration determines the result, even when unknown.
    return classifyDiagramDeclaration(line)
  }

  return null
}

interface DirectiveLineResult {
  inDirectiveBlock: boolean
  diagramType: string | null
}

function readDirectiveDeclaration(
  line: string,
  inDirectiveBlock: boolean
): DirectiveLineResult | null {
  if (!inDirectiveBlock && !line.startsWith('%%{')) return null

  const closingIndex = line.indexOf('}%%')
  if (closingIndex === -1) {
    return { inDirectiveBlock: true, diagramType: null }
  }

  const remainder = line.slice(closingIndex + 3).trim()
  return {
    inDirectiveBlock: false,
    diagramType: remainder && !remainder.startsWith('%%')
      ? classifyDiagramDeclaration(remainder)
      : null,
  }
}

function classifyDiagramDeclaration(declaration: string): string | null {
  const normalized = declaration.toLowerCase()

  if (normalized.startsWith('sequencediagram')) return 'sequence'
  if (normalized.startsWith('classdiagram')) return 'class'
  if (normalized.startsWith('erdiagram')) return 'er'
  if (isStateDiagramDeclaration(normalized)) return 'state'
  if (normalized.startsWith('xychart-')) return 'xychart'
  if (isFlowchartDeclaration(normalized)) return 'flowchart'

  return null
}

function isStateDiagramDeclaration(normalized: string): boolean {
  return /^statediagram(?:-v2)?(?:\s|$)/.test(normalized)
}

function isFlowchartDeclaration(normalized: string): boolean {
  return /^(?:graph|flowchart)(?:\s|$)/.test(normalized)
}

/**
 * Mapping of diagram types to their applicable rule IDs.
 * Rules not in this mapping are considered universal (applicable to all diagram types).
 *
 * Source: QA report recommendations
 */
const diagramTypeRuleMap: Record<string, Set<string>> = {
  flowchart: new Set([
    'max-fanout',
    'no-cycles',
    'no-disconnected-nodes',
    'no-duplicate-node-ids',
  ]),
  sequence: new Set(['no-undefined-actors']),
  class: new Set(['no-duplicate-classes']),
  er: new Set(['no-self-referential']),
  state: new Set(['no-unreachable-state']),
}

/**
 * Gets the set of rule IDs applicable to a given diagram type.
 *
 * When diagram type is unknown or null, returns all rules (fail-open behavior).
 *
 * @param diagramType - The diagram type (or null if unknown)
 * @param allRuleIds - All available rule IDs (used as fallback for unknown types)
 * @returns Set of applicable rule IDs for the given diagram type
 */
export function getApplicableRules(
  diagramType: string | null,
  allRuleIds: string[]
): Set<string> {
  // If diagram type is unknown/null, allow all rules (safe default)
  if (!diagramType) {
    return new Set(allRuleIds)
  }

  const applicableRules = diagramTypeRuleMap[diagramType]

  // If diagram type is not in our mapping, allow all rules (safe default)
  if (!applicableRules) {
    return new Set(allRuleIds)
  }

  const mappedRuleIds = new Set<string>()
  Object.values(diagramTypeRuleMap).forEach((ruleSet) => {
    ruleSet.forEach((ruleId) => mappedRuleIds.add(ruleId))
  })

  const universalRules = allRuleIds.filter((ruleId) => !mappedRuleIds.has(ruleId))

  return new Set([...applicableRules, ...universalRules])
}

/**
 * Filters an array of rule IDs to only those applicable to the given diagram type.
 * This is useful for filtering which rules to send in API requests.
 *
 * @param ruleIds - The array of rule IDs to filter
 * @param diagramType - The diagram type (or null if unknown)
 * @returns Filtered array of applicable rule IDs
 */
export function filterRulesByDiagramType(ruleIds: string[], diagramType: string | null): string[] {
  const applicableRules = getApplicableRules(diagramType, ruleIds)
  return ruleIds.filter((id) => applicableRules.has(id))
}
