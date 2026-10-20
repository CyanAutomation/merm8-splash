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

export default function ViolationTable({
  violations,
  copiedKey,
  copyErrorKey,
  onCopy,
  onJumpToLine,
}: ViolationTableProps) {
  return (
    <div className="results-table-scroll">
      <table className="results-table">
      <thead>
        <tr>
          <th scope="col">Rule</th>
          <th scope="col">Severity</th>
          <th scope="col">Message</th>
          <th scope="col">Line</th>
          <th scope="col" aria-label="Actions"></th>
        </tr>
      </thead>
      <tbody>
        {violations.map((violation, index) => {
          const key = violationKey(violation, index)
          const color = severityColor(violation.severity)

          return (
            <tr key={key}>
              <td className="violation-rule">
                {violation.rule_id}
              </td>
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
                <Button
                  size="small"
                  variant="quiet"
                  aria-label={copiedKey === key ? `Copied ${violation.rule_id}` : `Copy ${violation.rule_id} result`}
                  onClick={(event) => {
                    event.stopPropagation()
                    onCopy(violation, key)
                  }}
                >
                  {copiedKey === key ? 'Copied' : copyErrorKey === key ? 'Try again' : 'Copy'}
                </Button>
              </td>
            </tr>
          )
        })}
      </tbody>
      </table>
    </div>
  )
}
