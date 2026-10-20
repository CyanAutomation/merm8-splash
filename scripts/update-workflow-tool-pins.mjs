import { createHash } from 'node:crypto'
import {
  appendFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(scriptDirectory, '..')
const workflowPath = path.join(repoRoot, '.github', 'workflows', 'ci.yml')

export const toolDefinitions = [
  {
    name: 'actionlint',
    repository: 'rhysd/actionlint',
    executable: 'actionlint',
    assetName: (version) => `actionlint_${version}_linux_amd64.tar.gz`,
    validateArgs: ({ workflowPaths }) => workflowPaths,
  },
  {
    name: 'zizmor',
    repository: 'zizmorcore/zizmor',
    executable: 'zizmor',
    assetName: () => 'zizmor-x86_64-unknown-linux-gnu.tar.gz',
    validateArgs: ({ workflowDirectory }) => ['--offline', workflowDirectory],
  },
]

/**
 * @param {{ name: string, validateArgs?: (context: { workflowPaths: string[], workflowDirectory: string }) => string[] }} tool
 * @param {string[]} workflowPaths
 * @param {string} workflowDirectory
 * @returns {string[]}
 */
export function getValidationArguments(tool, workflowPaths, workflowDirectory) {
  if (typeof tool.validateArgs !== 'function') {
    throw new Error(`${tool.name} must define validateArgs`)
  }

  const args = tool.validateArgs({ workflowPaths, workflowDirectory })
  if (!Array.isArray(args) || args.some((argument) => typeof argument !== 'string')) {
    throw new Error(`${tool.name} validateArgs must return an array of strings`)
  }

  return args
}

/**
 * Update analyzer release versions and SHA-256 digests in the workflow.
 * @param {string} workflow
 * @param {{ actionlint: { version: string, sha256: string }, zizmor: { version: string, sha256: string } }} releases
 * @returns {string}
 */
export function updateWorkflowToolPins(workflow, releases) {
  let updated = workflow

  for (const toolName of ['actionlint', 'zizmor']) {
    const release = releases[toolName]
    if (
      !release ||
      !/^\d+\.\d+\.\d+$/.test(release.version) ||
      !/^[a-f0-9]{64}$/.test(release.sha256)
    ) {
      throw new Error(`Invalid ${toolName} release version or SHA-256 digest`)
    }

    for (const [kind, value, pattern] of [
      ['version', release.version, new RegExp(`^([\\t ]*${toolName}_version=')[^']+('\\s*)$`, 'gm')],
      ['sha256', release.sha256, new RegExp(`^([\\t ]*${toolName}_sha256=')[^']+('\\s*)$`, 'gm')],
    ]) {
      const matches = [...updated.matchAll(pattern)]
      if (matches.length !== 1) {
        throw new Error(`Expected exactly one ${toolName}_${kind} pin, found ${matches.length}`)
      }

      updated = updated.replace(pattern, (_match, prefix, suffix) => `${prefix}${value}${suffix}`)
    }
  }

  return updated
}

async function fetchLatestToolRelease(tool) {
  const apiHeaders = {
    accept: 'application/vnd.github+json',
    'user-agent': 'merm8-splash-workflow-tool-updater',
  }
  if (process.env.GITHUB_TOKEN) {
    apiHeaders.authorization = `Bearer ${process.env.GITHUB_TOKEN}`
  }

  const apiResponse = await fetch(`https://api.github.com/repos/${tool.repository}/releases/latest`, {
    headers: apiHeaders,
    signal: AbortSignal.timeout(30_000),
  })

  if (!apiResponse.ok) {
    throw new Error(`Could not read ${tool.repository} latest release: HTTP ${apiResponse.status}`)
  }

  const release = await apiResponse.json()
  const tagMatch = typeof release.tag_name === 'string'
    ? release.tag_name.match(/^v(\d+\.\d+\.\d+)$/)
    : null
  const version = tagMatch?.[1] ?? ''
  if (!version) {
    throw new Error(`${tool.repository} returned an unsupported release tag`)
  }

  const expectedAsset = tool.assetName(version)
  const asset = Array.isArray(release.assets)
    ? release.assets.find((candidate) => candidate.name === expectedAsset)
    : undefined
  if (typeof asset?.browser_download_url !== 'string') {
    throw new Error(`${tool.repository} release ${version} has no ${expectedAsset} asset`)
  }

  const assetUrl = new URL(asset.browser_download_url)
  if (assetUrl.protocol !== 'https:' || assetUrl.hostname !== 'github.com') {
    throw new Error(`${tool.repository} returned an untrusted release asset URL`)
  }

  const assetResponse = await fetch(assetUrl, {
    headers: { 'user-agent': 'merm8-splash-workflow-tool-updater' },
    redirect: 'follow',
    signal: AbortSignal.timeout(120_000),
  })
  const finalAssetUrl = new URL(assetResponse.url)
  const trustedAssetHost = finalAssetUrl.hostname === 'github.com' ||
    finalAssetUrl.hostname.endsWith('.github.com') ||
    finalAssetUrl.hostname.endsWith('.githubusercontent.com')
  if (!assetResponse.ok || finalAssetUrl.protocol !== 'https:' || !trustedAssetHost) {
    throw new Error(`Could not download ${expectedAsset}: HTTP ${assetResponse.status}`)
  }

  const archive = Buffer.from(await assetResponse.arrayBuffer())
  if (archive.length === 0 || archive.length > 100 * 1024 * 1024) {
    throw new Error(`${expectedAsset} was empty or exceeded the 100 MiB size limit`)
  }

  return {
    version,
    sha256: createHash('sha256').update(archive).digest('hex'),
    archive,
  }
}

function workflowFiles() {
  return readdirSync(path.join(repoRoot, '.github', 'workflows'))
    .filter((filename) => /\.ya?ml$/i.test(filename))
    .map((filename) => path.join('.github', 'workflows', filename))
}

/**
 * @param {Array<{ tool: (typeof toolDefinitions)[number], archive: Buffer }>} releases
 */
function validateWorkflowsWithReleases(releases) {
  const tempDirectory = mkdtempSync(path.join(tmpdir(), 'workflow-tool-update-'))

  try {
    const workflowPaths = workflowFiles()
    const workflowDirectory = path.join(repoRoot, '.github', 'workflows')
    for (const release of releases) {
      const { tool } = release
      const archivePath = path.join(tempDirectory, `${tool.executable}.tar.gz`)
      const extractDirectory = path.join(tempDirectory, tool.executable)
      writeFileSync(archivePath, release.archive)
      mkdirSync(extractDirectory)
      execFileSync('tar', ['-xzf', archivePath, '-C', extractDirectory], { stdio: 'inherit' })

      const executablePath = path.join(extractDirectory, tool.executable)
      const validationArgs = getValidationArguments(tool, workflowPaths, workflowDirectory)
      const childEnvironment = { ...process.env }
      delete childEnvironment.GITHUB_TOKEN
      execFileSync(executablePath, validationArgs, {
        cwd: repoRoot,
        env: childEnvironment,
        stdio: 'inherit',
      })
    }
  } finally {
    rmSync(tempDirectory, { recursive: true, force: true })
  }
}

async function updateWorkflowToolPinsFromReleases() {
  const latestReleases = await Promise.all(toolDefinitions.map(fetchLatestToolRelease))
  const releaseMap = Object.fromEntries(
    toolDefinitions.map((tool, index) => [
      tool.name,
      { version: latestReleases[index].version, sha256: latestReleases[index].sha256 },
    ]),
  )

  const currentWorkflow = readFileSync(workflowPath, 'utf8')
  const updatedWorkflow = updateWorkflowToolPins(currentWorkflow, releaseMap)
  const changed = updatedWorkflow !== currentWorkflow

  if (changed) {
    writeFileSync(workflowPath, updatedWorkflow)
    try {
      validateWorkflowsWithReleases(
        toolDefinitions.map((tool, index) => ({
          tool,
          archive: latestReleases[index].archive,
        })),
      )
    } catch (error) {
      writeFileSync(workflowPath, currentWorkflow)
      throw error
    }
  }

  const output = `changed=${changed}\n`
  if (process.env.GITHUB_OUTPUT) {
    appendFileSync(process.env.GITHUB_OUTPUT, output)
  } else {
    process.stdout.write(output)
  }

  if (process.env.GITHUB_STEP_SUMMARY) {
    appendFileSync(
      process.env.GITHUB_STEP_SUMMARY,
      [
        '## Workflow analyzer pins',
        '',
        '| Tool | Version | SHA-256 |',
        '|---|---|---|',
        ...toolDefinitions.map((tool, index) => {
          const release = latestReleases[index]
          return `| ${tool.name} | ${release.version} | \`${release.sha256}\` |`
        }),
        '',
        changed
          ? 'The updated pins passed actionlint and zizmor before a pull request was created.'
          : 'Both analyzer pins are current.',
        '',
      ].join('\n'),
    )
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  updateWorkflowToolPinsFromReleases().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
    process.exitCode = 1
  })
}
