import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { expect, it } from 'vitest'

const dockerignorePath = join(process.cwd(), '.dockerignore')
const dockerfile = readFileSync(join(process.cwd(), 'Dockerfile'), 'utf8')

it('excludes local build artifacts and environment files from Docker context', () => {
  expect(existsSync(dockerignorePath)).toBe(true)

  const rules = readFileSync(dockerignorePath, 'utf8').split(/\r?\n/).map((rule) => rule.trim())

  for (const pattern of ['node_modules', '.git', '.next', 'out', 'coverage', '.vercel', '.env*']) {
    expect(rules).toContain(pattern)
  }

  expect(rules).toContain('!.env.example')
})

it('makes the Nginx config readable by the non-root runtime user', () => {
  expect(dockerfile).toMatch(/^COPY --chmod=644 nginx\.conf \/etc\/nginx\/conf\.d\/default\.conf$/m)
})

it('gives the non-root Nginx process a writable PID directory', () => {
  expect(dockerfile).toMatch(
    /^RUN chown -R appuser:appgroup \/usr\/share\/nginx\/html \/var\/cache\/nginx \/run \/var\/run \/var\/log\/nginx$/m,
  )
})
