import type { ElementType, HTMLAttributes, ReactNode } from 'react'

export type CardDensity = 'compact' | 'comfortable'
export type CardElement = 'article' | 'div' | 'section'

export interface CardProps extends HTMLAttributes<HTMLElement> {
  as?: CardElement
  density?: CardDensity
  children: ReactNode
}

export default function Card({
  as = 'article',
  density = 'comfortable',
  className = '',
  children,
  ...props
}: CardProps) {
  const Element: ElementType = as

  return (
    <Element
      {...props}
      className={['ui-card', className].filter(Boolean).join(' ')}
      data-density={density}
    >
      {children}
    </Element>
  )
}
