import { describe, expect, it } from 'vitest'
import { checkReadme } from '../scripts/check-readme.mjs'

describe('checkReadme', () => {
  it('accepts existing local links and declared npm scripts', () => {
    const issues = checkReadme({
      readme: '[Netlify config](netlify.toml) [section](#quick-start)\n\nnpm run build\nnpm test',
      packageJson: { scripts: { build: 'next build', test: 'vitest --run' } },
      rootDir: process.cwd(),
    })

    expect(issues).toEqual([])
  })

  it('reports missing local links and npm scripts', () => {
    const issues = checkReadme({
      readme: '[Missing file](docs/missing.md)\n\nnpm run check:missing',
      packageJson: { scripts: {} },
      rootDir: process.cwd(),
    })

    expect(issues).toEqual([
      'Missing local README link target: docs/missing.md',
      'README references npm script "check:missing" not found in package.json',
    ])
  })

  it('ignores external URLs and fragment-only links', () => {
    const issues = checkReadme({
      readme: '[Docs](https://example.com/docs) [Section](#usage)',
      packageJson: { scripts: {} },
      rootDir: process.cwd(),
    })

    expect(issues).toEqual([])
  })

  it('ignores Markdown-like text inside fenced code blocks', () => {
    const issues = checkReadme({
      readme: '```md\n[Example](docs/not-a-real-link.md)\n```',
      packageJson: { scripts: {} },
      rootDir: process.cwd(),
    })

    expect(issues).toEqual([])
  })

  it('checks the npm test command against package scripts', () => {
    const issues = checkReadme({
      readme: 'Run `npm test`.',
      packageJson: { scripts: {} },
      rootDir: process.cwd(),
    })

    expect(issues).toEqual(['README references npm test but package.json has no test script'])
  })
})
