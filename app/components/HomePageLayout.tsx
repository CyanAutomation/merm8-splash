'use client'

import type { ComponentProps } from 'react'
import ErrorBoundary from './ErrorBoundary'
import HomeDialogs from './HomeDialogs'
import HomeHeader from './HomeHeader'
import { SnackbarViewport } from './Snackbar'
import StatusBar from './StatusBar'
import WorkspaceArea, { type WorkspaceAreaProps } from './WorkspaceArea'

export interface HomePageLayoutProps {
  header: ComponentProps<typeof HomeHeader>
  workspace: WorkspaceAreaProps
  statusBar: ComponentProps<typeof StatusBar>
  dialogs: ComponentProps<typeof HomeDialogs>
}

export default function HomePageLayout({ header, workspace, statusBar, dialogs }: HomePageLayoutProps) {
  return (
    <div
      className="app-shell"
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        background: 'var(--color-bg-primary)',
      }}
    >
      <HomeHeader {...header} />
      <WorkspaceArea {...workspace} />
      <SnackbarViewport />
      <ErrorBoundary>
        {/* Keep status bar parse state compact: verbose parser text belongs in DiagramPreview's dedicated error panel. */}
        <StatusBar {...statusBar} />
      </ErrorBoundary>
      <HomeDialogs {...dialogs} />
    </div>
  )
}
