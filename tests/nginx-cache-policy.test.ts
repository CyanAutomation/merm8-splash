import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { expect, it } from 'vitest'

const nginxConfig = readFileSync(join(process.cwd(), 'nginx.conf'), 'utf8')

it('caches fingerprinted Next.js static files as immutable', () => {
  expect(nginxConfig).toMatch(
    /~\^\/_next\/static\/\s+"public, max-age=31536000, immutable";/,
  )
  expect(nginxConfig).toMatch(
    /location \^~ \/_next\/static\/\s*{[\s\S]*?try_files \$uri =404;[\s\S]*?}/,
  )
})

it('requires HTML and SPA fallback responses to be revalidated', () => {
  expect(nginxConfig).toMatch(/~\*\\\.html\$\s+"no-cache";/)
  expect(nginxConfig).toMatch(
    /location \/\s*{[\s\S]*?try_files \$uri \$uri\/ \/index\.html;[\s\S]*?}/,
  )
})

it('separates every Content-Security-Policy directive with a semicolon', () => {
  const contentSecurityPolicyMatch = nginxConfig.match(
    /add_header Content-Security-Policy "([^"]+)" always;/,
  )

  expect(contentSecurityPolicyMatch).toBeDefined()
  expect(contentSecurityPolicyMatch?.[1]).toBe(
    "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self'; connect-src 'self';",
  )
})
