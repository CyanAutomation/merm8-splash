'use client'

import { useState, useRef, useEffect } from 'react'
import type { Rule, Violation } from '@/lib/api'
import { createMarkdownExport, createTextExport } from '@/lib/exportFormats'
import { copyExport, exportSarifWithFallback } from '@/lib/exportActions'
import { useSnackbar } from '@/app/components/Snackbar'
import ExportDropdownMenu from './ExportDropdownMenu'

interface ExportDropdownProps {
  results: Violation[]
  code: string
  endpoint: string
  enabledRules: string[]
  rulesMetadata: Rule[]
  emptyResultMessage?: string
}

export default function ExportDropdown({
  results,
  code,
  endpoint,
  enabledRules,
  rulesMetadata,
  emptyResultMessage = 'No check results to export yet.',
}: ExportDropdownProps) {
  const snackbar = useSnackbar()
  const [open, setOpen] = useState(false)
  const [copying, setCopying] = useState<string | null>(null)
  const [isExporting, setIsExporting] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const isMountedRef = useRef(true)
  const isExportingRef = useRef(false)
  const timeoutCancelsRef = useRef<Set<() => void>>(new Set())
  const copyingCancelRef = useRef<(() => void) | null>(null)

  const setOpenSafely = (nextOpen: boolean) => {
    if (!isMountedRef.current) return
    setOpen(nextOpen)
  }

  const setCopyingSafely = (nextCopying: string | null) => {
    if (!isMountedRef.current) return
    setCopying(nextCopying)
  }

  const showSnackbarSafely = (message: string, type: 'success' | 'warning' | 'error') => {
    if (!isMountedRef.current) return
    snackbar.show(message, type)
  }

  const scheduleTimeout = (callback: () => void, delay: number) => {
    let timeoutId: number | null = null
    const cancelTimeout = () => {
      if (timeoutId !== null) window.clearTimeout(timeoutId)
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
    copyingCancelRef.current = scheduleTimeout(() => {
      copyingCancelRef.current = null
      setCopyingSafely(null)
    }, 1500)
  }

  useEffect(() => {
    const handler = (event: MouseEvent) => {
      if (isExportingRef.current) return
      if (ref.current && !ref.current.contains(event.target as Node)) setOpenSafely(false)
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
    if (!isMountedRef.current) return
    setIsExporting(exporting)
  }

  const runExportAction = async (action: () => Promise<void> | void) => {
    if (isExportingRef.current) return

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
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = filename
    anchor.style.display = 'none'
    document.body.appendChild(anchor)
    anchor.click()
    scheduleTimeout(() => {
      URL.revokeObjectURL(url)
      anchor.remove()
    }, 100)
  }

  const closeDropdown = () => setOpenSafely(false)
  const toggleDropdown = () => {
    if (!isExportingRef.current) setOpenSafely(!open)
  }
  const copyFormat = (text: string, format: 'markdown' | 'text', filename: string, mime: string) =>
    copyExport({
      text,
      format,
      fallbackFilename: filename,
      fallbackMime: mime,
      isMounted: () => isMountedRef.current,
      setCopying: setCopyingSafely,
      showSnackbar: showSnackbarSafely,
      scheduleCopyingReset,
      closeDropdown,
      downloadFile,
    })

  const exportJson = () => {
    downloadFile(JSON.stringify({ results, code }, null, 2), 'merm8-check-results.json', 'application/json')
    closeDropdown()
  }
  const exportMarkdown = () => copyFormat(
    createMarkdownExport(results, emptyResultMessage),
    'markdown',
    'merm8-check-results.md',
    'text/markdown',
  )
  const exportText = () => copyFormat(
    createTextExport(results, emptyResultMessage),
    'text',
    'merm8-check-results.txt',
    'text/plain',
  )
  const exportSarif = () => exportSarifWithFallback({
    endpoint,
    code,
    results,
    enabledRules,
    rulesMetadata,
    isMounted: () => isMountedRef.current,
    closeDropdown,
    showSnackbar: showSnackbarSafely,
    downloadFile,
  })

  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-block' }}>
      <ExportDropdownMenu
        open={open}
        copying={copying}
        isExporting={isExporting}
        onToggleOpen={toggleDropdown}
        onClose={closeDropdown}
        onExportSarif={() => runExportAction(exportSarif)}
        onExportJson={() => runExportAction(exportJson)}
        onExportMarkdown={() => runExportAction(exportMarkdown)}
        onExportText={() => runExportAction(exportText)}
      />
    </div>
  )
}
