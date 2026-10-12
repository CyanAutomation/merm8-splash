import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { pathToFileURL, fileURLToPath } from 'node:url'

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

/**
 * Check relative Markdown links and npm scripts documented in a README.
 * @param {{ readme: string, packageJson: { scripts?: Record<string, string> }, rootDir: string }} input
 * @returns {string[]}
 */
export function checkReadme({ readme, packageJson, rootDir }) {
  const issues = []
  const scripts = packageJson.scripts ?? {}
  const markdown = readme.replace(/^```[^\n]*\n[\s\S]*?^```\s*$/gm, '')

  for (const match of markdown.matchAll(/\[[^\]]+\]\(([^)]+)\)/g)) {
    const link = match[1].trim().split(/\s+/, 1)[0]
    if (!link || link.startsWith('#') || /^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(link)) continue

    const localPath = decodeURIComponent(link.split(/[?#]/, 1)[0])
    if (localPath && !existsSync(path.resolve(rootDir, localPath))) {
      issues.push(`Missing local README link target: ${localPath}`)
    }
  }

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

function main() {
  const readme = readFileSync(path.join(projectRoot, 'README.md'), 'utf8')
  const packageJson = JSON.parse(readFileSync(path.join(projectRoot, 'package.json'), 'utf8'))
  const issues = checkReadme({ readme, packageJson, rootDir: projectRoot })

  if (issues.length > 0) {
    console.error(issues.map((issue) => `- ${issue}`).join('\n'))
    process.exitCode = 1
    return
  }

  console.log('README local links and npm scripts are valid.')
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  main()
}
