import { describe, expect, it } from 'vitest'
import { validateSoyuzBaseUrl } from '../scripts/validate-soyuz-url.ts'
import { validateSoyuzRunId } from '../scripts/validate-soyuz-run-id.ts'

describe('validateSoyuzBaseUrl', () => {
  it('accepts the configured Soyuz origin and normalizes a trailing slash', () => {
    expect(validateSoyuzBaseUrl('https://soyuz.scheimann.workers.dev'))
      .toBe('https://soyuz.scheimann.workers.dev')
    expect(validateSoyuzBaseUrl('https://soyuz.scheimann.workers.dev/'))
      .toBe('https://soyuz.scheimann.workers.dev')
  })

  it.each([
    '',
    ' https://soyuz.scheimann.workers.dev',
    'http://soyuz.scheimann.workers.dev',
    'https://attacker.example',
    'https://user:password@soyuz.scheimann.workers.dev',
    'https://soyuz.scheimann.workers.dev/api',
    'https://soyuz.scheimann.workers.dev?target=attacker.example',
    'https://soyuz.scheimann.workers.dev#fragment',
  ])('rejects an unsafe or malformed URL: %s', (url) => {
    expect(() => validateSoyuzBaseUrl(url)).toThrow()
  })

  it('rejects missing values', () => {
    expect(() => validateSoyuzBaseUrl(undefined)).toThrow()
  })
})

describe('validateSoyuzRunId', () => {
  it('accepts UUIDv7 run IDs', () => {
    expect(validateSoyuzRunId('018f6f5e-9abc-7def-8abc-0123456789ab'))
      .toBe('018f6f5e-9abc-7def-8abc-0123456789ab')
  })

  it.each([
    '018f6f5e-9abc-4def-8abc-0123456789ab',
    'not-a-run-id',
    '../status',
    '',
  ])('rejects an invalid Soyuz run ID: %s', (runId) => {
    expect(() => validateSoyuzRunId(runId)).toThrow()
  })

  it('rejects missing values', () => {
    expect(() => validateSoyuzRunId(undefined)).toThrow()
  })
})
