import type { CheckActionInput } from '@/lib/checkAction'
import { getCheckActionState } from '@/lib/checkAction'
import Button from './Button'

export interface CheckActionButtonProps extends CheckActionInput {
  onRecheck: () => void
  onTestConnection: () => void
  onOpenApiConfiguration: () => void
}

export default function CheckActionButton({
  onRecheck,
  onTestConnection,
  onOpenApiConfiguration,
  ...input
}: CheckActionButtonProps) {
  const action = getCheckActionState(input)
  const onClick = action.kind === 'run'
    ? onRecheck
    : action.kind === 'test' ? onTestConnection : onOpenApiConfiguration

  return (
    <Button
      variant="primary"
      onClick={onClick}
      disabled={action.disabled}
      aria-busy={action.busy || undefined}
      title={action.title}
    >
      {action.label}
    </Button>
  )
}
