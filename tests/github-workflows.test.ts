import { existsSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { expect, it } from 'vitest'

const repoRoot = process.cwd()
const workflowDirectory = join(repoRoot, '.github', 'workflows')
const dryWorkflow = readFileSync(join(workflowDirectory, 'kaseki-dry.yaml'), 'utf8')
const ciWorkflow = readFileSync(join(workflowDirectory, 'ci.yml'), 'utf8')
const packageJson = JSON.parse(readFileSync(join(repoRoot, 'package.json'), 'utf8')) as {
  scripts: Record<string, string>
}

function yamlBlock(source: string, header: string): string {
  const lines = source.split(/\r?\n/)
  const startIndex = lines.findIndex((line) => {
    const trimmedLine = line.trim()
    return trimmedLine === header || trimmedLine.startsWith(header)
  })

  if (startIndex === -1) return ''

  const indentation = lines[startIndex].match(/^\s*/)?.[0].length ?? 0
  const block = [lines[startIndex]]

  for (const line of lines.slice(startIndex + 1)) {
    if (!line.trim()) {
      block.push(line)
      continue
    }

    const lineIndentation = line.match(/^\s*/)?.[0].length ?? 0
    if (lineIndentation <= indentation) break
    block.push(line)
  }

  return block.join('\n')
}

function stepBlock(name: string): string {
  return yamlBlock(dryWorkflow, `- name: ${name}`)
}

it('limits the secret-bearing Kaseki DRY job to the default branch', () => {
  const job = yamlBlock(dryWorkflow, 'dry_sweep:')
  const jobConfiguration = job.split(/^ {4}steps:/m)[0]

  expect(jobConfiguration).toContain(
    "if: github.ref == format('refs/heads/{0}', github.event.repository.default_branch)",
  )
})

it('pins the Kaseki DRY controller URL to the approved host', () => {
  const configurationStep = stepBlock('Validate Kaseki configuration')

  expect(configurationStep).toContain(
    'KASEKI_BASE_URL" != "https://kaseki-tunnel.scheimann.xyz"',
  )
})

it('makes the Kaseki token available only to authenticated request steps', () => {
  const job = yamlBlock(dryWorkflow, 'dry_sweep:')
  const jobConfiguration = job.split(/^ {4}steps:/m)[0]

  expect(jobConfiguration).not.toContain('KASEKI_API_TOKEN:')

  for (const stepName of [
    'Verify gateway connectivity and authentication',
    'Submit DRY sweep',
    'Wait for Kaseki completion',
  ]) {
    expect(stepBlock(stepName)).toContain(
      'KASEKI_API_TOKEN: ${{ secrets.KASEKI_API_TOKEN }}',
    )
  }

  expect([...dryWorkflow.matchAll(/KASEKI_API_TOKEN: \$\{\{ secrets\.KASEKI_API_TOKEN \}\}/g)]).toHaveLength(3)
  expect(stepBlock('Publish run details')).not.toContain('KASEKI_API_TOKEN')
})

it('limits the DRY sweep to existing source paths and defined npm scripts', () => {
  const allowlist = dryWorkflow.match(/^\s+ALLOWLIST:\s*(.+)$/m)?.[1]
  const validationCommand = dryWorkflow.match(/^\s+VALIDATION_COMMAND:\s*(.+)$/m)?.[1]

  expect(allowlist).toBeDefined()
  expect(validationCommand).toBe('npm run lint && npm test && npm run build')

  const allowedPaths = allowlist!.split(',').map((path) => path.trim())
  expect(allowedPaths).toEqual(expect.arrayContaining([
    'app/**/*',
    'lib/**/*',
    'tests/**/*',
    'types/**/*',
  ]))

  for (const path of allowedPaths) {
    expect(existsSync(resolve(repoRoot, path.split('/')[0]))).toBe(true)
  }

  const scriptNames = [...validationCommand!.matchAll(/\bnpm (?:run )?([\w:-]+)/g)]
    .map((match) => match[1])

  for (const scriptName of scriptNames) {
    expect(packageJson.scripts[scriptName]).toBeDefined()
  }
})

it('does not persist the checkout token into pull-request build commands', () => {
  const checkoutStep = yamlBlock(ciWorkflow, '- uses: actions/checkout@')

  expect(checkoutStep).toContain('persist-credentials: false')
})
