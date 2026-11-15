import { describe, expect, it, vi } from 'vitest'
import {
  fetchLatestToolRelease,
  getValidationArguments,
  toolDefinitions,
  updateWorkflowToolPins,
} from '../scripts/update-workflow-tool-pins.mjs'

const workflow = [
  "actionlint_version='1.7.12'",
  `actionlint_sha256='${'a'.repeat(64)}'`,
  "zizmor_version='1.30.1'",
  `zizmor_sha256='${'b'.repeat(64)}'`,
].join('\n')

describe('updateWorkflowToolPins', () => {
  it('updates each analyzer version and checksum together', () => {
    const updated = updateWorkflowToolPins(workflow, {
      actionlint: { version: '1.8.0', sha256: 'c'.repeat(64) },
      zizmor: { version: '1.31.0', sha256: 'd'.repeat(64) },
    })

    expect(updated).toContain("actionlint_version='1.8.0'")
    expect(updated).toContain(`actionlint_sha256='${'c'.repeat(64)}'`)
    expect(updated).toContain("zizmor_version='1.31.0'")
    expect(updated).toContain(`zizmor_sha256='${'d'.repeat(64)}'`)
    expect(updated).not.toContain("actionlint_version='1.7.12'")
    expect(updated).not.toContain("zizmor_version='1.30.1'")
  })

  it('leaves the workflow unchanged when versions and checksums match', () => {
    expect(updateWorkflowToolPins(workflow, {
      actionlint: { version: '1.7.12', sha256: 'a'.repeat(64) },
      zizmor: { version: '1.30.1', sha256: 'b'.repeat(64) },
    })).toBe(workflow)
  })

  it('rejects invalid versions, checksums, and missing pin declarations', () => {
    expect(() => updateWorkflowToolPins(workflow, {
      actionlint: { version: 'latest', sha256: 'c'.repeat(64) },
      zizmor: { version: '1.31.0', sha256: 'd'.repeat(64) },
    })).toThrow(/Invalid actionlint release/)

    expect(() => updateWorkflowToolPins(workflow, {
      actionlint: { version: '1.8.0', sha256: 'not-a-sha256' },
      zizmor: { version: '1.31.0', sha256: 'd'.repeat(64) },
    })).toThrow(/Invalid actionlint release/)

    expect(() => updateWorkflowToolPins(workflow.replace("zizmor_version='1.30.1'\n", ''), {
      actionlint: { version: '1.8.0', sha256: 'c'.repeat(64) },
      zizmor: { version: '1.31.0', sha256: 'd'.repeat(64) },
    })).toThrow(/exactly one zizmor_version pin/)
  })
})

describe('analyzer workflow validation commands', () => {
  it('gets each analyzer command from its tool definition', () => {
    const workflowPaths = ['.github/workflows/ci.yml', '.github/workflows/main.yaml']
    const workflowDirectory = '/workspace/.github/workflows'

    expect(getValidationArguments(toolDefinitions[0], workflowPaths, workflowDirectory))
      .toEqual(workflowPaths)
    expect(getValidationArguments(toolDefinitions[1], workflowPaths, workflowDirectory))
      .toEqual(['--offline', workflowDirectory])
  })

  it('rejects tool definitions without explicit validation arguments', () => {
    expect(() => getValidationArguments(
      { name: 'future-tool', executable: 'future-tool' },
      [],
      '/workspace/.github/workflows',
    )).toThrow(/future-tool must define validateArgs/)
  })
})

describe('fetchLatestToolRelease', () => {
  const tool = toolDefinitions[0]
  const archive = Buffer.from('trusted archive')
  const assetUrl = 'https://github.com/rhysd/actionlint/releases/download/v1.8.0/actionlint.tar.gz'

  function createFetch({ release, download = {} }) {
    return vi.fn(async (input, init) => {
      if (String(input).includes('/releases/latest')) {
        return {
          ok: true,
          status: 200,
          json: async () => release,
        }
      }

      return {
        ok: true,
        status: 200,
        url: 'https://objects.githubusercontent.com/rhysd/actionlint/archive.tar.gz',
        arrayBuffer: async () => archive,
        ...download,
      }
    })
  }

  function releasePayload(overrides = {}) {
    return {
      tag_name: 'v1.8.0',
      assets: [{ name: tool.assetName('1.8.0'), browser_download_url: assetUrl }],
      ...overrides,
    }
  }

  it('downloads the expected release from GitHub and returns its digest', async () => {
    const fetchImpl = createFetch({ release: releasePayload() })
    const result = await fetchLatestToolRelease(tool, { fetchImpl, githubToken: 'token' })

    expect(result.version).toBe('1.8.0')
    expect(result.archive).toEqual(archive)
    expect(result.sha256).toMatch(/^[a-f0-9]{64}$/)
    expect(fetchImpl).toHaveBeenCalledTimes(2)
    expect(fetchImpl.mock.calls[0][1].headers.authorization).toBe('Bearer token')
    expect(fetchImpl.mock.calls[1][1].redirect).toBe('follow')
  })

  it('rejects failed release lookups and unsupported tags before downloading', async () => {
    const failedLookup = vi.fn(async () => ({ ok: false, status: 503 }))
    await expect(fetchLatestToolRelease(tool, { fetchImpl: failedLookup }))
      .rejects.toThrow('Could not read rhysd/actionlint latest release: HTTP 503')
    expect(failedLookup).toHaveBeenCalledOnce()

    const unsupportedTag = createFetch({ release: releasePayload({ tag_name: 'latest' }) })
    await expect(fetchLatestToolRelease(tool, { fetchImpl: unsupportedTag }))
      .rejects.toThrow('rhysd/actionlint returned an unsupported release tag')
    expect(unsupportedTag).toHaveBeenCalledOnce()
  })

  it('rejects missing or untrusted release assets before download', async () => {
    const missingAsset = createFetch({ release: releasePayload({ assets: [] }) })
    await expect(fetchLatestToolRelease(tool, { fetchImpl: missingAsset }))
      .rejects.toThrow('rhysd/actionlint release 1.8.0 has no actionlint_1.8.0_linux_amd64.tar.gz asset')
    expect(missingAsset).toHaveBeenCalledOnce()

    const untrustedAsset = createFetch({
      release: releasePayload({ assets: [{ name: tool.assetName('1.8.0'), browser_download_url: 'http://example.com/tool' }] }),
    })
    await expect(fetchLatestToolRelease(tool, { fetchImpl: untrustedAsset }))
      .rejects.toThrow('rhysd/actionlint returned an untrusted release asset URL')
    expect(untrustedAsset).toHaveBeenCalledOnce()
  })

  it('rejects failed redirects and empty archives', async () => {
    const untrustedFinalUrl = createFetch({
      release: releasePayload(),
      download: { url: 'https://evil.example/tool.tar.gz' },
    })
    await expect(fetchLatestToolRelease(tool, { fetchImpl: untrustedFinalUrl }))
      .rejects.toThrow('Could not download actionlint_1.8.0_linux_amd64.tar.gz: HTTP 200')

    const emptyArchive = createFetch({ release: releasePayload(), download: { arrayBuffer: async () => Buffer.alloc(0) } })
    await expect(fetchLatestToolRelease(tool, { fetchImpl: emptyArchive }))
      .rejects.toThrow('actionlint_1.8.0_linux_amd64.tar.gz was empty or exceeded the 100 MiB size limit')
  })
})
