import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect, it } from 'vitest'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

it('does not feed a preview render error back into the preview as a blocking prop', () => {
  const page = fs.readFileSync(path.join(__dirname, '..', 'app', 'page.tsx'), 'utf8')
  const mainPreview = page.match(/<DiagramPreview[\s\S]*?\/>/)

  expect(mainPreview?.[0]).toContain('onParseStateChange={handleParseStateChange}')
  expect(mainPreview?.[0]).not.toContain('parseErrorMessage={parseErrorDetail}')
})
