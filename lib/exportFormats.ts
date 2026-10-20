import type { Violation } from './api'

function escapeMarkdownCell(text: string): string {
  return text
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .replace(/\r\n|\r|\n/g, '<br>')
    .replace(/\|/g, '\\|')
}

export function createMarkdownExport(
  results: Violation[],
  emptyResultMessage = 'No check results to export yet.',
): string {
  const lines = [
    '# merm8 check results',
    '',
    `**Total violations:** ${results.length}`,
    '',
  ]

  if (results.length === 0) {
    lines.push(emptyResultMessage)
  } else {
    lines.push('| Rule | Severity | Message | Line |')
    lines.push('|------|----------|---------|------|')
    results.forEach((violation) => {
      const cells = [
        escapeMarkdownCell(violation.rule_id),
        escapeMarkdownCell(violation.severity),
        escapeMarkdownCell(violation.message),
        violation.line ?? '—',
      ]
      lines.push(`| ${cells.join(' | ')} |`)
    })
  }

  return lines.join('\n')
}

export function createTextExport(
  results: Violation[],
  emptyResultMessage = 'No check results to export yet.',
): string {
  const lines = results.map((violation) =>
    `[${violation.severity.toUpperCase()}] ${violation.rule_id}: ${violation.message}${violation.line != null ? ` (line ${violation.line})` : ''}`,
  )
  return lines.join('\n') || emptyResultMessage
}

export function createFallbackSarif(results: Violation[]) {
  return {
    version: '2.1.0',
    $schema: 'https://schemastore.azurewebsites.net/schemas/json/sarif-2.1.0.json',
    runs: [{
      tool: { driver: { name: 'merm8', version: '1.0.0', rules: [] } },
      results: results.map((violation) => ({
        ruleId: violation.rule_id,
        level: violation.severity === 'error' ? 'error' : violation.severity === 'warning' ? 'warning' : 'note',
        message: { text: violation.message },
        locations: violation.line != null ? [{
          physicalLocation: {
            artifactLocation: { uri: 'diagram.mmd' },
            region: { startLine: violation.line },
          },
        }] : [],
      })),
    }],
  }
}
