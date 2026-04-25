'use client'

import { useState, useRef, useEffect } from 'react'
import { Violation, analyzeCodeSarif, Rule, validateApiEndpoint } from '@/lib/api'
import { useSnackbar } from '@/app/components/Snackbar'

interface ExportDropdownProps {
  results: Violation[]
  code: string
  endpoint: string
  enabledRules: string[]
  rulesMetadata: Rule[]
}

const escapeMarkdownCell = (text: string): string => {
  if (text == null) {
    return ''
  }
  return text
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .replace(/\r\n|\r|\n/g, '<br>')
    .replace(/\|/g, '\\|')
}

export default function ExportDropdown({
  results,
  code,
  endpoint,
  enabledRules,
  rulesMetadata,
}: ExportDropdownProps) {
  const snackbar = useSnackbar()
  const [open, setOpen] = useState(false)
  const [copying, setCopying] = useState<string | null>(null)
  const [isExporting, setIsExporting] = useState(false)
  const [hoveredItem, setHoveredItem] = useState<string | null>(null)
  const ref = useRef<HTMLDivElement>(null)
  const isMountedRef = useRef(true)
  const isExportingRef = useRef(false)
  const timeoutCancelsRef = useRef<Set<() => void>>(new Set())
  const copyingCancelRef = useRef<(() => void) | null>(null)

  const setOpenSafely = (nextOpen: boolean) => {
    if (!isMountedRef.current) {
      return
    }
    setOpen(nextOpen)
  }

  const setCopyingSafely = (nextCopying: string | null) => {
    if (!isMountedRef.current) {
      return
    }
    setCopying(nextCopying)
  }

  const showSnackbarSafely = (message: string, type: 'success' | 'error') => {
    if (!isMountedRef.current) {
      return
    }
    snackbar.show(message, type)
  }

  const scheduleTimeout = (callback: () => void, delay: number) => {
    let timeoutId: number | null = null

    const cancelTimeout = () => {
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId)
      }
      timeoutCancelsRef.current.delete(cancelTimeout)
    }

    timeoutCancelsRef.current.add(cancelTimeout)

    timeoutId = window.setTimeout(() => {
      timeoutCancelsRef.current.delete(cancelTimeout)
      callback()
    }, delay)

    return cancelTimeout
  }

  const scheduleCopyingReset = () => {
    copyingCancelRef.current?.()
    copyingCancelRef.current = null

    const cancelTimeout = scheduleTimeout(() => {
      copyingCancelRef.current = null
      setCopyingSafely(null)
    }, 1500)

    copyingCancelRef.current = cancelTimeout
  }

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (isExportingRef.current) {
        return
      }
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpenSafely(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  useEffect(() => {
    isMountedRef.current = true

    const timeoutCancels = timeoutCancelsRef.current

    return () => {
      isMountedRef.current = false
      copyingCancelRef.current?.()
      copyingCancelRef.current = null
      timeoutCancels.forEach((cancelTimeout) => cancelTimeout())
      timeoutCancels.clear()
    }
  }, [])

  const setExportingSafely = (exporting: boolean) => {
    if (!isMountedRef.current) {
      return
    }
    setIsExporting(exporting)
  }

  const runExportAction = async (action: () => Promise<void> | void) => {
    if (isExportingRef.current) {
      return
    }

    isExportingRef.current = true
    setExportingSafely(true)
    try {
      await action()
    } finally {
      isExportingRef.current = false
      setExportingSafely(false)
    }
  }

  const downloadFile = (content: string, filename: string, mime: string) => {
    const blob = new Blob([content], { type: mime })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.style.display = 'none'
    document.body.appendChild(a)
    a.click()

    scheduleTimeout(() => {
      URL.revokeObjectURL(url)
      a.remove()
    }, 100)
  }

  const exportJson = () => {
    const data = JSON.stringify({ results, code }, null, 2)
    downloadFile(data, 'merm8-analysis.json', 'application/json')
    setOpenSafely(false)
  }

  const exportMarkdown = async () => {

    const lines = [
      '# merm8 Analysis Results',
      '',
      `**Total violations:** ${results.length}`,
      '',
    ]

    if (results.length === 0) {
      lines.push('✓ No violations found')
    } else {
      lines.push('| Rule | Severity | Message | Line |')
      lines.push('|------|----------|---------|------|')
      results.forEach((v) => {
        const ruleId = escapeMarkdownCell(v.rule_id)
        const severity = escapeMarkdownCell(v.severity)
        const message = escapeMarkdownCell(v.message)
        lines.push(`| ${ruleId} | ${severity} | ${message} | ${v.line ?? '—'} |`)
      })
    }

    const text = lines.join('\n')
    await handleCopyExport(text, 'markdown', 'merm8-analysis.md', 'text/markdown')
  }

  const exportText = async () => {

    const lines = results.map(
      (v) =>
        `[${v.severity.toUpperCase()}] ${v.rule_id}: ${v.message}${v.line != null ? ` (line ${v.line})` : ''}`
    )
    const text = lines.join('\n') || 'No violations found'
    await handleCopyExport(text, 'text', 'merm8-analysis.txt', 'text/plain')
  }

  const fallbackCopyWithTextarea = (text: string): boolean => {
    const textarea = document.createElement('textarea')
    textarea.value = text
    textarea.setAttribute('readonly', '')
    textarea.style.position = 'fixed'
    textarea.style.opacity = '0'
    textarea.style.left = '-9999px'
    document.body.appendChild(textarea)
    textarea.select()

    let success = false
    try {
      success = document.execCommand('copy')
    } catch {
      success = false
    } finally {
      if (textarea.parentNode) {
        textarea.parentNode.removeChild(textarea)
      }
    }

    return success
  }

  const handleCopyExport = async (
    text: string,
    format: 'markdown' | 'text',
    fallbackFilename: string,
    fallbackMime: string
  ) => {
    const hasClipboardApi = typeof navigator !== 'undefined' && !!navigator.clipboard?.writeText

    if (hasClipboardApi) {
      try {
        await navigator.clipboard.writeText(text)
        if (!isMountedRef.current) {
          return
        }
        setCopyingSafely(format)
        showSnackbarSafely(`Copied ${format} to clipboard.`, 'success')
        scheduleCopyingReset()
        setOpenSafely(false)
        return
      } catch {
        const textareaFallbackSucceeded = fallbackCopyWithTextarea(text)
        if (textareaFallbackSucceeded) {
          if (!isMountedRef.current) {
            return
          }
          setCopyingSafely(format)
          showSnackbarSafely(`Clipboard access failed, but copied ${format} using fallback.`, 'success')
          scheduleCopyingReset()
          setOpenSafely(false)
          return
        }

        downloadFile(text, fallbackFilename, fallbackMime)
        if (!isMountedRef.current) {
          return
        }
        showSnackbarSafely(`Clipboard access failed. Downloaded ${fallbackFilename} instead.`, 'error')
        setOpenSafely(false)
        return
      }
    }

    const textareaFallbackSucceeded = fallbackCopyWithTextarea(text)
    if (textareaFallbackSucceeded) {
      setCopyingSafely(format)
      showSnackbarSafely(`Clipboard API unavailable; copied ${format} using fallback.`, 'success')
      scheduleCopyingReset()
      setOpenSafely(false)
      return
    }

    downloadFile(text, fallbackFilename, fallbackMime)
    showSnackbarSafely(`Clipboard unavailable. Downloaded ${fallbackFilename} instead.`, 'error')
    setOpenSafely(false)
  }

  const exportSarif = async () => {
    const fallback = {
      version: '2.1.0',
      $schema: 'https://schemastore.azurewebsites.net/schemas/json/sarif-2.1.0.json',
      runs: [{
        tool: { driver: { name: 'merm8', version: '1.0.0', rules: [] } },
        results: results.map((v) => ({
          ruleId: v.rule_id,
          level: v.severity === 'error' ? 'error' : v.severity === 'warning' ? 'warning' : 'note',
          message: { text: v.message },
          locations: v.line != null ? [{
            physicalLocation: {
              artifactLocation: { uri: 'diagram.mmd' },
              region: { startLine: v.line },
            },
          }] : [],
        })),
      }],
    }

    const endpointValidation = validateApiEndpoint(endpoint)

    try {
      if (!endpointValidation.valid) {
        downloadFile(JSON.stringify(fallback, null, 2), 'merm8-analysis.sarif.json', 'application/json')
        showSnackbarSafely('Endpoint invalid; exported local fallback SARIF.', 'success')
        return
      }

      const sarif = await analyzeCodeSarif(endpoint, code, enabledRules, rulesMetadata)
      downloadFile(JSON.stringify(sarif, null, 2), 'merm8-analysis.sarif.json', 'application/json')
    } catch {
      downloadFile(JSON.stringify(fallback, null, 2), 'merm8-analysis.sarif.json', 'application/json')
      showSnackbarSafely('Remote SARIF generation failed; exported local fallback.', 'error')
    } finally {
      if (isMountedRef.current) {
        setOpenSafely(false)
      }
    }
  }

  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-block' }}>
      <button
        className="btn btn-primary"
        onClick={() => {
          if (isExportingRef.current) {
            return
          }
          setOpenSafely(!open)
        }}
        style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
      >
        {copying ? `✓ Copied (${copying})` : '↓ Export'}
        <span style={{ fontSize: '8px' }}>{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            right: 0,
            marginTop: '4px',
            background: 'var(--color-bg-secondary)',
            border: '1px solid var(--color-border)',
            minWidth: '160px',
            zIndex: 100,
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
            borderRadius: '8px',
          }}
        >
          {[
            { label: '↓ SARIF JSON', action: () => runExportAction(exportSarif) },
            { label: '↓ JSON', action: () => runExportAction(exportJson) },
            { label: '⎘ Markdown', action: () => runExportAction(exportMarkdown) },
            { label: '⎘ Plain Text', action: () => runExportAction(exportText) },
          ].map((item) => (
            <button
              key={item.label}
              onClick={item.action}
              disabled={isExporting}
              onMouseEnter={() => setHoveredItem(item.label)}
              onMouseLeave={() => setHoveredItem(null)}
              style={{
                display: 'block',
                width: '100%',
                textAlign: 'left',
                background: hoveredItem === item.label ? 'var(--color-bg-primary)' : 'none',
                border: 'none',
                borderBottom: '1px solid rgba(68,68,68,0.3)',
                padding: '8px 12px',
                color: hoveredItem === item.label ? 'var(--color-accent-primary)' : 'var(--color-text-primary)',
                fontFamily: 'var(--font-sans)',
                fontSize: '12px',
                cursor: isExporting ? 'not-allowed' : 'pointer',
                opacity: isExporting ? 0.65 : 1,
              }}
            >
              {isExporting ? 'Exporting…' : item.label}
            </button>
          ))}
        </div>
      )}

    </div>
  )
}
