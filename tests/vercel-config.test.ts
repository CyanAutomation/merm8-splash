import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { expect, it, vi } from 'vitest'
import { resolveApiEndpointInfo } from '../lib/api'

const repoRoot = process.cwd()
const vercelConfig = JSON.parse(readFileSync(join(repoRoot, 'vercel.json'), 'utf8')) as {
  buildCommand: string
  env?: Record<string, string>
  headers: Array<{
    source: string
    headers: Array<{ key: string; value: string }>
  }>
}
const packageJson = JSON.parse(readFileSync(join(repoRoot, 'package.json'), 'utf8')) as {
  scripts: Record<string, string>
}
const readme = readFileSync(join(repoRoot, 'README.md'), 'utf8')
const envExample = readFileSync(join(repoRoot, '.env.example'), 'utf8').trim()
const exampleApiEndpoint = envExample.match(/^NEXT_PUBLIC_MERM8_API_URL=(.+)$/m)?.[1]

it('runs lint, tests, and the production build as part of every Vercel build', () => {
  expect(vercelConfig.buildCommand).toBe('npm run build:vercel')
  expect(packageJson.scripts['build:vercel']).toBe(
    'npm run lint && NODE_ENV=test npm test && npm run build',
  )
})

it('does not configure browser build variables as Vercel function environment variables', () => {
  expect(vercelConfig.env).toBeUndefined()
})

it('keeps the example API endpoint aligned with the app default', () => {
  vi.stubEnv('NEXT_PUBLIC_MERM8_API_URL', '')
  vi.stubGlobal('window', undefined)
  vi.stubGlobal('localStorage', undefined)

  try {
    expect(exampleApiEndpoint).toBe(resolveApiEndpointInfo().endpoint)
  } finally {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  }
})

it('sets a Vercel CSP that supports the configurable HTTPS API endpoint', () => {
  const csp = vercelConfig.headers
    .flatMap((rule) => rule.headers)
    .find((header) => header.key.toLowerCase() === 'content-security-policy')?.value

  expect(csp).toContain("default-src 'self'")
  expect(csp).toContain("object-src 'none'")
  expect(csp).toContain("connect-src 'self' https:")
  expect(csp).toContain("frame-ancestors 'none'")
})

it('documents production API configuration and optional Preview CORS setup', () => {
  expect(readme).toMatch(/NEXT_PUBLIC_MERM8_API_URL/)
  expect(readme).toMatch(/Production/i)
  expect(readme).toMatch(/Preview/i)
  expect(readme).toMatch(/https:\/\/merm8-splash\.vercel\.app/)
  expect(readme).toMatch(/CORS allowlist/i)
})
