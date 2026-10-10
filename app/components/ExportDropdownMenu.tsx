interface ExportDropdownMenuProps {
  open: boolean
  copying: string | null
  isExporting: boolean
  hoveredItem: string | null
  onToggleOpen: () => void
  onHover: (label: string | null) => void
  onExportSarif: () => void
  onExportJson: () => void
  onExportMarkdown: () => void
  onExportText: () => void
}

const menuStyle = {
  position: 'absolute' as const,
  top: '100%',
  right: 0,
  marginTop: '4px',
  background: 'var(--color-bg-secondary)',
  border: '1px solid var(--color-border)',
  minWidth: '160px',
  zIndex: 100,
  boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
  borderRadius: '8px',
}

function ExportMenuItem({
  label,
  isExporting,
  hovered,
  onClick,
  onHover,
}: {
  label: string
  isExporting: boolean
  hovered: boolean
  onClick: () => void
  onHover: (label: string | null) => void
}) {
  return (
    <button
      onClick={onClick}
      disabled={isExporting}
      onMouseEnter={() => onHover(label)}
      onMouseLeave={() => onHover(null)}
      style={{
        display: 'block',
        width: '100%',
        textAlign: 'left',
        background: hovered ? 'var(--color-bg-primary)' : 'none',
        border: 'none',
        borderBottom: '1px solid rgba(68,68,68,0.3)',
        padding: '8px 12px',
        color: hovered ? 'var(--color-accent-primary)' : 'var(--color-text-primary)',
        fontFamily: 'var(--font-sans)',
        fontSize: '12px',
        cursor: isExporting ? 'not-allowed' : 'pointer',
        opacity: isExporting ? 0.65 : 1,
      }}
    >
      {isExporting ? 'Exporting…' : label}
    </button>
  )
}

export default function ExportDropdownMenu({
  open,
  copying,
  isExporting,
  hoveredItem,
  onToggleOpen,
  onHover,
  onExportSarif,
  onExportJson,
  onExportMarkdown,
  onExportText,
}: ExportDropdownMenuProps) {
  const items = [
    { label: '↓ SARIF JSON', action: onExportSarif },
    { label: '↓ JSON', action: onExportJson },
    { label: '⎘ Markdown', action: onExportMarkdown },
    { label: '⎘ Plain Text', action: onExportText },
  ]

  return (
    <>
      <button
        className="btn btn-primary"
        onClick={onToggleOpen}
        style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
      >
        {copying ? `✓ Copied (${copying})` : '↓ Export'}
        <span style={{ fontSize: '8px' }}>{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div style={menuStyle}>
          {items.map((item) => (
            <ExportMenuItem
              key={item.label}
              label={item.label}
              isExporting={isExporting}
              hovered={hoveredItem === item.label}
              onClick={item.action}
              onHover={onHover}
            />
          ))}
        </div>
      )}
    </>
  )
}
