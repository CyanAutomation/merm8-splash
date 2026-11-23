import type { HTMLAttributes, ReactNode } from 'react'

export type StackDirection = 'horizontal' | 'vertical'
export type StackGap = 'small' | 'medium' | 'large'

export interface StackProps extends HTMLAttributes<HTMLDivElement> {
  direction?: StackDirection
  gap?: StackGap
  children: ReactNode
}

export default function Stack({
  direction = 'vertical',
  gap = 'medium',
  className = '',
  children,
  ...props
}: StackProps) {
  return (
    <div
      {...props}
      className={['ui-stack', className].filter(Boolean).join(' ')}
      data-direction={direction}
      data-gap={gap}
    >
      {children}
    </div>
  )
}
