import type { HTMLAttributes } from 'react'

export type DividerAxis = 'horizontal' | 'vertical'

export interface DividerProps extends HTMLAttributes<HTMLElement> {
  axis?: DividerAxis
}

export default function Divider({ axis = 'horizontal', className = '', ...props }: DividerProps) {
  const classes = ['ui-divider', className].filter(Boolean).join(' ')

  if (axis === 'vertical') {
    return <div {...props} className={classes} data-axis={axis} role="separator" aria-orientation="vertical" />
  }

  return <hr {...props} className={classes} data-axis={axis} />
}
