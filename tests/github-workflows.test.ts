import { existsSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { expect, it } from 'vitest'

const repoRoot = process.cwd()
const workflowDirectory = join(repoRoot, '.github', 'workflows')
const dryWorkflow = readFileSync(join(workflowDirectory, 'kaseki-dry.yaml'), 'utf8')
const docsWorkflow = readFileSync(join(workflowDirectory, 'kaseki-docs.yaml'), 'utf8')
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
  return workflowStepBlock(dryWorkflow, name)
}

function workflowStepBlock(source: string, name: string): string {
  return yamlBlock(source, `- name: ${name}`)
}

function docsJobBlock(name: string): string {
  return yamlBlock(docsWorkflow, `${name}:`)
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

it('fails the dependency check based on npm ls exit status instead of output text', () => {
  const dependencyCheck = yamlBlock(ciWorkflow, '- name: Check for peer dependency conflicts')

  expect(dependencyCheck.match(/\bnpm ls\b/g)).toHaveLength(1)
  expect(dependencyCheck).toContain('if ! npm ls; then')
  expect(dependencyCheck).not.toContain('grep -E')
})

it('keeps Kaseki docs API retries within the job timeout budget', () => {
  const apiConnection = docsJobBlock('api_connection')
  const timeoutMinutes = apiConnection.match(/^\s+timeout-minutes:\s*(\d+)$/m)?.[1]

  expect(Number(timeoutMinutes)).toBeGreaterThanOrEqual(5)
})

it('checks DRY runner tools before contacting Kaseki and creates the output delimiter before submission', () => {
  const requiredTools = stepBlock('Check required tools')
  const submitStep = stepBlock('Submit DRY sweep')

  expect(requiredTools).toContain('command -v jq >/dev/null')
  expect(requiredTools).toContain('command -v uuidgen >/dev/null')
  expect(requiredTools).toContain('command -v curl >/dev/null')
  expect(dryWorkflow.indexOf(requiredTools)).toBeLessThan(
    dryWorkflow.indexOf(stepBlock('Verify controller health')),
  )

  const delimiterPosition = submitStep.indexOf('output_delimiter="$(uuidgen)"')
  const postPosition = submitStep.indexOf('--request POST')
  expect(delimiterPosition).toBeGreaterThanOrEqual(0)
  expect(delimiterPosition).toBeLessThan(postPosition)
})

it('serializes Kaseki workflows for the same repository', () => {
  const dryConcurrency = yamlBlock(dryWorkflow, 'concurrency:')
  const docsConcurrency = yamlBlock(docsWorkflow, 'concurrency:')
  const expectedGroup = 'group: kaseki-${{ github.repository }}'

  expect(dryConcurrency).toContain(expectedGroup)
  expect(docsConcurrency).toContain(expectedGroup)
  expect(dryConcurrency).toContain('cancel-in-progress: false')
  expect(docsConcurrency).toContain('cancel-in-progress: false')
})

it('requests full pull requests with a bounded diff for both Kaseki sweeps', () => {
  for (const workflow of [dryWorkflow, docsWorkflow]) {
    expect(workflow).toContain('publishMode: "pr"')
    expect(workflow).not.toContain('publishMode: "draft_pr"')
    expect(workflow).toContain('maxDiffBytes: 102400')
    expect(workflow).toContain('full PR (not draft)')
  }
})

it('does not grant the Kaseki workflows an unused GitHub token scope', () => {
  for (const workflow of [dryWorkflow, docsWorkflow]) {
    expect(yamlBlock(workflow, 'permissions:').trim()).toBe('permissions: {}')
  }
})

it('fails clearly when a Kaseki DRY authenticated step has no API token', () => {
  for (const stepName of [
    'Verify gateway connectivity and authentication',
    'Submit DRY sweep',
    'Wait for Kaseki completion',
  ]) {
    expect(stepBlock(stepName)).toContain(': "${KASEKI_API_TOKEN:?')
  }
})

it('bounds Kaseki completion polling by elapsed time in both workflows', () => {
  const dryWait = stepBlock('Wait for Kaseki completion')
  const docsWait = workflowStepBlock(docsWorkflow, 'Wait for Kaseki completion')

  for (const waitStep of [dryWait, docsWait]) {
    expect(waitStep).toContain('poll_deadline=$((SECONDS + 11100))')
    expect(waitStep).toContain('timeout --foreground')
    expect(waitStep).not.toContain('seq 1 185')
    expect(waitStep).toContain(': "${KASEKI_API_TOKEN:?')
  }
})

it('waits for the Kaseki Docs run to finish before reporting workflow success', () => {
  const dispatchJob = docsJobBlock('dispatch')
  const submissionSummary = workflowStepBlock(docsWorkflow, 'Publish submission details')
  const waitStep = workflowStepBlock(docsWorkflow, 'Wait for Kaseki completion')
  const resultSummary = workflowStepBlock(docsWorkflow, 'Publish run details')

  expect(dispatchJob).toContain('timeout-minutes: 200')
  expect(dispatchJob.indexOf(submissionSummary)).toBeLessThan(dispatchJob.indexOf(waitStep))
  expect(waitStep).toContain('echo "status=$status" >> "$GITHUB_OUTPUT"')
  expect(waitStep).toContain('Kaseki status: failed')
  expect(resultSummary).toContain('FINAL_STATUS: ${{ steps.wait.outputs.status || \'not completed\' }}')
})
