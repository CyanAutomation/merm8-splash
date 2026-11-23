import { Catalog } from '@a2ui/web_core/catalog'
import basicCatalogDocument from './basic-catalog-v1.json'

import { A2UI_CATALOG_ID } from './types'

/** Schema-only Basic Catalog; the official browser entry point also imports Lit renderers. */
export const basicCatalog = Catalog.fromJson(
  basicCatalogDocument as never,
  '1.0',
  A2UI_CATALOG_ID,
)
