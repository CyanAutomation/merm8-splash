'use client'

import type { ReactNode } from 'react'
import type { IconName } from './ui'
import { Card, Divider, Icon, List, Stack, Text } from './ui'
import { validateA2uiMessages } from '@/lib/a2ui/protocol'
import type { A2uiMessage } from '@/lib/a2ui/types'

type ComponentRecord = Record<string, unknown> & { id: string; component: string }
type JsonRecord = Record<string, unknown>
type ReviewSection = 'summary' | 'semantic' | 'issues'
type PresentationOrder = 'summary-first' | 'checks-first' | 'clarity-first'

const presentationSectionOrder: Record<PresentationOrder, readonly ReviewSection[]> = {
  'summary-first': ['summary', 'semantic', 'issues'],
  'checks-first': ['issues', 'summary', 'semantic'],
  'clarity-first': ['semantic', 'summary', 'issues'],
}

const reviewSections = new Set<ReviewSection>(['summary', 'semantic', 'issues'])

function isRecord(value: unknown): value is JsonRecord {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function getDataModelValue(dataModel: JsonRecord, value: unknown): unknown {
  if (typeof value === 'string') return value
  if (!isRecord(value) || typeof value['@path'] !== 'string') return ''
  const path = value['@path'].split('/').slice(1)
  let current: unknown = dataModel
  for (const segment of path) {
    if (!isRecord(current)) return ''
    current = current[segment]
  }
  return current
}

function displayText(value: unknown): string {
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  return ''
}

function collectDataRoots(
  componentId: string,
  components: Map<string, ComponentRecord>,
  ancestry = new Set<string>()
): Set<ReviewSection> {
  const roots = new Set<ReviewSection>()
  if (ancestry.has(componentId)) return roots

  const component = components.get(componentId)
  if (!component) return roots
  const nextAncestry = new Set(ancestry).add(componentId)

  if (component.component === 'Text' && isRecord(component.text) && typeof component.text['@path'] === 'string') {
    const section = component.text['@path'].split('/')[1]
    if (reviewSections.has(section as ReviewSection)) roots.add(section as ReviewSection)
    return roots
  }

  const childIds = component.component === 'Card'
    ? typeof component.child === 'string' ? [component.child] : []
    : Array.isArray(component.children) ? component.children.filter((child): child is string => typeof child === 'string') : []

  for (const childId of childIds) {
    for (const root of collectDataRoots(childId, components, nextAncestry)) roots.add(root)
  }
  return roots
}

function orderReviewSections(
  childIds: string[],
  order: PresentationOrder,
  components: Map<string, ComponentRecord>
): string[] {
  const priorityBySection = new Map(presentationSectionOrder[order].map((section, index) => [section, index]))
  return childIds
    .map((id, index) => {
      const roots = collectDataRoots(id, components)
      const section = roots.size === 1 ? roots.values().next().value : undefined
      return { id, index, priority: section ? priorityBySection.get(section) ?? Number.MAX_SAFE_INTEGER : Number.MAX_SAFE_INTEGER }
    })
    .sort((left, right) => left.priority - right.priority || left.index - right.index)
    .map(({ id }) => id)
}

function surfaceMessage(messages: A2uiMessage[]) {
  const validation = validateA2uiMessages(messages)
  if (!validation.ok || validation.surfaceId !== messages[0]?.createSurface.surfaceId) {
    throw new Error(validation.reason ?? 'A2UI surface is invalid.')
  }
  return messages[0]!
}

export interface A2uiSurfaceProps {
  messages: A2uiMessage[]
  label?: string
}

/** Renders the project's approved A2UI Basic Catalog subset with reusable UI primitives. */
export default function A2uiSurface({ messages, label = 'AI-authored diagram review' }: A2uiSurfaceProps) {
  const message = surfaceMessage(messages)
  const surface = message.createSurface
  const dataModel = surface.dataModel
  const components = new Map(surface.components.map((component) => [component.id, component as ComponentRecord]))
  const presentation = isRecord(dataModel.presentation) ? dataModel.presentation : {}
  const density = presentation.density === 'detailed' ? 'comfortable' : 'compact'
  const order = typeof presentation.order === 'string' && Object.hasOwn(presentationSectionOrder, presentation.order)
    ? presentation.order as PresentationOrder
    : 'summary-first'

  function renderComponent(componentId: string, ancestry = new Set<string>(), isRootLayout = false): ReactNode {
    if (ancestry.has(componentId)) throw new Error('A2UI component cycle detected.')
    const component = components.get(componentId)
    if (!component) throw new Error('A2UI component reference is missing.')
    const nextAncestry = new Set(ancestry).add(componentId)

    switch (component.component) {
      case 'Column':
      case 'Row': {
        const children = Array.isArray(component.children) ? component.children : []
        const orderedChildren = isRootLayout
          ? orderReviewSections(children.filter((child): child is string => typeof child === 'string'), order, components)
          : children.filter((child): child is string => typeof child === 'string')
        return (
          <Stack
            key={component.id}
            direction={component.component === 'Row' ? 'horizontal' : 'vertical'}
            gap={density === 'comfortable' ? 'medium' : 'small'}
            className="a2ui-layout"
            data-a2ui-component-id={component.id}
          >
            {orderedChildren.map((childId) => renderComponent(childId, nextAncestry))}
          </Stack>
        )
      }
      case 'Card':
        return (
          <Card
            key={component.id}
            density={density}
            className="a2ui-card"
            data-a2ui-component-id={component.id}
          >
            {typeof component.child === 'string' ? renderComponent(component.child, nextAncestry, isRootLayout) : null}
          </Card>
        )
      case 'List': {
        const children = Array.isArray(component.children)
          ? component.children.filter((child): child is string => typeof child === 'string')
          : []
        const orderedChildren = isRootLayout ? orderReviewSections(children, order, components) : children
        return (
          <List
            key={component.id}
            direction={component.direction === 'horizontal' ? 'horizontal' : 'vertical'}
            className="a2ui-list"
            data-a2ui-component-id={component.id}
          >
            {orderedChildren.map((childId) => (
              <li className="a2ui-list-item" key={childId}>
                {renderComponent(childId, nextAncestry)}
              </li>
            ))}
          </List>
        )
      }
      case 'Divider':
        return (
          <Divider
            key={component.id}
            axis={component.axis === 'vertical' ? 'vertical' : 'horizontal'}
            className="a2ui-divider"
            data-a2ui-component-id={component.id}
          />
        )
      case 'Icon': {
        if (typeof component.name !== 'string') throw new Error('A2UI icon name is missing.')
        const iconName = component.name as IconName
        return (
          <Icon
            key={component.id}
            name={iconName}
            label={{ check: 'Check mark', error: 'Error', info: 'Information', warning: 'Warning' }[iconName]}
            className="a2ui-icon"
            data-a2ui-component-id={component.id}
          />
        )
      }
      case 'Text': {
        const value = displayText(getDataModelValue(dataModel, component.text))
        return (
          <Text
            key={component.id}
            variant={component.variant === 'caption' ? 'caption' : 'body'}
            className="a2ui-text"
            data-a2ui-component-id={component.id}
          >
            {value}
          </Text>
        )
      }
      default:
        throw new Error('A2UI component is outside the approved renderer subset.')
    }
  }

  return (
    <section className="a2ui-surface" role="region" aria-label={label}>
      {renderComponent('root', new Set<string>(), true)}
    </section>
  )
}
