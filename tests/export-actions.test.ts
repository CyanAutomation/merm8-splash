import { afterEach, describe, expect, it, vi } from 'vitest'

const exportApiMocks = vi.hoisted(() => ({
  analyzeCodeSarif: vi.fn(),
}))
const clipboardMocks = vi.hoisted(() => ({
  copyTextWithFallback: vi.fn(),
}))

vi.mock('../lib/api', async () => {
  const actual = await vi.importActual<typeof import('../lib/api')>('../lib/api')
  return { ...actual, analyzeCodeSarif: exportApiMocks.analyzeCodeSarif }
})
vi.mock('../lib/clipboard', () => ({ copyTextWithFallback: clipboardMocks.copyTextWithFallback }))

import { copyExport, exportSarifWithFallback } from '../lib/exportActions'

afterEach(() => {
  exportApiMocks.analyzeCodeSarif.mockReset()
  clipboardMocks.copyTextWithFallback.mockReset()
})

describe('export actions', () => {
  it('reports successful clipboard copies and closes the menu', async () => {
    clipboardMocks.copyTextWithFallback.mockResolvedValue({
      copied: true,
      clipboardAvailable: true,
      method: 'clipboard',
    })
    const setCopying = vi.fn()
    const showSnackbar = vi.fn()
    const scheduleCopyingReset = vi.fn()
    const closeDropdown = vi.fn()

    await copyExport({
      text: 'report',
      format: 'markdown',
      fallbackFilename: 'report.md',
      fallbackMime: 'text/markdown',
      isMounted: () => true,
      setCopying,
      showSnackbar,
      scheduleCopyingReset,
      closeDropdown,
      downloadFile: vi.fn(),
    })

    expect(setCopying).toHaveBeenCalledWith('markdown')
    expect(showSnackbar).toHaveBeenCalledWith('Copied markdown to clipboard.', 'success')
    expect(scheduleCopyingReset).toHaveBeenCalledOnce()
    expect(closeDropdown).toHaveBeenCalledOnce()
  })

  it('warns when a local download is used instead of copying', async () => {
    clipboardMocks.copyTextWithFallback.mockResolvedValue({
      copied: false,
      clipboardAvailable: false,
      method: 'fallback-failed',
    })
    const downloadFile = vi.fn()
    const showSnackbar = vi.fn()

    await copyExport({
      text: 'report',
      format: 'markdown',
      fallbackFilename: 'report.md',
      fallbackMime: 'text/markdown',
      isMounted: () => true,
      setCopying: vi.fn(),
      showSnackbar,
      scheduleCopyingReset: vi.fn(),
      closeDropdown: vi.fn(),
      downloadFile,
    })

    expect(downloadFile).toHaveBeenCalledWith('report', 'report.md', 'text/markdown')
    expect(showSnackbar).toHaveBeenCalledWith('Clipboard unavailable; downloaded report.md instead.', 'warning')
  })

  it('warns when SARIF generation falls back to a local download', async () => {
    exportApiMocks.analyzeCodeSarif.mockRejectedValue(new Error('offline'))
    const downloadFile = vi.fn()
    const showSnackbar = vi.fn()
    const closeDropdown = vi.fn()

    await exportSarifWithFallback({
      endpoint: 'https://api.example.test',
      code: 'flowchart TD\nA --> B',
      results: [],
      enabledRules: [],
      rulesMetadata: [],
      isMounted: () => true,
      closeDropdown,
      showSnackbar,
      downloadFile,
    })

    expect(downloadFile).toHaveBeenCalledOnce()
    const [content, filename, mime] = downloadFile.mock.calls[0]
    expect(JSON.parse(content).version).toBe('2.1.0')
    expect(filename).toBe('merm8-check-results.sarif.json')
    expect(mime).toBe('application/json')
    expect(showSnackbar).toHaveBeenCalledWith('The API couldn’t create SARIF; downloaded a local copy instead.', 'warning')
    expect(closeDropdown).toHaveBeenCalledOnce()
  })

  it('warns when an invalid endpoint requires a local SARIF export', async () => {
    const showSnackbar = vi.fn()

    await exportSarifWithFallback({
      endpoint: 'not a URL',
      code: 'flowchart TD\nA --> B',
      results: [],
      enabledRules: [],
      rulesMetadata: [],
      isMounted: () => true,
      closeDropdown: vi.fn(),
      showSnackbar,
      downloadFile: vi.fn(),
    })

    expect(showSnackbar).toHaveBeenCalledWith('Endpoint is invalid; downloaded a local SARIF file instead.', 'warning')
  })

  it('confirms when a SARIF file is downloaded successfully', async () => {
    exportApiMocks.analyzeCodeSarif.mockResolvedValue({ version: '2.1.0', runs: [] })
    const downloadFile = vi.fn()
    const showSnackbar = vi.fn()
    const closeDropdown = vi.fn()

    await exportSarifWithFallback({
      endpoint: 'https://api.example.test',
      code: 'flowchart TD\nA --> B',
      results: [],
      enabledRules: [],
      rulesMetadata: [],
      isMounted: () => true,
      closeDropdown,
      showSnackbar,
      downloadFile,
    })

    expect(downloadFile).toHaveBeenCalledOnce()
    expect(showSnackbar).toHaveBeenCalledWith('SARIF file downloaded.', 'success')
    expect(closeDropdown).toHaveBeenCalledOnce()
  })
})
