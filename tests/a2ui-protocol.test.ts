import { expect, it } from 'vitest'
import { validateA2uiMessages } from '../lib/a2ui/protocol'
import { A2UI_CATALOG_ID, A2UI_SURFACE_ID } from '../lib/a2ui/types'

function message(overrides: Record<string, unknown> = {}) {
  return {
    version: '1.0',
    createSurface: {
      surfaceId: A2UI_SURFACE_ID,
      catalogId: A2UI_CATALOG_ID,
      sendDataModel: false,
      components: [
        { id: 'root', component: 'Column', children: ['summaryCard'] },
        { id: 'summaryCard', component: 'Card', child: 'summaryContent' },
        { id: 'summaryContent', component: 'Column', children: ['summaryTitle'] },
        { id: 'summaryTitle', component: 'Text', variant: 'body', text: { '@path': '/summary/title' } },
      ],
      dataModel: {
        presentation: { order: 'summary-first', density: 'concise' },
        summary: { title: 'Diagram review' },
      },
      ...overrides,
    },
  }
}

it('validates a single A2UI v1.0 review surface against the official Basic Catalog', () => {
  const result = validateA2uiMessages([message()])

  expect(result.ok).toBe(true)
  expect(result.surfaceId).toBe(A2UI_SURFACE_ID)
  expect(result.componentCount).toBe(4)
})

it('rejects wrong surface and catalog identities', () => {
  expect(validateA2uiMessages([message({ surfaceId: 'other' })]).ok).toBe(false)
  expect(validateA2uiMessages([message({ catalogId: 'https://example.test/catalog.json' })]).ok).toBe(false)
})

it('rejects components and operations outside the approved read-only review subset', () => {
  const unsupported = message({
    components: [
      { id: 'root', component: 'Column', children: ['input'] },
      { id: 'input', component: 'TextField', value: { '@path': '/summary/title' } },
    ],
  })
  expect(validateA2uiMessages([unsupported]).ok).toBe(false)
  expect(validateA2uiMessages([{ version: '1.0', updateComponents: { surfaceId: A2UI_SURFACE_ID, components: [] } }]).ok).toBe(false)
})

it('rejects duplicate IDs, unsafe bindings, and oversized streams', () => {
  const duplicateIds = message({
    components: [
      { id: 'root', component: 'Column', children: ['summaryCard'] },
      { id: 'root', component: 'Text', text: 'duplicate' },
    ],
  })
  const unsafeBinding = message({
    components: [
      { id: 'root', component: 'Text', text: { '@path': '/secrets/token' } },
    ],
  })
  const oversized = message({ dataModel: { summary: { title: 'x'.repeat(20_000) } } })

  expect(validateA2uiMessages([duplicateIds]).ok).toBe(false)
  expect(validateA2uiMessages([unsafeBinding]).ok).toBe(false)
  expect(validateA2uiMessages([oversized]).ok).toBe(false)
})

it('rejects layout choices that JEV is not permitted to select', () => {
  const invalid = message({
    dataModel: {
      presentation: { order: 'user-defined', density: 'concise' },
      summary: { title: 'Diagram review' },
    },
  })

  expect(validateA2uiMessages([invalid]).ok).toBe(false)
})
