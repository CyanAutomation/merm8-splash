import type { Violation } from '@/lib/api'
import { severityColor } from '@/lib/severity'

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
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
      <thead>
        <tr style={{ borderBottom: '1px solid var(--color-border)', color: 'var(--color-text-secondary)', fontSize: '11px', textAlign: 'left' }}>
          <th style={{ padding: '4px 8px', whiteSpace: 'nowrap' }}>Rule</th>
          <th style={{ padding: '4px 8px' }}>Sev</th>
          <th style={{ padding: '4px 8px', width: '100%' }}>Message</th>
          <th style={{ padding: '4px 8px', whiteSpace: 'nowrap' }}>Line</th>
          <th style={{ padding: '4px 4px' }}></th>
        </tr>
      </thead>
      <tbody>
        {violations.map((violation, index) => {
          const key = violationKey(violation, index)
          const color = severityColor(violation.severity)

          return (
            <tr
              key={key}
              style={{
                borderBottom: '1px solid rgba(68,68,68,0.3)',
                cursor: violation.line != null ? 'pointer' : 'default',
              }}
              onClick={() => violation.line != null && onJumpToLine?.(violation.line)}
            >
              <td style={{ padding: '6px 8px', color: 'var(--color-accent-primary)', whiteSpace: 'nowrap', fontWeight: 600 }}>
                {violation.rule_id}
              </td>
              <td style={{ padding: '6px 8px' }}>
                <span
                  style={{
                    color,
                    border: `1px solid ${color}`,
                    padding: '2px 8px',
                    fontSize: '12px',
                    borderRadius: '8px',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {violation.severity}
                </span>
              </td>
              <td style={{ padding: '6px 8px', color: 'var(--color-text-primary)' }}>
                {violation.message}
              </td>
              <td style={{ padding: '6px 8px', color: 'var(--color-text-secondary)', whiteSpace: 'nowrap' }}>
                {violation.line ?? '—'}
              </td>
              <td style={{ padding: '6px 4px' }}>
                <button
                  className="btn"
                  style={{ fontSize: '10px', padding: '1px 4px' }}
                  onClick={(event) => {
                    event.stopPropagation()
                    onCopy(violation, key)
                  }}
                  title="Copy"
                >
                  {copiedKey === key ? '✓' : copyErrorKey === key ? '⚠' : '⎘'}
                </button>
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}
