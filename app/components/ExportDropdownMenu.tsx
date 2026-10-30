import Button from './Button'

interface ExportDropdownMenuProps {
  open: boolean
  copying: string | null
  isExporting: boolean
  onToggleOpen: () => void
  onClose: () => void
  onExportSarif: () => void
  onExportJson: () => void
  onExportMarkdown: () => void
  onExportText: () => void
}

export default function ExportDropdownMenu({
  open,
  copying,
  isExporting,
  onToggleOpen,
  onClose,
  onExportSarif,
  onExportJson,
  onExportMarkdown,
  onExportText,
}: ExportDropdownMenuProps) {
  const items = [
    { label: 'SARIF JSON', action: onExportSarif },
    { label: 'JSON', action: onExportJson },
    { label: 'Markdown', action: onExportMarkdown },
    { label: 'Plain text', action: onExportText },
  ]

  return (
    <div className="export-dropdown">
      <Button
        variant="secondary"
        onClick={onToggleOpen}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls="export-menu"
        disabled={isExporting}
        onKeyDown={(event) => {
          if (event.key === 'Escape' && open) onClose()
        }}
      >
        {copying ? `Copied ${copying}` : 'Export'}
        <span className="export-dropdown-chevron" aria-hidden="true">{open ? '▴' : '▾'}</span>
      </Button>
      {open && (
        <div id="export-menu" className="export-menu" role="menu" aria-label="Export format">
          {items.map((item) => (
            <Button
              key={item.label}
              variant="quiet"
              className="export-menu-item"
              role="menuitem"
              onClick={item.action}
              disabled={isExporting}
            >
              {isExporting ? 'Exporting…' : item.label}
            </Button>
          ))}
        </div>
      )}
    </div>
  )
}
