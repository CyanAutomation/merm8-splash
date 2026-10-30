import type { ReactNode } from 'react'
import ToggleSlider from './ToggleSlider'
import type { DiagramColorMode } from './diagramRenderer'
import Button from './Button'

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
    <Button
      size="small"
      onClick={onClick}
      title={title}
      aria-label={ariaLabel}
    >
      {children}
    </Button>
  )
}

function DiagramToolbarActions({
  visible,
  colorMode,
  useBeautifulRenderer,
  canToggleBeautifulRenderer,
  canExpand,
  onToggleColorMode,
  onFit,
  onExpand,
  onToggleBeautifulRenderer,
}: Pick<DiagramPreviewToolbarProps,
  | 'colorMode'
  | 'useBeautifulRenderer'
  | 'canToggleBeautifulRenderer'
  | 'canExpand'
  | 'onToggleColorMode'
  | 'onFit'
  | 'onExpand'
  | 'onToggleBeautifulRenderer'
> & { visible: boolean }) {
  if (!visible) return null

  return (
    <>
      <ToolbarButton onClick={onFit} title="Fit the diagram in the preview">
        Fit diagram
      </ToolbarButton>
      {canExpand && onExpand && (
        <ToolbarButton onClick={onExpand} title="Open the diagram in full screen">
          Full screen
        </ToolbarButton>
      )}
      <details className="preview-display-options">
        <summary>Display</summary>
        <div className="more-actions-menu" role="group" aria-label="Diagram display options">
          <ToolbarButton
            onClick={onToggleColorMode}
            title={`Switch to ${colorMode === 'dark' ? 'light' : 'dark'} diagram mode`}
            ariaLabel={`Use ${colorMode === 'dark' ? 'light' : 'dark'} diagram colors`}
          >
            {colorMode === 'dark' ? 'Dark diagram' : 'Light diagram'}
          </ToolbarButton>
          {canToggleBeautifulRenderer && onToggleBeautifulRenderer && (
            <ToggleSlider
              value={useBeautifulRenderer}
              onChange={onToggleBeautifulRenderer}
              label="Styled renderer"
              title="Use the styled Mermaid renderer"
            />
          )}
        </div>
      </details>
    </>
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
    <div className="diagram-preview-toolbar">
      <DiagramToolbarActions
        visible={isVisible}
        colorMode={colorMode}
        useBeautifulRenderer={useBeautifulRenderer}
        canToggleBeautifulRenderer={canToggleBeautifulRenderer}
        canExpand={canExpand}
        onToggleColorMode={onToggleColorMode}
        onFit={onFit}
        onExpand={onExpand}
        onToggleBeautifulRenderer={onToggleBeautifulRenderer}
      />
      {isRendering && (
        <span role="status" style={{ fontSize: '12px', color: 'var(--color-accent-primary)' }}>
          Rendering diagram…
        </span>
      )}
    </div>
  )
}
