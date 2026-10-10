import type { ReactNode } from 'react'
import { extractLineNumber } from '@/lib/errorUtils'

interface DiagramPreviewErrorPanelProps {
  message: string | null
  fullMessage: string | null
  expanded: boolean
  onToggleExpanded: () => void
  onJumpToLine?: (line: number) => void
}

interface ErrorActionButtonProps {
  children: ReactNode
  onClick: () => void
}

function ErrorActionButton({ children, onClick }: ErrorActionButtonProps) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '2px 8px',
        fontSize: '11px',
        border: '1px solid rgba(255,85,85,0.4)',
        background: 'transparent',
        color: 'var(--color-error)',
        borderRadius: '3px',
        cursor: 'pointer',
        transition: 'all 0.2s ease',
      }}
      onMouseEnter={(event) => {
        event.currentTarget.style.background = 'rgba(255,85,85,0.1)'
      }}
      onMouseLeave={(event) => {
        event.currentTarget.style.background = 'transparent'
      }}
    >
      {children}
    </button>
  )
}

interface ErrorPanelActionsProps {
  line: number | null
  hasMoreDetails: boolean
  expanded: boolean
  onToggleExpanded: () => void
  onJumpToLine?: (line: number) => void
}

function ErrorPanelActions({ line, hasMoreDetails, expanded, onToggleExpanded, onJumpToLine }: ErrorPanelActionsProps) {
  return (
    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
      {line != null && onJumpToLine && (
        <ErrorActionButton onClick={() => onJumpToLine(line)}>Show me where</ErrorActionButton>
      )}
      {hasMoreDetails && (
        <ErrorActionButton onClick={onToggleExpanded}>
          {expanded ? 'Hide details' : 'Show details'}
        </ErrorActionButton>
      )}
    </div>
  )
}

function ExpandedErrorDetails({
  fullMessage,
  expanded,
  hasMoreDetails,
}: Pick<DiagramPreviewErrorPanelProps, 'fullMessage' | 'expanded'> & { hasMoreDetails: boolean }) {
  if (!expanded || !fullMessage || !hasMoreDetails) return null

  return (
    <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontSize: '10px', marginTop: '8px', padding: '8px', background: 'rgba(0,0,0,0.2)', borderRadius: '3px' }}>
      {fullMessage}
    </pre>
  )
}

export default function DiagramPreviewErrorPanel({
  message,
  fullMessage,
  expanded,
  onToggleExpanded,
  onJumpToLine,
}: DiagramPreviewErrorPanelProps) {
  if (!message) return null

  const line = extractLineNumber(message)
  const hasMoreDetails = Boolean(fullMessage && fullMessage !== message)

  return (
    <div
      style={{
        padding: '12px',
        border: '1px solid var(--color-error)',
        background: 'rgba(255,85,85,0.05)',
        color: 'var(--color-error)',
        fontSize: '12px',
        marginBottom: '8px',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '4px' }}>
        <div style={{ fontWeight: 600 }}>⚠ Syntax Error</div>
        <ErrorPanelActions
          line={line}
          hasMoreDetails={hasMoreDetails}
          expanded={expanded}
          onToggleExpanded={onToggleExpanded}
          onJumpToLine={onJumpToLine}
        />
      </div>
      <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{message}</pre>
      <ExpandedErrorDetails fullMessage={fullMessage} expanded={expanded} hasMoreDetails={hasMoreDetails} />
    </div>
  )
}
