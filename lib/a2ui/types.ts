export const A2UI_CATALOG_ID = 'https://a2ui.org/specification/v1_0/catalogs/basic/catalog.json'
export const A2UI_SURFACE_ID = 'diagramReview'

export type A2uiComponentName = 'Card' | 'Column' | 'Divider' | 'Icon' | 'List' | 'Row' | 'Text'
export type A2uiMessage = {
  version: '1.0'
  createSurface: {
    surfaceId: string
    catalogId: string
    sendDataModel?: false
    components: Array<Record<string, unknown> & { id: string; component: A2uiComponentName }>
    dataModel: Record<string, unknown>
  }
}

export interface A2uiValidationResult {
  ok: boolean
  reason?: string
  surfaceId?: string
  componentCount?: number
  messages?: A2uiMessage[]
}
