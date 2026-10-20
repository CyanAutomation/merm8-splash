import type { Metadata } from 'next'
import './globals.css'
import { PRODUCT_DESCRIPTION, PRODUCT_NAME } from '@/lib/uiCopy'

export const metadata: Metadata = {
  title: `${PRODUCT_NAME} | Mermaid diagram checker`,
  description: PRODUCT_DESCRIPTION,
  icons: {
    icon: '/favicon.svg',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
