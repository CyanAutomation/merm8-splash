import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'merm8-splash | Mermaid Linter',
  description: 'Interactive Bubble Tea-inspired UI for the merm8 Mermaid linter API',
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
