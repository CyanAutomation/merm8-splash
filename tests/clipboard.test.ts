import { afterEach, describe, expect, it, vi } from 'vitest'
import { copyTextWithFallback, copyTextWithMountedCompletion } from '../lib/clipboard'

interface TestTextarea {
  value: string
  style: Record<string, string>
  parentNode: { removeChild: (child: TestTextarea) => void } | null
  setAttribute: ReturnType<typeof vi.fn>
  select: ReturnType<typeof vi.fn>
}

function stubDocument(copyResult: boolean) {
  const textarea: TestTextarea = {
    value: '',
    style: {},
    parentNode: null,
    setAttribute: vi.fn(),
    select: vi.fn(),
  }
  const body = {
    appendChild: vi.fn((element: TestTextarea) => {
      textarea.parentNode = { removeChild: vi.fn(() => { textarea.parentNode = null }) }
      return element
    }),
  }
  const document = {
    body,
    createElement: vi.fn(() => textarea),
    execCommand: vi.fn(() => copyResult),
  }

  vi.stubGlobal('document', document)
  return { document, textarea }
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('clipboard helpers', () => {
  it('uses the clipboard API when it succeeds', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    const { document } = stubDocument(true)
    vi.stubGlobal('navigator', { clipboard: { writeText } })

    await expect(copyTextWithFallback('diagram')).resolves.toEqual({
      copied: true,
      clipboardAvailable: true,
      method: 'clipboard',
    })

    expect(writeText).toHaveBeenCalledWith('diagram')
    expect(document.createElement).not.toHaveBeenCalled()
  })

  it('falls back to a temporary textarea when the clipboard API rejects', async () => {
    const writeText = vi.fn().mockRejectedValue(new Error('denied'))
    const { document, textarea } = stubDocument(true)
    vi.stubGlobal('navigator', { clipboard: { writeText } })

    await expect(copyTextWithFallback('diagram')).resolves.toEqual({
      copied: true,
      clipboardAvailable: true,
      method: 'fallback',
    })

    expect(document.execCommand).toHaveBeenCalledWith('copy')
    expect(textarea.value).toBe('diagram')
    expect(textarea.parentNode).toBeNull()
  })

  it('uses the textarea fallback when the clipboard API is unavailable', async () => {
    const { document } = stubDocument(true)
    vi.stubGlobal('navigator', {})

    await expect(copyTextWithFallback('diagram')).resolves.toEqual({
      copied: true,
      clipboardAvailable: false,
      method: 'fallback',
    })

    expect(document.execCommand).toHaveBeenCalledWith('copy')
  })

  it('returns false when fallback copying fails and still removes the textarea', async () => {
    const { document, textarea } = stubDocument(false)
    vi.stubGlobal('navigator', {})

    await expect(copyTextWithFallback('diagram')).resolves.toEqual({
      copied: false,
      clipboardAvailable: false,
      method: 'fallback-failed',
    })

    expect(textarea.parentNode).toBeNull()
  })

  it('skips fallback work when the caller is no longer mounted', async () => {
    const writeText = vi.fn().mockRejectedValue(new Error('denied'))
    const { document } = stubDocument(true)
    vi.stubGlobal('navigator', { clipboard: { writeText } })

    await expect(copyTextWithFallback('diagram', () => false)).resolves.toEqual({
      copied: false,
      clipboardAvailable: true,
      method: 'fallback-skipped',
    })

    expect(document.createElement).not.toHaveBeenCalled()
  })

  it('delivers a completed copy only while the caller remains mounted', async () => {
    let resolveClipboard!: () => void
    const writeText = vi.fn(() => new Promise<void>((resolve) => {
      resolveClipboard = resolve
    }))
    vi.stubGlobal('navigator', { clipboard: { writeText } })

    let isMounted = true
    const onComplete = vi.fn()
    const copy = copyTextWithMountedCompletion('diagram', () => isMounted, onComplete)

    expect(writeText).toHaveBeenCalledWith('diagram')
    isMounted = false
    resolveClipboard()
    await copy

    expect(onComplete).not.toHaveBeenCalled()
  })

  it('delivers a completed copy result while the caller remains mounted', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('navigator', { clipboard: { writeText } })
    const onComplete = vi.fn()

    await copyTextWithMountedCompletion('diagram', () => true, onComplete)

    expect(onComplete).toHaveBeenCalledWith({
      copied: true,
      clipboardAvailable: true,
      method: 'clipboard',
    })
  })
})
