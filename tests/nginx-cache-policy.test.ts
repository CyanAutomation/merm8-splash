import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { expect, it } from 'vitest'
import { parseContentSecurityPolicy } from './helpers/contentSecurityPolicy'

const nginxConfig = readFileSync(join(process.cwd(), 'nginx.conf'), 'utf8')

function extractBlock(source: string, header: string): string {
  const headerIndex = source.indexOf(header)
  if (headerIndex < 0) return ''

  const openBrace = source.indexOf('{', headerIndex)
  if (openBrace < 0) return ''

  let depth = 0
  for (let index = openBrace; index < source.length; index += 1) {
    if (source[index] === '{') depth += 1
    if (source[index] === '}') depth -= 1
    if (depth === 0) return source.slice(headerIndex, index + 1)
  }

  return ''
}

function parseCacheControlMap(): Record<string, string> {
  const block = extractBlock(nginxConfig, 'map $uri $cache_control')
  if (!block) throw new Error('Expected a cache-control map in nginx.conf.')

  const entries: Record<string, string> = {}
  const lines = block.slice(block.indexOf('{') + 1, -1).split(/\r?\n/)
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue

    const entry = trimmed.match(/^(\S+)\s+"([^"]+)";$/)
    if (!entry) throw new Error(`Invalid cache-control map entry: ${trimmed}`)
    entries[entry[1]] = entry[2]
  }

  return entries
}

it('caches fingerprinted Next.js static files as immutable', () => {
  const cachePolicy = parseCacheControlMap()
  const staticLocation = extractBlock(nginxConfig, 'location ^~ /_next/static/')

  expect(cachePolicy['~^/_next/static/']).toBe('public, max-age=31536000, immutable')
  expect(staticLocation.split(/\r?\n/).map((line) => line.trim()))
    .toContain('try_files $uri =404;')
})

it('requires HTML and SPA fallback responses to be revalidated', () => {
  const cachePolicy = parseCacheControlMap()
  const rootLocation = extractBlock(nginxConfig, 'location / {')

  expect(cachePolicy['~*\\.html$']).toBe('no-cache')
  expect(rootLocation.split(/\r?\n/).map((line) => line.trim()))
    .toContain('try_files $uri $uri/ /index.html;')
})

it('preserves the required container Content-Security-Policy directives', () => {
  const contentSecurityPolicyMatch = nginxConfig.match(
    /add_header Content-Security-Policy "([^"]+)" always;/,
  )

  if (!contentSecurityPolicyMatch) {
    throw new Error('Expected an always-on Content-Security-Policy header in nginx.conf.')
  }

  const directives = parseContentSecurityPolicy(contentSecurityPolicyMatch[1])
  expect(directives).toMatchObject({
    'default-src': ["'self'"],
    'script-src': ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
    'style-src': ["'self'", "'unsafe-inline'"],
    'img-src': ["'self'"],
    'connect-src': ["'self'"],
  })
})
