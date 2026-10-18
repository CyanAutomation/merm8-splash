import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { checkExternalLinks, checkReadme } from '../scripts/check-readme.mjs'

describe('checkReadme', () => {
  it('accepts existing local links and declared npm scripts', () => {
    const issues = checkReadme({
      readme: '# Quick Start\n[Netlify config](netlify.toml) [section](#quick-start)\n\nnpm run build\nnpm test',
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

  it('accepts valid section anchors and ignores external URLs', () => {
    const issues = checkReadme({
      readme: '## Usage\n[Docs](https://example.com/docs) [Section](#usage)',
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

  it('reports missing anchors in the README and linked Markdown files', () => {
    const rootDir = mkdtempSync(path.join(tmpdir(), 'readme-check-'))
    writeFileSync(path.join(rootDir, 'docs.md'), '# API Reference\n')

    try {
      const issues = checkReadme({
        readme: '# Quick Start\n[missing section](#missing-section)\n[missing API](docs.md#missing-operation)',
        packageJson: { scripts: {} },
        rootDir,
      })

      expect(issues).toEqual([
        'Missing README heading anchor: #missing-section',
        'Missing Markdown heading anchor: docs.md#missing-operation',
      ])
    } finally {
      rmSync(rootDir, { recursive: true, force: true })
    }
  })

  it('supports duplicate heading slugs and ignores links inside fenced code blocks', () => {
    const rootDir = mkdtempSync(path.join(tmpdir(), 'readme-check-'))

    try {
      const issues = checkReadme({
        readme: '## Example\n## Example\n[second](#example-1)\n\n```md\n[not real](#missing)\n```',
        packageJson: { scripts: {} },
        rootDir,
      })

      expect(issues).toEqual([])
    } finally {
      rmSync(rootDir, { recursive: true, force: true })
    }
  })
})

describe('checkExternalLinks', () => {
  it('checks unique Markdown link destinations and skips localhost examples', async () => {
    const requested: Array<{ url: string; method: string }> = []
    const fetchImpl = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      requested.push({ url: String(url), method: init?.method ?? 'GET' })
      return new Response(null, { status: 200 })
    })

    const issues = await checkExternalLinks(`
[Docs](https://example.com/docs#first)
[Same page](https://example.com/docs#second)
![Badge](https://example.com/status.svg)
[Local dev](http://localhost:3000)

~~~md
[Fenced example](https://example.com/ignored)
~~~
`, { fetchImpl, retries: 0 })

    expect(issues).toEqual({ issues: [], warnings: [] })
    expect(requested).toEqual([
      { url: 'https://example.com/docs', method: 'HEAD' },
      { url: 'https://example.com/status.svg', method: 'HEAD' },
    ])
  })

  it('falls back to a ranged GET when a host rejects HEAD', async () => {
    const methods: Array<{ method: string; range?: string }> = []
    const fetchImpl = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      const headers = new Headers(init?.headers)
      methods.push({ method: init?.method ?? 'GET', range: headers.get('range') ?? undefined })
      return new Response(null, { status: init?.method === 'HEAD' ? 405 : 206 })
    })

    const issues = await checkExternalLinks('[Docs](https://example.com/docs)', { fetchImpl, retries: 0 })

    expect(issues).toEqual({ issues: [], warnings: [] })
    expect(methods).toEqual([
      { method: 'HEAD', range: undefined },
      { method: 'GET', range: 'bytes=0-0' },
    ])
  })

  it('retries transient failures and reports a persistent bad status', async () => {
    let attempts = 0
    const fetchImpl = vi.fn(async () => {
      attempts += 1
      return new Response(null, { status: attempts === 1 ? 503 : 404 })
    })

    const issues = await checkExternalLinks('[Missing](https://example.com/missing)', {
      fetchImpl,
      retries: 1,
      sleep: async () => {},
    })

    expect(attempts).toBe(2)
    expect(issues).toEqual({
      issues: ['External README link returned HTTP 404: https://example.com/missing'],
      warnings: [],
    })
  })

  it('ignores Markdown-looking destinations in fenced code blocks', async () => {
    const fetchImpl = vi.fn()
    const issues = await checkExternalLinks('```md\n[Example](https://example.com/not-a-link)\n```', {
      fetchImpl,
      retries: 0,
    })

    expect(issues).toEqual({ issues: [], warnings: [] })
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('reports malformed HTTP(S) destinations without requesting them', async () => {
    const fetchImpl = vi.fn()
    const issues = await checkExternalLinks('[Broken](https://[malformed)', { fetchImpl, retries: 0 })

    expect(issues).toEqual({
      issues: ['Invalid external README URL: https://[malformed'],
      warnings: [],
    })
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('reports network failures as unverified warnings, not confirmed broken links', async () => {
    const fetchImpl = vi.fn(async () => {
      throw new TypeError('network unavailable')
    })

    const result = await checkExternalLinks('[Docs](https://example.com/docs)', { fetchImpl, retries: 0 })

    expect(result.issues).toEqual([])
    expect(result.warnings).toEqual([
      'External README link could not be checked: https://example.com/docs (network unavailable)',
    ])
  })
})
