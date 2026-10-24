import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, it } from 'vitest'

const repoRoot = process.cwd()
const workflowDirectory = join(repoRoot, '.github', 'workflows')
const dryWorkflow = readFileSync(join(workflowDirectory, 'kaseki-dry.yaml'), 'utf8')
const docsWorkflow = readFileSync(join(workflowDirectory, 'kaseki-docs.yaml'), 'utf8')
const kasekiWorkflow = readFileSync(join(workflowDirectory, 'kaseki-run.yml'), 'utf8')
const ciWorkflow = readFileSync(join(workflowDirectory, 'ci.yml'), 'utf8')
const readmeLinksWorkflow = readFileSync(join(workflowDirectory, 'readme-links.yml'), 'utf8')
const updaterWorkflow = readFileSync(join(workflowDirectory, 'update-workflow-tools.yml'), 'utf8')

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

function workflowStepBlock(source: string, name: string): string {
  return yamlBlock(source, `- name: ${name}`)
}

function workflowJobBlock(source: string, name: string): string {
  return yamlBlock(yamlBlock(source, 'jobs:'), `${name}:`)
}

function yamlScalar(source: string, key: string): string | undefined {
  const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const value = source.split(/\r?\n/)
    .map((line) => line.match(new RegExp(`^\\s*${escapedKey}:\\s*(.*?)\\s*$`))?.[1])
    .find((candidate) => candidate !== undefined)
  if (value === undefined) return undefined
  return value.replace(/\s+#.*$/, '').replace(/^(['"])(.*)\1$/, '$2')
}

function runScript(source: string, name: string): string {
  const lines = workflowStepBlock(source, name).split(/\r?\n/)
  const runIndex = lines.findIndex((line) => /^\s*run: \|$/.test(line))

  if (runIndex === -1) return ''

  const runIndentation = lines[runIndex].match(/^\s*/)?.[0].length ?? 0
  const script = [] as string[]

  for (const line of lines.slice(runIndex + 1)) {
    const indentation = line.match(/^\s*/)?.[0].length ?? 0
    if (line.trim() && indentation <= runIndentation) break
    script.push(line.trim() ? line.slice(runIndentation + 2) : '')
  }

  return script.join('\n')
}

function buildPayload(workflow: string, stepName: string) {
  const step = workflowStepBlock(workflow, stepName)
  const environment = yamlBlock(step, 'env:')
  const outputDirectory = mkdtempSync(join(tmpdir(), 'kaseki-payload-'))
  const outputFile = join(outputDirectory, 'github-output')

  try {
    const env = Object.fromEntries(
      ['REF', 'TASK_DESCRIPTION', 'ALLOWLIST', 'VALIDATION_COMMAND'].map((key) => {
        const value = yamlScalar(environment, key)
        if (value === undefined) throw new Error(`Expected ${key} to be configured for ${stepName}.`)
        return [key, value]
      }),
    )
    execFileSync('bash', ['-c', runScript(workflow, stepName)], {
      encoding: 'utf8',
      env: {
        ...process.env,
        ...env,
        REPO_URL: 'https://github.com/CyanAutomation/merm8-splash',
        GITHUB_OUTPUT: outputFile,
      },
    })

    const payloadJson = readFileSync(outputFile, 'utf8').match(/^payload=(.+)$/m)?.[1]
    if (!payloadJson) throw new Error(`Expected ${stepName} to write a payload.`)
    return JSON.parse(payloadJson) as Record<string, unknown>
  } finally {
    rmSync(outputDirectory, { recursive: true, force: true })
  }
}

it('keeps Kaseki preparation and secret-bearing execution on main', () => {
  for (const [workflow, runJobName] of [
    [dryWorkflow, 'dry_sweep'],
    [docsWorkflow, 'docs_sweep'],
  ] as const) {
    const prepareJob = workflowJobBlock(workflow, 'prepare')
    const runJob = workflowJobBlock(workflow, runJobName)

    expect(yamlScalar(prepareJob, 'if')).toBe("github.ref == 'refs/heads/main'")
    expect(yamlScalar(runJob, 'if')).toBeUndefined()
    expect(yamlScalar(runJob, 'uses')).toBe('./.github/workflows/kaseki-run.yml')
    expect(yamlScalar(runJob, 'needs')).toBe('prepare')
  }

  expect(yamlScalar(workflowJobBlock(kasekiWorkflow, 'run'), 'if'))
    .toBe("github.ref == 'refs/heads/main'")
})

it('uses one reusable workflow for Kaseki preflight, submission, and polling', () => {
  expect(yamlBlock(yamlBlock(kasekiWorkflow, 'on:'), 'workflow_call:')).not.toBe('')

  for (const [workflow, jobName] of [[dryWorkflow, 'dry_sweep'], [docsWorkflow, 'docs_sweep']]) {
    const callerJob = workflowJobBlock(workflow, jobName)
    expect(yamlScalar(callerJob, 'uses')).toBe('./.github/workflows/kaseki-run.yml')
    expect(yamlBlock(callerJob, 'steps:')).toBe('')
  }

  const steps = yamlBlock(workflowJobBlock(kasekiWorkflow, 'run'), 'steps:')
  const stepNames = [...steps.matchAll(/^\s*- name: (.+)$/gm)].map((match) => match[1].trim())
  expect(stepNames).toContain('Verify controller health')
  expect(stepNames).toContain('Verify controller readiness')
  expect(stepNames).toContain('Verify gateway connectivity and authentication')
  expect(stepNames).toContain('Submit Kaseki run')
  expect(stepNames).toContain('Wait for Kaseki completion')
})

it('uses a single authoritative readiness check before authentication and submission', () => {
  const healthStep = workflowStepBlock(kasekiWorkflow, 'Verify controller health')
  const readinessStep = workflowStepBlock(kasekiWorkflow, 'Verify controller readiness')
  const authenticationStep = workflowStepBlock(
    kasekiWorkflow,
    'Verify gateway connectivity and authentication',
  )
  const submitStep = workflowStepBlock(kasekiWorkflow, 'Submit Kaseki run')

  expect(healthStep).toContain(
    'uses: CyanAutomation/kaseki-agent/.github/actions/verify-controller-health@30db5d15e117b8d8de13eb66766d48cf6b7d618b',
  )
  expect(readinessStep).toContain("jq -e '.status == \"ready\"'")
  expect(authenticationStep).toContain("jq -e '.status == \"ok\"'")
  expect(kasekiWorkflow.match(/\/ready/g)).toHaveLength(1)
  expect(kasekiWorkflow.indexOf(healthStep)).toBeLessThan(kasekiWorkflow.indexOf(readinessStep))
  expect(kasekiWorkflow.indexOf(readinessStep)).toBeLessThan(
    kasekiWorkflow.indexOf(authenticationStep),
  )
  expect(kasekiWorkflow.indexOf(authenticationStep)).toBeLessThan(
    kasekiWorkflow.indexOf(submitStep),
  )
})

it('keeps the Kaseki token in authenticated request steps only', () => {
  const stepNames = [
    'Verify gateway connectivity and authentication',
    'Submit Kaseki run',
    'Wait for Kaseki completion',
  ]

  for (const stepName of stepNames) {
    expect(workflowStepBlock(kasekiWorkflow, stepName)).toContain(
      'KASEKI_API_TOKEN: ${{ secrets.KASEKI_API_TOKEN }}',
    )
  }

  expect([...kasekiWorkflow.matchAll(/KASEKI_API_TOKEN: \$\{\{ secrets\.KASEKI_API_TOKEN \}\}/g)])
    .toHaveLength(3)
  expect(kasekiWorkflow).not.toContain('secrets: inherit')

  for (const workflow of [dryWorkflow, docsWorkflow]) {
    expect(workflow).not.toContain('KASEKI_API_TOKEN')
    expect(yamlBlock(workflow, 'permissions:').trim()).toBe('permissions: {}')
  }
  expect(yamlBlock(kasekiWorkflow, 'permissions:').trim()).toBe('permissions: {}')
})

it('protects the shared Kaseki job with its environment and a bounded timeout', () => {
  const job = yamlBlock(kasekiWorkflow, 'run:')

  expect(job).toContain('environment: kaseki-agent')
  expect(job).toContain('timeout-minutes: 200')
  expect(job).toContain('KASEKI_BASE_URL: ${{ vars.KASEKI_BASE_URL }}')
})

it('allows only the approved Kaseki controller URL', () => {
  const validationScript = runScript(
    kasekiWorkflow,
    'Validate Kaseki configuration and required tools',
  )
  const urlValidationScript = validationScript.split('command -v jq')[0]

  expect(urlValidationScript).toContain(
    '[[ "$KASEKI_BASE_URL" == "https://kaseki-tunnel.scheimann.xyz" ]]',
  )

  const runUrlValidation = (baseUrl: string) => execFileSync(
    'bash',
    ['-c', urlValidationScript],
    {
      encoding: 'utf8',
      env: { ...process.env, KASEKI_BASE_URL: baseUrl },
    },
  )

  expect(() => runUrlValidation('https://kaseki-tunnel.scheimann.xyz')).not.toThrow()
  expect(() => runUrlValidation('https://attacker.example')).toThrow()
})

it('derives a stable UUIDv5 idempotency key from each workflow run', () => {
  const script = runScript(kasekiWorkflow, 'Submit Kaseki run').match(
    /idempotency_key="\$\(\s*node <<'NODE'\r?\n([\s\S]*?)\r?\n\s*NODE\r?\n\s*\)"/,
  )?.[1]

  expect(script).toBeDefined()

  function keyForRun(workflow: string, runId: string): string {
    return execFileSync(process.execPath, ['-e', script!], {
      encoding: 'utf8',
      env: {
        ...process.env,
        GITHUB_REPOSITORY: 'CyanAutomation/merm8-splash',
        GITHUB_WORKFLOW: workflow,
        GITHUB_RUN_ID: runId,
      },
    }).trim()
  }

  const first = keyForRun('Kaseki Docs Sweep', '12345')
  expect(first).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
  expect(keyForRun('Kaseki Docs Sweep', '12345')).toBe(first)
  expect(keyForRun('Kaseki Docs Sweep', '12346')).not.toBe(first)
  expect(keyForRun('Kaseki DRY Sweep', '12345')).not.toBe(first)
})

it('bounds run polling and validates controller run IDs before polling', () => {
  const submitScript = runScript(kasekiWorkflow, 'Submit Kaseki run')
  const waitScript = runScript(kasekiWorkflow, 'Wait for Kaseki completion')

  expect(submitScript).toContain('^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$')
  expect(waitScript).toContain('poll_deadline=$((SECONDS + 11100))')
  expect(waitScript).toContain('timeout --foreground')
  expect(waitScript).toContain('Kaseki status: failed')
  expect(waitScript).toContain('echo "status=$status" >> "$GITHUB_OUTPUT"')
})

it('builds distinct task payloads from each workflow’s configured file scope and validation command', () => {
  const dryPayload = buildPayload(dryWorkflow, 'Build DRY sweep payload')
  const docsPayload = buildPayload(docsWorkflow, 'Build documentation sweep payload')

  expect(dryPayload).toMatchObject({
    repoUrl: 'https://github.com/CyanAutomation/merm8-splash',
    ref: 'main',
    taskMode: 'patch',
    publishMode: 'pr',
    timeoutSeconds: 10800,
    maxDiffBytes: 102400,
    changedFilesAllowlist: ['app/**/*', 'lib/**/*', 'tests/**/*', 'types/**/*'],
    validationCommands: ['npm run lint && npm test && npm run build'],
    goalCheck: { enabled: true, maxRetries: 1 },
  })
  expect(docsPayload).toMatchObject({
    repoUrl: 'https://github.com/CyanAutomation/merm8-splash',
    ref: 'main',
    taskMode: 'patch',
    publishMode: 'pr',
    timeoutSeconds: 10800,
    maxDiffBytes: 102400,
    changedFilesAllowlist: ['README.md', 'docs/**/*.md'],
    validationCommands: [
      'npm run check:readme && npm run lint && npm test && npm run build',
    ],
    scouting: { enabled: false },
    goalSetting: { enabled: false },
    goalCheck: { enabled: false },
  })
})

it('keeps the Kaseki payload and shared request scripts valid Bash', () => {
  const scripts = [
    runScript(dryWorkflow, 'Build DRY sweep payload'),
    runScript(docsWorkflow, 'Build documentation sweep payload'),
    runScript(kasekiWorkflow, 'Validate Kaseki configuration and required tools'),
    runScript(kasekiWorkflow, 'Verify controller readiness'),
    runScript(kasekiWorkflow, 'Verify gateway connectivity and authentication'),
    runScript(kasekiWorkflow, 'Submit Kaseki run'),
    runScript(kasekiWorkflow, 'Wait for Kaseki completion'),
  ]

  for (const script of scripts) {
    expect(script).not.toBe('')
    expect(() => execFileSync('bash', ['-n'], { input: script })).not.toThrow()
  }
})

it('serializes each Kaseki workflow independently', () => {
  const expectedGroup = 'group: kaseki-${{ github.workflow }}-${{ github.repository }}'

  for (const workflow of [dryWorkflow, docsWorkflow]) {
    const concurrency = yamlBlock(workflow, 'concurrency:')
    expect(concurrency).toContain(expectedGroup)
    expect(concurrency).toContain('cancel-in-progress: false')
  }
})

it('automates analyzer version and checksum updates behind a validated pull request', () => {
  expect(updaterWorkflow).toContain("cron: '0 7 1 * *'")
  expect(updaterWorkflow).toContain('workflow_dispatch:')
  expect(updaterWorkflow).toContain('node scripts/update-workflow-tool-pins.mjs')
  expect(updaterWorkflow).toContain('peter-evans/create-pull-request@5f6978faf089d4d20b00c7766989d076bb2fc7f1')
  expect(updaterWorkflow).toContain('contents: write')
  expect(updaterWorkflow).toContain('pull-requests: write')

  const validationJob = yamlBlock(updaterWorkflow, 'prepare:')
  expect(validationJob).toContain('contents: read')
  expect(validationJob).toContain('persist-credentials: false')
  expect(validationJob).not.toContain('contents: write')
  expect(validationJob).not.toContain('pull-requests: write')
  expect(validationJob).toContain('Update and validate analyzer pins')
  expect(validationJob).toContain('GITHUB_TOKEN: ${{ github.token }}')

  const pullRequestJob = yamlBlock(updaterWorkflow, 'open-pull-request:')
  expect(pullRequestJob).toContain("if: needs.prepare.outputs.changed == 'true'")
})

it('keeps analyzer versions and checksums together in CI download commands', () => {
  expect(ciWorkflow).toContain("actionlint_version='1.7.12'")
  expect(ciWorkflow).toContain('actionlint_sha256=')
  expect(ciWorkflow).toContain('v${actionlint_version}/actionlint_${actionlint_version}_linux_amd64.tar.gz')
  expect(ciWorkflow).toContain("zizmor_version='1.30.1'")
  expect(ciWorkflow).toContain('zizmor_sha256=')
  expect(ciWorkflow).toContain('v${zizmor_version}/zizmor-x86_64-unknown-linux-gnu.tar.gz')
})

it('runs external README link checks on a schedule with read-only permissions', () => {
  expect(readmeLinksWorkflow).toContain("cron: '0 6 * * 1'")
  expect(readmeLinksWorkflow).toContain('workflow_dispatch:')
  expect(readmeLinksWorkflow).toContain('permissions:\n  contents: read')
  expect(readmeLinksWorkflow).toContain('timeout-minutes: 10')
  expect(readmeLinksWorkflow).toContain('run: npm run check:readme:links')
})

it('does not persist the checkout token into pull-request build commands', () => {
  const checkoutStep = yamlBlock(ciWorkflow, '- uses: actions/checkout@')
  expect(checkoutStep).toContain('persist-credentials: false')
})
