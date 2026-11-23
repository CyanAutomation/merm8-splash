'use client'

import type { ReactNode } from 'react'
import { Card, Stack, Text } from './ui'
import { validateA2uiMessages } from '@/lib/a2ui/protocol'
import type { A2uiMessage } from '@/lib/a2ui/types'

type ComponentRecord = Record<string, unknown> & { id: string; component: string }
type JsonRecord = Record<string, unknown>

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

  function renderComponent(componentId: string, ancestry = new Set<string>()): ReactNode {
    if (ancestry.has(componentId)) throw new Error('A2UI component cycle detected.')
    const component = components.get(componentId)
    if (!component) throw new Error('A2UI component reference is missing.')
    const nextAncestry = new Set(ancestry).add(componentId)

    switch (component.component) {
      case 'Column':
      case 'Row': {
        const children = Array.isArray(component.children) ? component.children : []
        return (
          <Stack
            key={component.id}
            direction={component.component === 'Row' ? 'horizontal' : 'vertical'}
            gap={density === 'comfortable' ? 'medium' : 'small'}
            className="a2ui-layout"
            data-a2ui-component-id={component.id}
          >
            {children.map((childId) => typeof childId === 'string' ? renderComponent(childId, nextAncestry) : null)}
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
            {typeof component.child === 'string' ? renderComponent(component.child, nextAncestry) : null}
          </Card>
        )
      case 'Text': {
        const value = displayText(getDataModelValue(dataModel, component.text))
        return (
          <Text
            key={component.id}
            variant={component.variant === 'body' ? 'heading' : 'caption'}
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
      {renderComponent('root')}
    </section>
  )
}
