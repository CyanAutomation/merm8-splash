export type CopyTextMethod = 'clipboard' | 'fallback' | 'fallback-failed' | 'fallback-skipped'

export interface CopyTextResult {
  copied: boolean
  clipboardAvailable: boolean
  method: CopyTextMethod
}

export async function copyTextWithFallback(
  text: string,
  canUseFallback: () => boolean = () => true
): Promise<CopyTextResult> {
  const clipboard = typeof navigator === 'undefined' ? undefined : navigator.clipboard
  const clipboardAvailable = typeof clipboard?.writeText === 'function'

  if (clipboardAvailable) {
    try {
      await clipboard.writeText(text)
      return { copied: true, clipboardAvailable, method: 'clipboard' }
    } catch {
      // Continue with the legacy textarea path when browser clipboard access is denied.
    }
  }

  if (!canUseFallback()) {
    return { copied: false, clipboardAvailable, method: 'fallback-skipped' }
  }

  const copied = fallbackCopyWithTextarea(text)
  return {
    copied,
    clipboardAvailable,
    method: copied ? 'fallback' : 'fallback-failed',
  }
}

export async function copyTextWithMountedCompletion(
  text: string,
  isMounted: () => boolean,
  onComplete: (result: CopyTextResult) => void
): Promise<void> {
  const result = await copyTextWithFallback(text, isMounted)
  if (!isMounted()) return
  onComplete(result)
}

function fallbackCopyWithTextarea(text: string): boolean {
  if (typeof document === 'undefined') {
    return false
  }

  let textarea: HTMLTextAreaElement | null = null
  try {
    textarea = document.createElement('textarea')
    textarea.value = text
    textarea.setAttribute('readonly', '')
    textarea.style.position = 'fixed'
    textarea.style.opacity = '0'
    textarea.style.left = '-9999px'
    document.body.appendChild(textarea)
    textarea.select()
    return document.execCommand('copy')
  } catch {
    return false
  } finally {
    textarea?.parentNode?.removeChild(textarea)
  }
}
