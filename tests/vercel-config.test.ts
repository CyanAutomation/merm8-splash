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
const netlifyConfig = readFileSync(join(repoRoot, 'netlify.toml'), 'utf8')
const nginxConfig = readFileSync(join(repoRoot, 'nginx.conf'), 'utf8')
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
  expect(directives['script-src']).toEqual(["'self'", "'unsafe-inline'"])
})

it('sets explicit cache lifetimes for static assets and HTML on Vercel and Netlify', () => {
  const vercelCacheHeaders = vercelConfig.headers.map((rule) => ({
    source: rule.source,
    cacheControl: rule.headers.find((header) => header.key.toLowerCase() === 'cache-control')?.value,
  }))

  expect(vercelCacheHeaders).toContainEqual({
    source: '/(.*)',
    cacheControl: 'no-cache',
  })
  expect(vercelCacheHeaders).toContainEqual({
    source: '/favicon.svg',
    cacheControl: 'public, max-age=300, must-revalidate',
  })
  expect(vercelCacheHeaders).toContainEqual({
    source: '/_next/static/(.*)',
    cacheControl: 'public, max-age=31536000, immutable',
  })
  expect(vercelCacheHeaders).toContainEqual({ source: '/', cacheControl: 'no-cache' })
  expect(vercelCacheHeaders).toContainEqual({
    source: '/(.*).html',
    cacheControl: 'no-cache',
  })
  expect(netlifyConfig).toMatch(/for\s*=\s*"\/_next\/static\/\*"[\s\S]*?Cache-Control\s*=\s*"public, max-age=31536000, immutable"/)
  expect(netlifyConfig).toMatch(/for\s*=\s*"\/\*"[\s\S]*?Cache-Control\s*=\s*"no-cache"/)
  expect(netlifyConfig).toMatch(/for\s*=\s*"\/favicon\.svg"[\s\S]*?Cache-Control\s*=\s*"public, max-age=300, must-revalidate"/)
  expect(netlifyConfig).toMatch(/for\s*=\s*"\/\*\.html"[\s\S]*?Cache-Control\s*=\s*"no-cache"/)
  expect(netlifyConfig).toMatch(/for\s*=\s*"\/"[\s\S]*?Cache-Control\s*=\s*"no-cache"/)
})

it('applies a consistent CSP to Netlify and Docker deployments', () => {
  const netlifyCsp = netlifyConfig.match(/^\s*Content-Security-Policy\s*=\s*"([^"]+)"$/m)?.[1]
  const nginxCsp = nginxConfig.match(/add_header Content-Security-Policy "([^"]+)" always;/)?.[1]
  const vercelCsp = vercelConfig.headers
    .flatMap((rule) => rule.headers)
    .find((header) => header.key.toLowerCase() === 'content-security-policy')?.value

  expect(netlifyCsp).toBeTruthy()
  expect(nginxCsp).toBeTruthy()
  expect(vercelCsp).toBeTruthy()

  for (const policy of [netlifyCsp!, nginxCsp!, vercelCsp!]) {
    const directives = parseContentSecurityPolicy(policy)
    expect(directives['default-src']).toEqual(["'self'"])
    expect(directives['base-uri']).toEqual(["'self'"])
    expect(directives['object-src']).toEqual(["'none'"])
    expect(directives['frame-ancestors']).toEqual(["'none'"])
    expect(directives['form-action']).toEqual(["'self'"])
    expect(directives['connect-src']).toEqual(["'self'", 'https:'])
    expect(directives['script-src']).toEqual(["'self'", "'unsafe-inline'"])
  }
})

it('documents production API configuration and optional Preview CORS setup', () => {
  const documentation = vercelDocumentation.replace(/\s+/g, ' ')

  expect(documentation).toContain('NEXT_PUBLIC_MERM8_API_URL')
  expect(documentation).toContain('https://merm8.scheimann.workers.dev')
  expect(documentation).toMatch(/static export/i)
  expect(documentation).toMatch(/redeploy after changing/i)
  expect(documentation).toMatch(/CORS allowlist/i)
  expect(documentation).toContain('https://merm8-splash.vercel.app')
  expect(documentation).toMatch(/exact origins/i)
  expect(documentation).toMatch(/avoid allowing every `\*\.vercel\.app` origin/i)
})
