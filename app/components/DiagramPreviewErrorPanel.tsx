interface DiagramPreviewErrorPanelProps {
  message: string | null
  fullMessage: string | null
}

function ErrorDetails({ fullMessage, hasMoreDetails }: Pick<DiagramPreviewErrorPanelProps, 'fullMessage'> & { hasMoreDetails: boolean }) {
  if (!fullMessage || !hasMoreDetails) return null

  return (
    <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontSize: '10px', marginTop: '8px', padding: '8px', background: 'rgba(0,0,0,0.2)', borderRadius: '3px' }}>
      {fullMessage}
    </pre>
  )
}

export default function DiagramPreviewErrorPanel({
  message,
  fullMessage,
}: DiagramPreviewErrorPanelProps) {
  if (!message) return null

  const hasMoreDetails = Boolean(fullMessage && fullMessage !== message)

  return (
    <div
      role="alert"
      style={{
        padding: '12px',
        border: '1px solid var(--color-error)',
        background: 'rgba(255,85,85,0.05)',
        color: 'var(--color-error)',
        fontSize: '12px',
        marginBottom: '8px',
      }}
    >
      <div style={{ marginBottom: '4px' }}>
        <div style={{ fontWeight: 600 }}>⚠ Syntax Error</div>
      </div>
      <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{message}</pre>
      <ErrorDetails fullMessage={fullMessage} hasMoreDetails={hasMoreDetails} />
    </div>
  )
}
