'use client'

import { useState, useRef, useEffect } from 'react'
import { Violation, analyzeCodeSarif, Rule } from '@/lib/api'

interface ExportDropdownProps {
  results: Violation[]
  code: string
  endpoint: string
  enabledRules: string[]
  rulesMetadata: Rule[]
}

export default function ExportDropdown({
  results,
  code,
  endpoint,
  enabledRules,
  rulesMetadata,
}: ExportDropdownProps) {
  const [open, setOpen] = useState(false)
  const [copying, setCopying] = useState<string | null>(null)
  const [copyStatus, setCopyStatus] = useState<{ text: string; tone: 'success' | 'error' } | null>(null)
  const [hoveredItem, setHoveredItem] = useState<string | null>(null)
  const ref = useRef<HTMLDivElement>(null)
  const timeoutCancelsRef = useRef<Set<() => void>>(new Set())

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

  const scheduleCopyStatusReset = () => scheduleTimeout(() => setCopyStatus(null), 3000)
  const scheduleCopyingReset = () => scheduleTimeout(() => setCopying(null), 1500)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  useEffect(() => {
    const timeoutCancels = timeoutCancelsRef.current

    return () => {
      timeoutCancels.forEach((cancelTimeout) => cancelTimeout())
      timeoutCancels.clear()
    }
  }, [])

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
    setOpen(false)
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
        lines.push(`| ${v.rule_id} | ${v.severity} | ${v.message} | ${v.line ?? '—'} |`)
      })
    }

    const text = lines.join('\n')
    await handleCopyExport(text, 'markdown', 'merm8-analysis.md', 'text/markdown')
  }

  const exportText = async () => {
    const lines = results.map(
      (v) =>
        `[${v.severity.toUpperCase()}] ${v.rule_id}: ${v.message}${v.line ? ` (line ${v.line})` : ''}`
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
        setCopying(format)
        setCopyStatus({ text: `Copied ${format} to clipboard.`, tone: 'success' })
        scheduleCopyStatusReset()
        scheduleCopyingReset()
        setOpen(false)
        return
      } catch {
        const textareaFallbackSucceeded = fallbackCopyWithTextarea(text)
        if (textareaFallbackSucceeded) {
          setCopying(format)
          setCopyStatus({ text: `Clipboard access failed, but copied ${format} using fallback.`, tone: 'success' })
          scheduleCopyStatusReset()
          scheduleCopyingReset()
          setOpen(false)
          return
        }

        downloadFile(text, fallbackFilename, fallbackMime)
        setCopyStatus({
          text: `Clipboard access failed. Downloaded ${fallbackFilename} instead.`,
          tone: 'error',
        })
        scheduleCopyStatusReset()
        setOpen(false)
        return
      }
    }

    const textareaFallbackSucceeded = fallbackCopyWithTextarea(text)
    if (textareaFallbackSucceeded) {
      setCopying(format)
      setCopyStatus({ text: `Clipboard API unavailable; copied ${format} using fallback.`, tone: 'success' })
      scheduleCopyStatusReset()
      scheduleCopyingReset()
      setOpen(false)
      return
    }

    downloadFile(text, fallbackFilename, fallbackMime)
    setCopyStatus({
      text: `Clipboard unavailable. Downloaded ${fallbackFilename} instead.`,
      tone: 'error',
    })
    scheduleCopyStatusReset()
    setOpen(false)
  }

  const exportSarif = async () => {
    try {
      const sarif = await analyzeCodeSarif(endpoint, code, enabledRules, rulesMetadata)
      downloadFile(JSON.stringify(sarif, null, 2), 'merm8-analysis.sarif.json', 'application/json')
    } catch {
      const fallback = {
        version: '2.1.0',
        $schema: 'https://schemastore.azurewebsites.net/schemas/json/sarif-2.1.0.json',
        runs: [{
          tool: { driver: { name: 'merm8', version: '1.0.0', rules: [] } },
          results: results.map((v) => ({
            ruleId: v.rule_id,
            level: v.severity === 'error' ? 'error' : v.severity === 'warning' ? 'warning' : 'note',
            message: { text: v.message },
            locations: v.line ? [{
              physicalLocation: {
                artifactLocation: { uri: 'diagram.mmd' },
                region: { startLine: v.line },
              },
            }] : [],
          })),
        }],
      }
      downloadFile(JSON.stringify(fallback, null, 2), 'merm8-analysis.sarif.json', 'application/json')
    }
    setOpen(false)
  }

  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-block' }}>
      <button
        className="btn btn-primary"
        onClick={() => setOpen(!open)}
        style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
      >
        {copying ? `✓ Copied (${copying})` : '↓ Export'}
        <span style={{ fontSize: '8px' }}>{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div
          style={{
            position: 'absolute',
            bottom: '100%',
            right: 0,
            marginBottom: '4px',
            background: 'var(--color-bg-secondary)',
            border: '1px solid var(--color-border)',
            minWidth: '160px',
            zIndex: 100,
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
            borderRadius: '8px',
          }}
        >
          {[
            { label: '↓ SARIF JSON', action: exportSarif },
            { label: '↓ JSON', action: exportJson },
            { label: '⎘ Markdown', action: exportMarkdown },
            { label: '⎘ Plain Text', action: exportText },
          ].map((item) => (
            <button
              key={item.label}
              onClick={item.action}
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
                cursor: 'pointer',
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}

      {copyStatus && (
        <div
          style={{
            marginTop: '6px',
            fontSize: '11px',
            color: copyStatus.tone === 'error' ? 'var(--color-error)' : 'var(--color-text-secondary)',
            maxWidth: '260px',
          }}
        >
          {copyStatus.text}
        </div>
      )}
    </div>
  )
}
