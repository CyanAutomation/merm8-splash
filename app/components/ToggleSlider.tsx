'use client'

import type { KeyboardEvent } from 'react'

interface ToggleSliderProps {
  value: boolean
  onChange: (value: boolean) => void
  label?: string
  title?: string
  disabled?: boolean
}

export default function ToggleSlider({
  value,
  onChange,
  label,
  title,
  disabled = false,
}: ToggleSliderProps) {
  const handleToggle = () => {
    if (disabled) return
    onChange(!value)
  }

  const handleKeyDown = (e: KeyboardEvent) => {
    if (disabled) return
    if (e.code === 'Space' || e.code === 'Enter') {
      e.preventDefault()
      handleToggle()
    }
  }

  return (
    <div
      role="switch"
      aria-checked={value}
      aria-label={label || 'Toggle'}
      tabIndex={disabled ? -1 : 0}
      title={title}
      className={`toggle-switch${disabled ? ' toggle-switch-disabled' : ''}`}
      onClick={handleToggle}
      onKeyDown={handleKeyDown}
    >
      {label && <span className="toggle-switch-label">{label}</span>}

      <div className={`toggle-switch-track${value ? ' toggle-switch-track-active' : ''}`}>
        <div className={`toggle-switch-knob${value ? ' toggle-switch-knob-active' : ''}`} />
      </div>
    </div>
  )
}
