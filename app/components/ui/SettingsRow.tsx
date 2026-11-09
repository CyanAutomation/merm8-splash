import type { ReactNode } from 'react'

export interface SettingsRowProps {
  content: ReactNode
  control: ReactNode
  className?: string
}

export default function SettingsRow({ content, control, className = '' }: SettingsRowProps) {
  return (
    <div className={['settings-row', className].filter(Boolean).join(' ')}>
      <div className="settings-row-content">{content}</div>
      <div className="settings-row-control">{control}</div>
    </div>
  )
}
