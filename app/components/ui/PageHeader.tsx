import type { ReactNode } from 'react'

export interface PageHeaderProps {
  title: string
  description?: ReactNode
  metadata?: ReactNode
  actions?: ReactNode
  headingLevel?: 'h1' | 'h2' | 'h3'
  className?: string
}

export default function PageHeader({
  title,
  description,
  metadata,
  actions,
  headingLevel = 'h1',
  className = '',
}: PageHeaderProps) {
  const Heading = headingLevel

  return (
    <header className={['page-header', className].filter(Boolean).join(' ')}>
      <div className="page-header-content">
        <Heading className="page-header-title">{title}</Heading>
        {description && <div className="page-header-description">{description}</div>}
        {metadata && <div className="page-header-metadata">{metadata}</div>}
      </div>
      {actions && <div className="page-header-actions">{actions}</div>}
    </header>
  )
}
