'use client'

import Image from 'next/image'
import remAvatar from '@/design/rem-avatar.png'
import { PRODUCT_NAME, PRODUCT_TAGLINE } from '@/lib/uiCopy'
import Button from './Button'

interface HomeHeaderProps {
  onOpenApiConfiguration: () => void
  onResetLayout: () => void
}

export default function HomeHeader({ onOpenApiConfiguration, onResetLayout }: HomeHeaderProps) {
  return (
    <header className="home-header">
      <div className="home-brand">
        <Image src={remAvatar} alt="merm8 mascot" width={40} height={40} priority />
        <div className="home-brand-copy">
          <h1 className="home-brand-name">{PRODUCT_NAME}</h1>
          <span className="home-brand-tagline">{PRODUCT_TAGLINE}</span>
        </div>
      </div>
      <div className="home-header-actions">
        <Button variant="secondary" onClick={onOpenApiConfiguration}>
          API settings
        </Button>
        <Button variant="secondary" onClick={onResetLayout}>
          Reset layout
        </Button>
      </div>
    </header>
  )
}
