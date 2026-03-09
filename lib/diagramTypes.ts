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
 *
 * @param code - The Mermaid diagram code
 * @returns The diagram type string, or null if unable to parse
 */
export function parseDiagramType(code: string): string | null {
  if (!code || typeof code !== 'string') {
    return null
  }

  // Scan for first meaningful declaration line
  const lines = code.split('\n')
  let inDirectiveBlock = false

  for (const line of lines) {
    const trimmed = line.trim()

    if (!trimmed) {
      continue
    }

    if (inDirectiveBlock) {
      const directiveEndIndex = trimmed.indexOf('}%%')
      if (directiveEndIndex !== -1) {
        inDirectiveBlock = false
        // Process content after directive closing on same line
        const remaining = trimmed.substring(directiveEndIndex + 3).trim()
        if (remaining && !remaining.startsWith('%%')) {
          const normalized = remaining.toLowerCase()
          if (normalized.startsWith('sequencediagram')) return 'sequence'
          if (normalized.startsWith('classdiagram')) return 'class'
          if (normalized.startsWith('erdiagram')) return 'er'
          if (isStateDiagramDeclaration(normalized)) return 'state'
          if (normalized.startsWith('graph ') || normalized.startsWith('flowchart ')) return 'flowchart'
        }
      }
      continue
    }

    if (trimmed.startsWith('%%{')) {
      const directiveEndIndex = trimmed.indexOf('}%%')
      if (directiveEndIndex === -1) {
        inDirectiveBlock = true
        continue
      }
      // Process content after single-line directive
      const remaining = trimmed.substring(directiveEndIndex + 3).trim()
      if (!remaining || remaining.startsWith('%%')) {
        continue
      }
      // Check remaining content for diagram type
      const normalized = remaining.toLowerCase()
      if (normalized.startsWith('sequencediagram')) return 'sequence'
      if (normalized.startsWith('classdiagram')) return 'class'
      if (normalized.startsWith('erdiagram')) return 'er'
      if (isStateDiagramDeclaration(normalized)) return 'state'
      if (normalized.startsWith('graph ') || normalized.startsWith('flowchart ')) return 'flowchart'
      continue
    }

    if (trimmed.startsWith('%%')) {
      continue
    }

    const normalized = trimmed.toLowerCase()

    // Check for diagram type markers
    if (normalized.startsWith('sequencediagram')) {
      return 'sequence'
    }
    if (normalized.startsWith('classdiagram')) {
      return 'class'
    }
    if (normalized.startsWith('erdiagram')) {
      return 'er'
    }
    if (isStateDiagramDeclaration(normalized)) {
      return 'state'
    }
    // Flowchart/Graph detection (graph TD, flowchart LR, etc.)
    if (normalized.startsWith('graph ') || normalized.startsWith('flowchart ')) {
      return 'flowchart'
    }

    // First meaningful declaration line did not match known patterns
    return null
  }

  // No declaration line found
  return null
}

function isStateDiagramDeclaration(normalized: string): boolean {
  return /^statediagram(?:-v2)?(?:\s|$)/.test(normalized)
}

/**
 * Mapping of diagram types to their applicable rule IDs.
 * Rules not in this mapping are considered universal (applicable to all diagram types).
 *
 * Source: QA report recommendations
 */
const diagramTypeRuleMap: Record<string, Set<string>> = {
  flowchart: new Set([
    'max-depth',
    'max-fanout',
    'no-cycles',
    'no-disconnected-nodes',
    'no-duplicate-node-ids',
  ]),
  sequence: new Set(['sequence-max-participants']),
  class: new Set(['class-no-orphan-classes']),
  er: new Set(['er-no-isolated-entities']),
  state: new Set(['state-no-unreachable-states']),
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
