'use client'

import { useRef } from 'react'

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
  const checkboxRef = useRef<HTMLInputElement>(null)

  const handleChange = () => {
    onChange(!value)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (disabled) return
    if (e.code === 'Space' || e.code === 'Enter') {
      e.preventDefault()
      onChange(!value)
    }
  }

  return (
    <label
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        transition: 'opacity 0.2s ease',
      }}
      title={title}
    >
      {/* Hidden checkbox for semantic HTML and keyboard support */}
      <input
        ref={checkboxRef}
        type="checkbox"
        checked={value}
        onChange={handleChange}
        disabled={disabled}
        style={{ display: 'none' }}
        aria-label={label}
      />

      {/* Label text (optional) */}
      {label && (
        <span
          style={{
            fontSize: '12px',
            color: 'var(--color-text-secondary)',
            fontWeight: 500,
            whiteSpace: 'nowrap',
          }}
        >
          {label}
        </span>
      )}

      {/* Toggle slider track and knob */}
      <div
        role="switch"
        aria-checked={value}
        aria-label={label || 'Toggle'}
        tabIndex={disabled ? -1 : 0}
        onKeyDown={handleKeyDown}
        onClick={!disabled ? handleChange : undefined}
        style={{
          position: 'relative',
          width: '32px',
          height: '16px',
          borderRadius: '8px',
          border: `1px solid ${value ? 'var(--color-accent-primary)' : 'var(--color-border)'}`,
          background: value ? 'var(--color-accent-primary)' : 'var(--color-bg-secondary)',
          transition: 'all 120ms ease',
          cursor: disabled ? 'not-allowed' : 'pointer',
          outline: 'none',
        }}
        onMouseEnter={(e) => {
          if (!disabled) {
            (e.currentTarget as HTMLElement).style.opacity = '0.9'
          }
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLElement).style.opacity = '1'
        }}
        onFocus={(e) => {
          (e.currentTarget as HTMLElement).style.outline = `2px solid var(--color-accent-primary)`
          ;(e.currentTarget as HTMLElement).style.outlineOffset = '2px'
        }}
        onBlur={(e) => {
          (e.currentTarget as HTMLElement).style.outline = 'none'
        }}
      >
        {/* Knob/circle that slides */}
        <div
          style={{
            position: 'absolute',
            top: '1px',
            left: value ? '17px' : '1px',
            width: '14px',
            height: '14px',
            borderRadius: '50%',
            background: 'var(--color-bg-primary)',
            transition: 'left 120ms ease',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.2)',
          }}
        />
      </div>
    </label>
  )
}
