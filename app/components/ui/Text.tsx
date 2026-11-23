import type { ElementType, HTMLAttributes, ReactNode } from 'react'

export type TextVariant = 'body' | 'caption' | 'heading'
export type TextElement = 'h2' | 'h3' | 'p' | 'span'

export interface TextProps extends HTMLAttributes<HTMLElement> {
  as?: TextElement
  variant?: TextVariant
  children: ReactNode
}

export default function Text({
  as,
  variant = 'body',
  className = '',
  children,
  ...props
}: TextProps) {
  const defaultElement: TextElement = variant === 'heading' ? 'h3' : 'p'
  const Element: ElementType = as ?? defaultElement

  return (
    <Element
      {...props}
      className={['ui-text', `ui-text--${variant}`, className].filter(Boolean).join(' ')}
    >
      {children}
    </Element>
  )
}
