/**
 * Extract line number from error messages
 * Matches patterns like "at line 2" or "line 2"
 */
export function extractLineNumber(text: string): number | null {
  if (!text) return null
  const match = text.match(/\bat line (\d+)\b/i) || text.match(/\bline (\d+)\b/i)
  if (!match) {
    return null
  }
  const line = Number(match[1])
  return Number.isFinite(line) && line > 0 ? line : null
}
