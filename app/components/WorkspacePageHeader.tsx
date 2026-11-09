import type { AnalysisResultState } from '@/lib/analysisResultState'
import { getConnectionStatusLabel } from '@/lib/uiCopy'
import type { ConnectionStatus } from '@/lib/useApiEndpoint'
import Button from './Button'
import CheckActionButton from './CheckActionButton'
import PageHeader from './ui/PageHeader'
import StatusBadge, { type StatusBadgeTone } from './ui/StatusBadge'
import ToolbarGroup from './ui/ToolbarGroup'

interface WorkspacePageHeaderProps {
  connectionStatus: ConnectionStatus
  check: {
    endpoint: string
    connectionStatus: ConnectionStatus
    resultState: AnalysisResultState
    isAnalyzing: boolean
    canRecheck: boolean
    onRecheck: () => void
    onTestConnection: () => void
    onOpenApiConfiguration: () => void
  }
  onOpenRules: () => void
}

function getConnectionTone(status: ConnectionStatus): StatusBadgeTone {
  if (status === 'connected') return 'success'
  if (status === 'checking') return 'warning'
  if (status === 'error') return 'error'
  return 'neutral'
}

export default function WorkspacePageHeader({ connectionStatus, check, onOpenRules }: WorkspacePageHeaderProps) {
  return (
    <PageHeader
      className="workspace-page-header"
      title="Diagram workspace"
      description="Edit a Mermaid diagram, then run a check to see findings."
      headingLevel="h2"
      metadata={(
        <StatusBadge tone={getConnectionTone(connectionStatus)} role="status" aria-live="polite">
          API: {getConnectionStatusLabel(connectionStatus)}
        </StatusBadge>
      )}
      actions={(
        <ToolbarGroup label="Workspace actions">
          <CheckActionButton {...check} />
          <Button onClick={onOpenRules} title="Choose which rules to run">Rules</Button>
        </ToolbarGroup>
      )}
    />
  )
}
