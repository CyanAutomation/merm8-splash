import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { pathToFileURL, fileURLToPath } from 'node:url'

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const MARKDOWN_DESTINATION_PATTERN = /\]\(\s*(<[^>\r\n]+>|[^)\s]+)(?:\s+[^)]*)?\)/g
const EXTERNAL_LINK_TIMEOUT_MS = 8_000
const EXTERNAL_LINK_RETRIES = 2

/**
 * Remove fenced code blocks so documentation examples are not treated as links or headings.
 * @param {string} markdown
 * @returns {string}
 */
function withoutFencedCode(markdown) {
  const lines = markdown.split(/\r?\n/)
  const visibleLines = []
  /** @type {{ character: string, length: number } | null} */
  let fence = null

  for (const line of lines) {
    const marker = line.match(/^ {0,3}(`{3,}|~{3,})/)

    if (!fence && marker) {
      fence = { character: marker[1][0], length: marker[1].length }
      continue
    }

    if (fence) {
      const closingMarker = line.match(/^ {0,3}(`+|~+)\s*$/)
      if (
        closingMarker &&
        closingMarker[1][0] === fence.character &&
        closingMarker[1].length >= fence.length
      ) {
        fence = null
      }
      continue
    }

    visibleLines.push(line)
  }

  return visibleLines.join('\n')
}

/**
 * Extract Markdown link and image destinations from non-code text.
 * @param {string} markdown
 * @returns {string[]}
 */
function extractMarkdownTargets(markdown) {
  return [...withoutFencedCode(markdown).matchAll(MARKDOWN_DESTINATION_PATTERN)].map((match) =>
    match[1].replace(/^<|>$/g, ''),
  )
}

/**
 * Return GitHub-style heading slugs, including numeric suffixes for duplicate headings.
 * @param {string} markdown
 * @returns {Set<string>}
 */
function headingSlugs(markdown) {
  const headings = withoutFencedCode(markdown).matchAll(/^ {0,3}#{1,6}[ \t]+(.+?)[ \t]*#*[ \t]*$/gm)
  const seen = new Map()
  const slugs = new Set()

  for (const [, sourceText] of headings) {
    const text = sourceText
      .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
      .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
      .replace(/<[^>]+>/g, '')
      .replace(/[`*_~]/g, '')
      .toLowerCase()
      .normalize('NFKC')

    const baseSlug = text
      .replace(/[^\p{L}\p{N}_\s-]/gu, '')
      .trim()
      .replace(/\s+/g, '-')

    if (!baseSlug) continue

    const duplicateCount = seen.get(baseSlug) ?? 0
    seen.set(baseSlug, duplicateCount + 1)
    slugs.add(duplicateCount === 0 ? baseSlug : `${baseSlug}-${duplicateCount}`)
  }

  return slugs
}

/**
 * @param {string} target
 * @returns {{ localPath: string, fragment: string | null }}
 */
function splitLocalTarget(target) {
  const hashIndex = target.indexOf('#')
  const pathAndQuery = hashIndex === -1 ? target : target.slice(0, hashIndex)
  const pathPart = pathAndQuery.split('?', 1)[0]

  return {
    localPath: pathPart,
    fragment: hashIndex === -1 ? null : target.slice(hashIndex + 1),
  }
}

function decodeMarkdownTarget(target) {
  const { localPath, fragment } = splitLocalTarget(target)
  try {
    return {
      decodedPath: decodeURIComponent(localPath),
      decodedFragment: fragment === null ? null : decodeURIComponent(fragment),
    }
  } catch {
    return null
  }
}

function missingLocalTargetIssue(decodedPath, rootDir) {
  if (!decodedPath) return null
  return existsSync(path.resolve(rootDir, decodedPath))
    ? null
    : `Missing local README link target: ${decodedPath}`
}

function missingHeadingIssue(decodedPath, decodedFragment, rootDir, readmeSlugs) {
  if (!decodedFragment) return null
  const resolvedPath = decodedPath ? path.resolve(rootDir, decodedPath) : null
  const isReadmeFragment = !resolvedPath || path.resolve(rootDir, 'README.md') === resolvedPath
  const isMarkdownTarget = resolvedPath && /\.(?:md|mdx)$/i.test(resolvedPath)
  if (!isReadmeFragment && !isMarkdownTarget) return null

  const slugs = isReadmeFragment || !resolvedPath
    ? readmeSlugs
    : headingSlugs(readFileSync(resolvedPath, 'utf8'))
  if (slugs.has(decodedFragment)) return null

  const label = isReadmeFragment ? `#${decodedFragment}` : `${decodedPath}#${decodedFragment}`
  return isReadmeFragment
    ? `Missing README heading anchor: ${label}`
    : `Missing Markdown heading anchor: ${label}`
}

function checkLocalMarkdownTarget(target, rootDir, readmeSlugs) {
  if (!target || /^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(target)) return []

  const decodedTarget = decodeMarkdownTarget(target)
  if (!decodedTarget) return [`Invalid URL encoding in README link: ${target}`]

  const missingPathIssue = missingLocalTargetIssue(decodedTarget.decodedPath, rootDir)
  if (missingPathIssue) return [missingPathIssue]

  const missingFragmentIssue = missingHeadingIssue(
    decodedTarget.decodedPath,
    decodedTarget.decodedFragment,
    rootDir,
    readmeSlugs,
  )
  return missingFragmentIssue ? [missingFragmentIssue] : []
}

function checkDocumentedScripts(readme, scripts) {
  const issues = []
  for (const match of readme.matchAll(/\bnpm\s+run\s+([a-zA-Z0-9:_-]+)/g)) {
    const script = match[1]
    if (!(script in scripts)) {
      issues.push(`README references npm script "${script}" not found in package.json`)
    }
  }

  if (/\bnpm\s+test\b/.test(readme) && !('test' in scripts)) {
    issues.push('README references npm test but package.json has no test script')
  }

  return issues
}

/**
 * Check local Markdown links, heading fragments, and documented npm scripts.
 * @param {{ readme: string, packageJson: { scripts?: Record<string, string> }, rootDir: string }} input
 * @returns {string[]}
 */
export function checkReadme({ readme, packageJson, rootDir }) {
  const readmeSlugs = headingSlugs(readme)
  const localLinkIssues = extractMarkdownTargets(readme)
    .flatMap((target) => checkLocalMarkdownTarget(target, rootDir, readmeSlugs))
  return [...localLinkIssues, ...checkDocumentedScripts(readme, packageJson.scripts ?? {})]
}

/**
 * @param {string} value
 * @returns {boolean}
 */
function isLocalHost(value) {
  const hostname = value.toLowerCase().replace(/^\[|\]$/g, '')
  return hostname === 'localhost' || hostname.endsWith('.localhost') || hostname === '127.0.0.1' || hostname === '::1'
}

/**
 * Check unique HTTP(S) Markdown links. The caller can inject fetch and sleep functions for tests.
 * @param {string} readme
 * @param {{ fetchImpl?: typeof fetch, retries?: number, timeoutMs?: number, sleep?: (ms: number) => Promise<void> }} [options]
 * @returns {Promise<{ issues: string[], warnings: string[] }>}
 */
export async function checkExternalLinks(
  readme,
  {
    fetchImpl = fetch,
    retries = EXTERNAL_LINK_RETRIES,
    timeoutMs = EXTERNAL_LINK_TIMEOUT_MS,
    sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  } = {},
) {
  const urls = new Set()
  const issues = []
  const warnings = []

  for (const target of extractMarkdownTargets(readme)) {
    let url
    try {
      url = new URL(target)
    } catch {
      if (/^https?:\/\//i.test(target)) {
        issues.push(`Invalid external README URL: ${target}`)
      }
      continue
    }

    if (!['http:', 'https:'].includes(url.protocol) || isLocalHost(url.hostname)) continue
    if (url.username || url.password) {
      issues.push(`External README link contains embedded credentials: ${url.origin}${url.pathname}`)
      continue
    }

    url.hash = ''
    urls.add(url.href)
  }

  const uniqueUrls = [...urls]
  let nextUrlIndex = 0
  const workerCount = Math.min(4, uniqueUrls.length)
  const workerResults = await Promise.all(
    Array.from({ length: workerCount }, async () => {
      const workerIssues = []
      const workerWarnings = []

      while (nextUrlIndex < uniqueUrls.length) {
        const url = uniqueUrls[nextUrlIndex]
        nextUrlIndex += 1
        const result = await checkLink(url, { fetchImpl, retries, timeoutMs, sleep })
        if (result?.issue) workerIssues.push(result.issue)
        if (result?.warning) workerWarnings.push(result.warning)
      }

      return { issues: workerIssues, warnings: workerWarnings }
    }),
  )

  return {
    issues: [...issues, ...workerResults.flatMap((result) => result.issues)].sort(),
    warnings: [...warnings, ...workerResults.flatMap((result) => result.warnings)].sort(),
  }
}

async function checkLink(url, { fetchImpl, retries, timeoutMs, sleep }) {
  const request = (method, headers = {}) =>
    fetchImpl(url, {
      method,
      redirect: 'follow',
      headers: {
        'user-agent': 'merm8-splash-readme-link-check/1.0',
        ...headers,
      },
      signal: AbortSignal.timeout(timeoutMs),
    })

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const result = await requestExternalLink(url, request, attempt, retries, sleep)
      if (result?.retry) continue
      return result
    } catch (error) {
      if (attempt < retries) {
        await sleep(500 * (attempt + 1))
        continue
      }

      return {
        issue: null,
        warning: `External README link could not be checked: ${url} (${error instanceof Error ? error.message : String(error)})`,
      }
    }
  }

  return null
}

async function requestExternalLink(url, request, attempt, retries, sleep) {
  let response = await request('HEAD')
  if ([403, 405, 501].includes(response.status)) {
    await response.body?.cancel().catch(() => {})
    response = await request('GET', { range: 'bytes=0-0' })
  }

  if (response.ok) {
    await response.body?.cancel().catch(() => {})
    return null
  }

  const issue = `External README link returned HTTP ${response.status}: ${url}`
  await response.body?.cancel().catch(() => {})
  if (attempt < retries && (response.status === 429 || response.status >= 500)) {
    await sleep(500 * (attempt + 1))
    return { retry: true }
  }

  return { issue, warning: null }
}

async function main() {
  const readme = readFileSync(path.join(projectRoot, 'README.md'), 'utf8')
  const packageJson = JSON.parse(readFileSync(path.join(projectRoot, 'package.json'), 'utf8'))
  const issues = checkReadme({ readme, packageJson, rootDir: projectRoot })
  let externalWarningCount = 0

  if (process.argv.includes('--external')) {
    const externalResult = await checkExternalLinks(readme)
    issues.push(...externalResult.issues)
    externalWarningCount = externalResult.warnings.length
    for (const warning of externalResult.warnings) {
      console.warn(process.env.GITHUB_ACTIONS ? `::warning title=README link unverifiable::${warning}` : `Warning: ${warning}`)
    }
  }

  if (issues.length > 0) {
    console.error(issues.map((issue) => `- ${issue}`).join('\n'))
    process.exitCode = 1
    return
  }

  if (process.argv.includes('--external')) {
    console.log(
      `README local links, heading anchors, and npm scripts are valid; external link check finished with ${issues.length} errors and ${externalWarningCount} unverified links.`,
    )
    return
  }

  console.log('README local links, heading anchors, and npm scripts are valid.')
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  main().catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
}
