import type { CSSProperties } from 'react'
import type { Violation } from '@/lib/api'
import { severityColor } from '@/lib/severity'
import Button from './Button'

interface ViolationTableProps {
  violations: Violation[]
  copiedKey: string | null
  copyErrorKey: string | null
  onCopy: (violation: Violation, key: string) => void
  onJumpToLine?: (line: number) => void
}

const violationKey = (violation: Violation, index: number): string => {
  const { rule_id, severity, message, line, node_id } = violation
  return [rule_id, severity, message, line ?? '', node_id ?? '', index].join('::')
}

const severityOrder: Record<Violation['severity'], number> = { error: 0, warning: 1, info: 2 }

export default function ViolationTable({
  violations,
  copiedKey,
  copyErrorKey,
  onCopy,
  onJumpToLine,
}: ViolationTableProps) {
  const orderedViolations = violations
    .map((violation, originalIndex) => ({ violation, originalIndex }))
    .sort((left, right) => severityOrder[left.violation.severity] - severityOrder[right.violation.severity]
      || left.originalIndex - right.originalIndex)

  return (
    <div className="results-table-scroll">
      <table className="results-table">
      <thead>
        <tr>
          <th scope="col">Severity</th>
          <th scope="col">Message</th>
          <th scope="col">Line</th>
          <th scope="col" aria-label="Finding details">Details</th>
        </tr>
      </thead>
      <tbody>
        {orderedViolations.map(({ violation, originalIndex }) => {
          const key = violationKey(violation, originalIndex)
          const color = severityColor(violation.severity)

          return (
            <tr key={key}>
              <td>
                <span className="severity-label" style={{ '--severity-color': color } as CSSProperties}>
                  {violation.severity}
                </span>
              </td>
              <td className="violation-message">
                {violation.message}
              </td>
              <td className="violation-line">
                {violation.line != null && onJumpToLine ? (
                  <Button
                    size="small"
                    variant="quiet"
                    aria-label={`Go to line ${violation.line}`}
                    onClick={() => onJumpToLine(violation.line!)}
                  >
                    {violation.line}
                  </Button>
                ) : violation.line ?? '—'}
              </td>
              <td className="violation-actions">
                <details className="violation-details">
                  <summary>{violation.rule_id}</summary>
                  <Button
                    size="small"
                    variant="quiet"
                    aria-label={copiedKey === key ? `Copied ${violation.rule_id}` : `Copy ${violation.rule_id} result`}
                    onClick={(event) => {
                      event.stopPropagation()
                      onCopy(violation, key)
                    }}
                  >
                    {copiedKey === key ? 'Copied' : copyErrorKey === key ? 'Try again' : 'Copy result'}
                  </Button>
                </details>
              </td>
            </tr>
          )
        })}
      </tbody>
      </table>
    </div>
  )
}
