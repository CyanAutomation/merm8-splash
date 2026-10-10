import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { expect, it, vi } from 'vitest'
import { resolveApiEndpointInfo } from '../lib/api'
import nextConfig from '../next.config'
import { parseContentSecurityPolicy } from './helpers/contentSecurityPolicy'

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
const vercelDocumentation = readme.split('### Vercel\n')[1]?.split('\n### ')[0] ?? ''

it('runs lint, tests, and the production build as part of every Vercel build', () => {
  expect(vercelConfig.buildCommand).toBe('npm run build:vercel')
  expect(packageJson.scripts['build:vercel']).toBe(
    'npm run lint && NODE_ENV=test npm test && npm run build',
  )
})

it('uses a static Next.js export without Vercel function runtime variables', () => {
  expect(nextConfig.output).toBe('export')
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

it('resolves the public API endpoint from the build environment', () => {
  vi.stubEnv('NEXT_PUBLIC_MERM8_API_URL', 'https://build.example.test')
  vi.stubGlobal('window', undefined)
  vi.stubGlobal('localStorage', undefined)

  try {
    expect(resolveApiEndpointInfo()).toMatchObject({
      endpoint: 'https://build.example.test',
      source: 'environment',
    })
  } finally {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  }
})

it('sets a Vercel CSP that supports the configurable HTTPS API endpoint', () => {
  const csp = vercelConfig.headers
    .flatMap((rule) => rule.headers)
    .find((header) => header.key.toLowerCase() === 'content-security-policy')?.value

  if (!csp) throw new Error('Expected Vercel to configure a Content-Security-Policy header.')

  const directives = parseContentSecurityPolicy(csp)
  expect(directives['default-src']).toEqual(["'self'"])
  expect(directives['object-src']).toEqual(["'none'"])
  expect(directives['connect-src']).toEqual(["'self'", 'https:'])
  expect(directives['frame-ancestors']).toEqual(["'none'"])
})

it('documents production API configuration and optional Preview CORS setup', () => {
  const documentation = vercelDocumentation.replace(/\s+/g, ' ')

  expect(documentation).toContain(
    'set `NEXT_PUBLIC_MERM8_API_URL` for Production to `https://merm8.scheimann.workers.dev`',
  )
  expect(documentation).toContain(
    'This frontend is a static export, so Next.js embeds this public value in the files during each build; redeploy after changing it.',
  )
  expect(documentation).toContain(
    'Make sure the API\'s CORS allowlist includes the production origin `https://merm8-splash.vercel.app`.',
  )
  expect(documentation).toContain('add their exact origins to the allowlist as needed.')
  expect(documentation).toContain('Avoid allowing every `*.vercel.app` origin.')
})
