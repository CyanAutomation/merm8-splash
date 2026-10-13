import { createElement, type ComponentProps } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it, vi } from 'vitest'
import HomePageLayout, { type HomePageLayoutProps } from '../app/components/HomePageLayout'
import type HomeHeader from '../app/components/HomeHeader'
import type HomeDialogs from '../app/components/HomeDialogs'
import type StatusBar from '../app/components/StatusBar'
import type { WorkspaceAreaProps } from '../app/components/WorkspaceArea'

const childMocks = vi.hoisted(() => ({
  header: vi.fn((props: { marker: string }) => props.marker),
  workspace: vi.fn((props: { marker: string }) => props.marker),
  statusBar: vi.fn((props: { marker: string }) => props.marker),
  dialogs: vi.fn((props: { marker: string }) => props.marker),
}))

vi.mock('../app/components/HomeHeader', () => ({ default: childMocks.header }))
vi.mock('../app/components/WorkspaceArea', () => ({ default: childMocks.workspace }))
vi.mock('../app/components/StatusBar', () => ({ default: childMocks.statusBar }))
vi.mock('../app/components/HomeDialogs', () => ({ default: childMocks.dialogs }))

it('renders page regions in order and forwards each region’s props', () => {
  const props = {
    header: { marker: 'Home header' } as unknown as ComponentProps<typeof HomeHeader>,
    workspace: { marker: 'Workspace' } as unknown as WorkspaceAreaProps,
    statusBar: { marker: 'Status bar' } as unknown as ComponentProps<typeof StatusBar>,
    dialogs: { marker: 'Dialogs' } as unknown as ComponentProps<typeof HomeDialogs>,
  } satisfies HomePageLayoutProps
  const markup = renderToStaticMarkup(createElement(HomePageLayout, props))
  const regions = ['Home header', 'Workspace', 'Status bar', 'Dialogs']
  const regionPositions = regions.map((region) => markup.indexOf(region))

  expect(markup).toContain('class="app-shell"')
  expect(regionPositions.every((position) => position >= 0)).toBe(true)
  expect(regionPositions).toEqual([...regionPositions].sort((a, b) => a - b))
  expect(childMocks.header.mock.calls[0]?.[0]).toEqual(props.header)
  expect(childMocks.workspace.mock.calls[0]?.[0]).toEqual(props.workspace)
  expect(childMocks.statusBar.mock.calls[0]?.[0]).toEqual(props.statusBar)
  expect(childMocks.dialogs.mock.calls[0]?.[0]).toEqual(props.dialogs)
})
