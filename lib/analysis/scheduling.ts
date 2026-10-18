const SMALL_EDIT_MAX_LENGTH = 160
const LARGE_DIAGRAM_MIN_LENGTH = 1_400
const LARGE_DIAGRAM_MIN_LINES = 70
const RAPID_INPUT_WINDOW_MS = 260

const TINY_EDIT_DEBOUNCE_MS = 250
const NORMAL_DEBOUNCE_MS = 550
const LARGE_DIAGRAM_DEBOUNCE_MS = 900

const NORMAL_IDLE_MIN_MS = 450
const LARGE_IDLE_MIN_MS = 1_000
const RAPID_INPUT_EXTRA_MS = 150
const RAPID_INPUT_EXTRA_MAX_MS = 450

export type AnalysisTriggerSource = 'input' | 'config'

function countLines(value: string): number {
  if (!value) return 0
  return value.split('\n').length
}

function getAdaptiveDebounceMs(newCode: string): { debounceMs: number; minIdleMs: number } {
  const trimmedLength = newCode.trim().length
  const lineCount = countLines(newCode)
  const isLargeDiagram =
    trimmedLength >= LARGE_DIAGRAM_MIN_LENGTH || lineCount >= LARGE_DIAGRAM_MIN_LINES

  if (isLargeDiagram) {
    return {
      debounceMs: LARGE_DIAGRAM_DEBOUNCE_MS,
      minIdleMs: LARGE_IDLE_MIN_MS,
    }
  }

  if (trimmedLength <= SMALL_EDIT_MAX_LENGTH) {
    return {
      debounceMs: TINY_EDIT_DEBOUNCE_MS,
      minIdleMs: 0,
    }
  }

  return {
    debounceMs: NORMAL_DEBOUNCE_MS,
    minIdleMs: NORMAL_IDLE_MIN_MS,
  }
}

export function getScheduledDelay(
  code: string,
  source: AnalysisTriggerSource,
  now: number,
  lastInputAt: number,
  rapidInputStreak: number
): { delayMs: number; lastInputAt: number; rapidInputStreak: number } {
  const { debounceMs, minIdleMs } = getAdaptiveDebounceMs(code)
  const baseDelayMs = Math.max(debounceMs, minIdleMs)
  if (source !== 'input') {
    return { delayMs: baseDelayMs, lastInputAt, rapidInputStreak: 0 }
  }

  const elapsedSinceLastInput = now - lastInputAt
  const isRapid = elapsedSinceLastInput > 0 && elapsedSinceLastInput <= RAPID_INPUT_WINDOW_MS
  const nextRapidInputStreak = isRapid ? rapidInputStreak + 1 : 0
  const rapidExtraMs = Math.min(
    nextRapidInputStreak * RAPID_INPUT_EXTRA_MS,
    RAPID_INPUT_EXTRA_MAX_MS
  )

  return {
    delayMs: Math.max(baseDelayMs + rapidExtraMs, minIdleMs),
    lastInputAt: now,
    rapidInputStreak: nextRapidInputStreak,
  }
}
