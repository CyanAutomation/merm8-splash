import { createElement, type ComponentProps } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it, vi } from 'vitest'
import HomePageLayout, { type HomePageLayoutProps } from '../app/components/HomePageLayout'
import type HomeHeader from '../app/components/HomeHeader'
import type HomeDialogs from '../app/components/HomeDialogs'
import type StatusBar from '../app/components/StatusBar'
import type { WorkspaceAreaProps } from '../app/components/WorkspaceArea'

vi.mock('../app/components/HomeHeader', () => ({ default: () => 'Home header' }))
vi.mock('../app/components/WorkspaceArea', () => ({ default: () => 'Workspace' }))
vi.mock('../app/components/StatusBar', () => ({ default: () => 'Status bar' }))
vi.mock('../app/components/HomeDialogs', () => ({ default: () => 'Dialogs' }))

it('composes the page header, workspace, status, and dialog layers', () => {
  const props = {
    header: {} as ComponentProps<typeof HomeHeader>,
    workspace: {} as WorkspaceAreaProps,
    statusBar: {} as ComponentProps<typeof StatusBar>,
    dialogs: {} as ComponentProps<typeof HomeDialogs>,
  } satisfies HomePageLayoutProps
  const markup = renderToStaticMarkup(createElement(HomePageLayout, props))

  expect(markup).toContain('class="app-shell"')
  expect(markup).toContain('Home header')
  expect(markup).toContain('Workspace')
  expect(markup).toContain('Status bar')
  expect(markup).toContain('Dialogs')
})
