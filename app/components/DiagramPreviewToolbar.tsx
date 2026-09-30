import type { ReactNode } from 'react'
import ToggleSlider from './ToggleSlider'
import type { DiagramColorMode } from './diagramRenderer'

interface DiagramPreviewToolbarProps {
  hasCode: boolean
  hasError: boolean
  colorMode: DiagramColorMode
  useBeautifulRenderer: boolean
  isRendering: boolean
  canToggleBeautifulRenderer: boolean
  canExpand: boolean
  onToggleColorMode: () => void
  onFit: () => void
  onExpand?: () => void
  onToggleBeautifulRenderer?: (value: boolean) => void
}

interface ToolbarButtonProps {
  children: ReactNode
  title: string
  onClick: () => void
  ariaLabel?: string
}

function ToolbarButton({ children, title, onClick, ariaLabel }: ToolbarButtonProps) {
  return (
    <button
      onClick={onClick}
      title={title}
      aria-label={ariaLabel}
      style={{
        padding: '4px 8px',
        fontSize: '12px',
        border: '1px solid var(--color-border)',
        background: 'var(--color-bg-secondary)',
        color: 'var(--color-text-primary)',
        borderRadius: '3px',
        cursor: 'pointer',
        transition: 'all 0.2s ease',
      }}
      onMouseEnter={(event) => {
        event.currentTarget.style.background = 'var(--color-accent-primary)'
        event.currentTarget.style.color = '#000'
      }}
      onMouseLeave={(event) => {
        event.currentTarget.style.background = 'var(--color-bg-secondary)'
        event.currentTarget.style.color = 'var(--color-text-primary)'
      }}
    >
      {children}
    </button>
  )
}

export default function DiagramPreviewToolbar({
  hasCode,
  hasError,
  colorMode,
  useBeautifulRenderer,
  isRendering,
  canToggleBeautifulRenderer,
  canExpand,
  onToggleColorMode,
  onFit,
  onExpand,
  onToggleBeautifulRenderer,
}: DiagramPreviewToolbarProps) {
  const isVisible = hasCode && !hasError

  return (
    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
      {isVisible && (
        <>
          <ToolbarButton
            onClick={onToggleColorMode}
            title={`Switch to ${colorMode === 'dark' ? 'light' : 'dark'} diagram mode`}
            ariaLabel={`Toggle diagram mode. Current mode: ${colorMode}`}
          >
            {colorMode === 'dark' ? '☾ Dark' : '☀︎ Light'}
          </ToolbarButton>
          <ToolbarButton onClick={onFit} title="Reset zoom to fit diagram in view">
            ↔ Fit
          </ToolbarButton>
          {canExpand && onExpand && (
            <ToolbarButton onClick={onExpand} title="Expand diagram to full screen">
              ⛶ Expand
            </ToolbarButton>
          )}
          {canToggleBeautifulRenderer && onToggleBeautifulRenderer && (
            <ToggleSlider
              value={useBeautifulRenderer}
              onChange={onToggleBeautifulRenderer}
              label="✨ Beautiful"
              title="Toggle beautiful-mermaid renderer"
            />
          )}
        </>
      )}
      {isRendering && (
        <span style={{ fontSize: '12px', color: 'var(--color-accent-primary)' }}>
          ⠋ Rendering...
        </span>
      )}
    </div>
  )
}
