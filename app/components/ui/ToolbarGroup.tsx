import type { HTMLAttributes, ReactNode } from 'react'

export interface ToolbarGroupProps extends Omit<HTMLAttributes<HTMLDivElement>, 'aria-label'> {
  label: string
  children: ReactNode
}

export default function ToolbarGroup({ label, children, className = '', ...props }: ToolbarGroupProps) {
  return (
    <div
      {...props}
      className={['toolbar-group', className].filter(Boolean).join(' ')}
      role="group"
      aria-label={label}
    >
      {children}
    </div>
  )
}
