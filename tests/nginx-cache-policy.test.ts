import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { expect, it } from 'vitest'

const nginxConfig = readFileSync(join(process.cwd(), 'nginx.conf'), 'utf8')

function parseContentSecurityPolicy(policy: string): Record<string, string[]> {
  const directives: Record<string, string[]> = {}

  for (const section of policy.split(';').filter((part) => part.trim())) {
    const [name, ...sources] = section.trim().split(/\s+/)
    if (!name || sources.length === 0 || name in directives) {
      throw new Error(`Invalid or duplicate Content-Security-Policy directive: ${section}`)
    }
    directives[name] = sources
  }

  return directives
}

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

it('preserves the required container Content-Security-Policy directives', () => {
  const contentSecurityPolicyMatch = nginxConfig.match(
    /add_header Content-Security-Policy "([^"]+)" always;/,
  )

  if (!contentSecurityPolicyMatch) {
    throw new Error('Expected an always-on Content-Security-Policy header in nginx.conf.')
  }

  const directives = parseContentSecurityPolicy(contentSecurityPolicyMatch[1])
  expect(directives['default-src']).toEqual(["'self'"])
  expect(directives['script-src']).toEqual(["'self'", "'unsafe-inline'", "'unsafe-eval'"])
  expect(directives['style-src']).toEqual(["'self'", "'unsafe-inline'"])
  expect(directives['img-src']).toEqual(["'self'"])
  expect(directives['connect-src']).toEqual(["'self'"])
})
