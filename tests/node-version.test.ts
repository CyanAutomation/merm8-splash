import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { expect, it } from 'vitest'

const repoRoot = process.cwd()
const packageJson = JSON.parse(readFileSync(join(repoRoot, 'package.json'), 'utf8')) as {
  engines: { node: string }
}
const packageLock = JSON.parse(readFileSync(join(repoRoot, 'package-lock.json'), 'utf8')) as {
  packages: { '': { engines: { node: string } } }
}
const nvmrc = readFileSync(join(repoRoot, '.nvmrc'), 'utf8').trim()
const netlifyConfig = readFileSync(join(repoRoot, 'netlify.toml'), 'utf8')
const dockerfile = readFileSync(join(repoRoot, 'Dockerfile'), 'utf8')
const workflowToolsConfig = readFileSync(
  join(repoRoot, '.github', 'workflows', 'update-workflow-tools.yml'),
  'utf8',
)
const ciWorkflow = readFileSync(join(repoRoot, '.github', 'workflows', 'ci.yml'), 'utf8')
const readmeLinksWorkflow = readFileSync(
  join(repoRoot, '.github', 'workflows', 'readme-links.yml'),
  'utf8',
)
const readme = readFileSync(join(repoRoot, 'README.md'), 'utf8')

it('pins development, CI, deployment builds, and documentation to Node 26', () => {
  expect(packageJson.engines.node).toBe('26.x')
  expect(packageLock.packages[''].engines.node).toBe('26.x')
  expect(nvmrc).toBe('26')
  expect(netlifyConfig).toMatch(/^\s*NODE_VERSION\s*=\s*"26"\s*$/m)
  expect(dockerfile).toMatch(/^FROM node:26-alpine AS builder$/m)
  expect(workflowToolsConfig).toMatch(/^\s*node-version:\s*26\s*$/m)
  expect(ciWorkflow).toMatch(/^\s*node-version-file:\s*\.nvmrc\s*$/m)
  expect(readmeLinksWorkflow).toMatch(/^\s*node-version-file:\s*\.nvmrc\s*$/m)
  expect(readme).toContain('**Node.js** 26.x')
})
