import type { ElementType, HTMLAttributes, ReactNode } from 'react'

export type ListDirection = 'vertical' | 'horizontal'

export interface ListProps extends HTMLAttributes<HTMLElement> {
  direction?: ListDirection
  ordered?: boolean
  children: ReactNode
}

export default function List({
  direction = 'vertical',
  ordered = false,
  className = '',
  children,
  ...props
}: ListProps) {
  const Element: ElementType = ordered ? 'ol' : 'ul'

  return (
    <Element
      {...props}
      className={['ui-list', className].filter(Boolean).join(' ')}
      data-direction={direction}
    >
      {children}
    </Element>
  )
}
