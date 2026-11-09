import { useId, type ReactNode } from 'react'

export interface SettingsGroupProps {
  title: string
  description?: ReactNode
  children: ReactNode
  className?: string
}

export default function SettingsGroup({ title, description, children, className = '' }: SettingsGroupProps) {
  const titleId = useId()

  return (
    <section
      className={['settings-group', className].filter(Boolean).join(' ')}
      aria-labelledby={titleId}
    >
      <h3 className="settings-group-title" id={titleId}>{title}</h3>
      {description && <div className="settings-group-description">{description}</div>}
      <div className="settings-group-content">{children}</div>
    </section>
  )
}
