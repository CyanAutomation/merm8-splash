import { analyzeCodeSarif, validateApiEndpoint, type Rule, type Violation } from './api'
import { copyTextWithFallback } from './clipboard'
import { createFallbackSarif } from './exportFormats'
import { EXPORT_MESSAGES } from './uiCopy'

export interface CopyExportOptions {
  text: string
  format: 'markdown' | 'text'
  fallbackFilename: string
  fallbackMime: string
  isMounted: () => boolean
  setCopying: (format: string | null) => void
  showSnackbar: (message: string, type: 'success' | 'warning' | 'error') => void
  scheduleCopyingReset: () => void
  closeDropdown: () => void
  downloadFile: (content: string, filename: string, mime: string) => void
}

export async function copyExport(options: CopyExportOptions): Promise<void> {
  const copyResult = await copyTextWithFallback(options.text)
  if (!options.isMounted()) return

  if (copyResult.copied) {
    options.setCopying(options.format)
    const message = copyResult.method === 'clipboard'
      ? `Copied ${options.format} to clipboard.`
      : copyResult.clipboardAvailable
        ? `Clipboard access failed, but copied ${options.format} using fallback.`
        : `Clipboard API unavailable; copied ${options.format} using fallback.`
    options.showSnackbar(message, 'success')
    options.scheduleCopyingReset()
    options.closeDropdown()
    return
  }

  options.downloadFile(options.text, options.fallbackFilename, options.fallbackMime)
  const message = copyResult.clipboardAvailable
    ? `Clipboard access failed; downloaded ${options.fallbackFilename} instead.`
    : `Clipboard unavailable; downloaded ${options.fallbackFilename} instead.`
  options.showSnackbar(message, 'warning')
  options.closeDropdown()
}

export interface SarifExportOptions {
  endpoint: string
  code: string
  results: Violation[]
  enabledRules: string[]
  rulesMetadata: Rule[]
  isMounted: () => boolean
  closeDropdown: () => void
  showSnackbar: (message: string, type: 'success' | 'warning' | 'error') => void
  downloadFile: (content: string, filename: string, mime: string) => void
}

export async function exportSarifWithFallback(options: SarifExportOptions): Promise<void> {
  const fallback = createFallbackSarif(options.results)
  const endpointValidation = validateApiEndpoint(options.endpoint)

  try {
    if (!endpointValidation.valid) {
      options.downloadFile(JSON.stringify(fallback, null, 2), 'merm8-check-results.sarif.json', 'application/json')
      options.showSnackbar('Endpoint is invalid; downloaded a local SARIF file instead.', 'warning')
      return
    }

    const sarif = await analyzeCodeSarif(options.endpoint, options.code, options.enabledRules, options.rulesMetadata)
    options.downloadFile(JSON.stringify(sarif, null, 2), 'merm8-check-results.sarif.json', 'application/json')
    options.showSnackbar(EXPORT_MESSAGES.sarifDownloaded, 'success')
  } catch {
    options.downloadFile(JSON.stringify(fallback, null, 2), 'merm8-check-results.sarif.json', 'application/json')
    options.showSnackbar('The API couldn’t create SARIF; downloaded a local copy instead.', 'warning')
  } finally {
    if (options.isMounted()) options.closeDropdown()
  }
}
