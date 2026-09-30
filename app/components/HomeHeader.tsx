'use client'

import Image from 'next/image'
import remAvatar from '@/design/rem-avatar.png'

interface HomeHeaderProps {
  onOpenApiConfiguration: () => void
  onResetLayout: () => void
}

const headerControlButtonStyle = {
  padding: '4px 12px',
  fontSize: '12px',
  background: 'transparent',
  color: 'var(--color-text-secondary)',
  border: '1px solid var(--color-border)',
  borderRadius: '4px',
  cursor: 'pointer',
  transition: 'all 0.2s ease',
}

function handleHeaderControlMouseEnter(event: React.MouseEvent<HTMLButtonElement>) {
  event.currentTarget.style.color = 'var(--color-accent-primary)'
  event.currentTarget.style.borderColor = 'var(--color-accent-primary)'
  event.currentTarget.style.background = 'rgba(10, 132, 255, 0.1)'
}

function handleHeaderControlMouseLeave(event: React.MouseEvent<HTMLButtonElement>) {
  event.currentTarget.style.color = 'var(--color-text-secondary)'
  event.currentTarget.style.borderColor = 'var(--color-border)'
  event.currentTarget.style.background = 'transparent'
}

export default function HomeHeader({ onOpenApiConfiguration, onResetLayout }: HomeHeaderProps) {
  return (
    <div
      style={{
        padding: '8px 16px',
        borderBottom: '1px solid var(--color-accent-primary)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <Image src={remAvatar} alt="rem-avatar mascot" width={40} height={40} priority />
        <div>
          <span
            style={{
              color: 'var(--color-accent-primary)',
              fontWeight: 600,
              fontSize: '16px',
              marginRight: '8px',
            }}
          >
            merm8-splash
          </span>
          <span style={{ color: 'var(--color-text-secondary)', fontSize: '12px' }}>
            Mermaid Linter Interface
          </span>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <button
          onClick={onOpenApiConfiguration}
          style={headerControlButtonStyle}
          onMouseEnter={handleHeaderControlMouseEnter}
          onMouseLeave={handleHeaderControlMouseLeave}
        >
          ⚙ API
        </button>
        <button
          onClick={onResetLayout}
          style={headerControlButtonStyle}
          onMouseEnter={handleHeaderControlMouseEnter}
          onMouseLeave={handleHeaderControlMouseLeave}
        >
          ↺ Reset
        </button>
      </div>
    </div>
  )
}
