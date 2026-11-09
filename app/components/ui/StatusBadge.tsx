import type { HTMLAttributes, ReactNode } from 'react'

export type StatusBadgeTone = 'neutral' | 'accent' | 'success' | 'warning' | 'error'

export interface StatusBadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: StatusBadgeTone
  children: ReactNode
}

export default function StatusBadge({ tone = 'neutral', className = '', children, ...props }: StatusBadgeProps) {
  return (
    <span
      {...props}
      className={['status-badge', className].filter(Boolean).join(' ')}
      data-tone={tone}
    >
      {children}
    </span>
  )
}
