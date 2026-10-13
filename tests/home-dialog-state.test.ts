// @vitest-environment jsdom
import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, expect, it } from 'vitest'
import { useHomeDialogState } from '../app/useHomeDialogState'

let root: Root | null = null
let currentState: ReturnType<typeof useHomeDialogState> | null = null

function Harness() {
  currentState = useHomeDialogState()
  return null
}

function renderHarness() {
  const container = document.createElement('div')
  root = createRoot(container)
  act(() => root?.render(createElement(Harness)))
}

afterEach(() => {
  if (root) act(() => root?.unmount())
  root = null
  currentState = null
})

it('changes only the selected dialog visibility and toggles metrics separately', () => {
  renderHarness()

  const dialogTransitions = [
    {
      key: 'isResetConfirmationOpen',
      open: () => currentState?.openResetConfirmation(),
      close: () => currentState?.closeResetConfirmation(),
    },
    {
      key: 'isRulesOpen',
      open: () => currentState?.openRules(),
      close: () => currentState?.closeRules(),
    },
    {
      key: 'isApiConfigurationOpen',
      open: () => currentState?.openApiConfiguration(),
      close: () => currentState?.closeApiConfiguration(),
    },
    {
      key: 'isFullscreenOpen',
      open: () => currentState?.openFullscreen(),
      close: () => currentState?.closeFullscreen(),
    },
    {
      key: 'isSemanticReviewOpen',
      open: () => currentState?.openSemanticReview(),
      close: () => currentState?.closeSemanticReview(),
    },
  ] as const
  const dialogKeys = dialogTransitions.map(({ key }) => key)

  let openedKeys: (typeof dialogKeys)[number][] = []
  for (const { key, open } of dialogTransitions) {
    act(open)
    for (const dialogKey of dialogKeys) {
      expect(currentState?.[dialogKey]).toBe(openedKeys.includes(dialogKey) || dialogKey === key)
    }
    openedKeys = [...openedKeys, key]
  }

  for (const { key, close } of dialogTransitions) {
    act(close)
    openedKeys = openedKeys.filter((openedKey) => openedKey !== key)
    for (const dialogKey of dialogKeys) {
      expect(currentState?.[dialogKey]).toBe(openedKeys.includes(dialogKey))
    }
  }

  act(() => currentState?.toggleMetrics())
  expect(currentState?.showMetrics).toBe(true)
  expect(dialogKeys.every((key) => currentState?.[key] === false)).toBe(true)

  act(() => currentState?.toggleMetrics())
  expect(currentState?.showMetrics).toBe(false)
})
