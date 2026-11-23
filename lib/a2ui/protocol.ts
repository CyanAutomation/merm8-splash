import { MessageProcessor } from '@a2ui/web_core/processing'
import { STRICT_VALIDATION } from '@a2ui/web_core/validating'
import { basicCatalog } from './catalog'
import { A2UI_CATALOG_ID, A2UI_SURFACE_ID, type A2uiMessage, type A2uiValidationResult } from './types'

const MAX_MESSAGES = 1
const MAX_MESSAGE_CHARS = 32_000
const MAX_COMPONENTS = 64
const MAX_COMPONENT_DEPTH = 8
const MAX_DATA_BYTES = 16_000
const MAX_DATA_DEPTH = 6
const MAX_STRING_LENGTH = 2_500
const ALLOWED_COMPONENTS = new Set(['Card', 'Column', 'Row', 'Text'])
const ALLOWED_DATA_ROOTS = new Set(['summary', 'semantic', 'issues', 'presentation'])

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function safeJsonSize(value: unknown): number {
  try {
    const serialized = JSON.stringify(value)
    return typeof serialized === 'string' ? new TextEncoder().encode(serialized).byteLength : Number.POSITIVE_INFINITY
  } catch {
    return Number.POSITIVE_INFINITY
  }
}

function inspectData(value: unknown, depth = 0): void {
  if (depth > MAX_DATA_DEPTH) throw new Error('A2UI data is too deeply nested.')
  if (typeof value === 'string') {
    if (value.length > MAX_STRING_LENGTH) throw new Error('A2UI text is too long.')
    return
  }
  if (value === null || typeof value === 'boolean') return
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error('A2UI data contains an invalid number.')
    return
  }
  if (Array.isArray(value)) {
    if (value.length > 32) throw new Error('A2UI data contains too many items.')
    for (const item of value) inspectData(item, depth + 1)
    return
  }
  if (!isRecord(value)) throw new Error('A2UI data contains an unsupported value.')
  for (const [key, item] of Object.entries(value)) {
    if (key.length > 64) throw new Error('A2UI data contains an invalid key.')
    inspectData(item, depth + 1)
  }
}

function inspectTextBinding(value: unknown): void {
  if (typeof value === 'string') return
  if (!isRecord(value) || Object.keys(value).length !== 1 || typeof value['@path'] !== 'string') {
    throw new Error('A2UI text must be a literal string or a data binding.')
  }
  if (!/^\/(summary|semantic|issues|presentation)\/[A-Za-z0-9_-]+$/.test(value['@path'])) {
    throw new Error('A2UI text binding is outside the approved data model.')
  }
}

function inspectSurface(message: Record<string, unknown>, componentIds: Set<string>): number {
  const surface = message.createSurface
  if (!isRecord(surface) || surface.surfaceId !== A2UI_SURFACE_ID || surface.catalogId !== A2UI_CATALOG_ID || surface.sendDataModel === true) {
    throw new Error('A2UI surface identity or configuration is not allowed.')
  }
  if (!Array.isArray(surface.components) || surface.components.length === 0 || surface.components.length > MAX_COMPONENTS) {
    throw new Error('A2UI component count is outside supported limits.')
  }
  if (!isRecord(surface.dataModel) || Object.keys(surface.dataModel).some((key) => !ALLOWED_DATA_ROOTS.has(key))) {
    throw new Error('A2UI data model contains an unsupported root.')
  }
  const presentation = surface.dataModel.presentation
  if (!isRecord(presentation) ||
    typeof presentation.order !== 'string' || !['summary-first', 'checks-first', 'clarity-first'].includes(presentation.order) ||
    typeof presentation.density !== 'string' || !['concise', 'detailed'].includes(presentation.density)) {
    throw new Error('A2UI presentation choices are outside the approved layout set.')
  }
  inspectData(surface.dataModel)
  if (safeJsonSize(surface.dataModel) > MAX_DATA_BYTES) throw new Error('A2UI data model is too large.')

  for (const component of surface.components) {
    if (!isRecord(component) || typeof component.id !== 'string' || !/^[A-Za-z][A-Za-z0-9_-]{0,63}$/.test(component.id)) {
      throw new Error('A2UI component identifier is invalid.')
    }
    if (componentIds.has(component.id)) throw new Error('A2UI component IDs must be unique.')
    componentIds.add(component.id)
    if (typeof component.component !== 'string' || !ALLOWED_COMPONENTS.has(component.component)) {
      throw new Error('A2UI component is outside the approved subset.')
    }
    if (component.component === 'Text') inspectTextBinding(component.text)
  }
  return surface.components.length
}

/** Validates an API-provided A2UI v1.0 message stream using Google's schema runtime and local limits. */
export function validateA2uiMessages(value: unknown): A2uiValidationResult {
  if (!Array.isArray(value) || value.length === 0 || value.length > MAX_MESSAGES) {
    return { ok: false, reason: 'A2UI message stream is empty or too large.' }
  }
  if (safeJsonSize(value) > MAX_MESSAGE_CHARS) return { ok: false, reason: 'A2UI message stream is too large.' }

  const componentIds = new Set<string>()
  let processor: MessageProcessor | null = null
  try {
    const accepted: A2uiMessage[] = []
    for (const message of value) {
      if (!isRecord(message) || message.version !== '1.0') throw new Error('A2UI message version is unsupported.')
      const operations = Object.keys(message).filter((key) => key !== 'version')
      if (operations.length !== 1 || operations[0] !== 'createSurface') throw new Error('A2UI operation is outside the read-only contract.')
      inspectSurface(message, componentIds)
      accepted.push(message as A2uiMessage)
    }

    processor = new MessageProcessor([basicCatalog as never], undefined, {
      version: '1.0',
      validationConfig: { ...STRICT_VALIDATION, allowedMessages: ['createSurface'] },
    })
    processor.processMessages(accepted as never[])
    const surface = processor.getSurface(A2UI_SURFACE_ID)
    if (!surface || processor.getSurfaces().size !== 1) throw new Error('A2UI surface could not be created.')
    surface.componentsModel.validateTopology({ rootId: 'root', maxDepth: MAX_COMPONENT_DEPTH })
    return { ok: true, surfaceId: A2UI_SURFACE_ID, componentCount: componentIds.size, messages: accepted }
  } catch {
    return { ok: false, reason: 'A2UI message stream failed protocol or catalog validation.' }
  } finally {
    processor?.dispose()
  }
}
