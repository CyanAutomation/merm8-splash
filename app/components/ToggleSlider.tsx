'use client'

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

  const handleKeyDown = (e: React.KeyboardEvent) => {
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
      onClick={handleToggle}
      onKeyDown={handleKeyDown}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        outline: 'none',
        userSelect: 'none',
      }}
      onFocus={(e) => {
        e.currentTarget.style.outline = '2px solid var(--color-accent-primary)'
        e.currentTarget.style.outlineOffset = '2px'
        e.currentTarget.style.borderRadius = '4px'
      }}
      onBlur={(e) => {
        e.currentTarget.style.outline = 'none'
      }}
    >
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

      {/* Toggle track */}
      <div
        style={{
          position: 'relative',
          flexShrink: 0,
          width: '32px',
          height: '16px',
          borderRadius: '8px',
          border: `1px solid ${value ? 'var(--color-accent-primary)' : 'var(--color-border)'}`,
          background: value ? 'var(--color-accent-primary)' : 'var(--color-bg-secondary)',
          transition: 'background 120ms ease, border-color 120ms ease',
        }}
      >
        {/* Knob */}
        <div
          style={{
            position: 'absolute',
            top: '1px',
            left: value ? '17px' : '1px',
            width: '12px',
            height: '12px',
            borderRadius: '50%',
            background: value ? '#000' : 'var(--color-text-secondary)',
            transition: 'left 120ms ease',
          }}
        />
      </div>
    </div>
  )
}
