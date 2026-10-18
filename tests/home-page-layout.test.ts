import { createElement, type ComponentProps } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it, vi } from 'vitest'
import HomePageLayout, { type HomePageLayoutProps } from '../app/components/HomePageLayout'
import type HomeHeader from '../app/components/HomeHeader'
import type HomeDialogs from '../app/components/HomeDialogs'
import type StatusBar from '../app/components/StatusBar'
import type { WorkspaceAreaProps } from '../app/components/WorkspaceArea'

const childMocks = vi.hoisted(() => ({
  header: () => 'Home header',
  workspace: () => 'Workspace',
  statusBar: () => 'Status bar',
  dialogs: () => 'Dialogs',
}))

vi.mock('../app/components/HomeHeader', () => ({ default: childMocks.header }))
vi.mock('../app/components/WorkspaceArea', () => ({ default: childMocks.workspace }))
vi.mock('../app/components/StatusBar', () => ({ default: childMocks.statusBar }))
vi.mock('../app/components/HomeDialogs', () => ({ default: childMocks.dialogs }))

it('renders the header, workspace, status bar, and dialogs in page order', () => {
  const props = {
    header: null as unknown as ComponentProps<typeof HomeHeader>,
    workspace: null as unknown as WorkspaceAreaProps,
    statusBar: null as unknown as ComponentProps<typeof StatusBar>,
    dialogs: null as unknown as ComponentProps<typeof HomeDialogs>,
  } satisfies HomePageLayoutProps
  const markup = renderToStaticMarkup(createElement(HomePageLayout, props))
  const regions = ['Home header', 'Workspace', 'Status bar', 'Dialogs']
  const regionPositions = regions.map((region) => markup.indexOf(region))

  expect(markup).toContain('class="app-shell"')
  expect(regionPositions.every((position) => position >= 0)).toBe(true)
  expect(regionPositions).toEqual([...regionPositions].sort((a, b) => a - b))
})
