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

type DialogKey = (typeof dialogTransitions)[number]['key']
const dialogKeys = dialogTransitions.map(({ key }) => key)

function expectDialogVisibility(openedKeys: readonly DialogKey[]) {
  for (const dialogKey of dialogKeys) {
    expect(currentState?.[dialogKey]).toBe(openedKeys.includes(dialogKey))
  }
}

function getAnotherDialog(key: DialogKey) {
  return dialogTransitions.find((transition) => transition.key !== key) ?? dialogTransitions[0]
}

it.each(dialogTransitions)('opens $key without changing another dialog', ({ key, open }) => {
  renderHarness()
  const preservedDialog = getAnotherDialog(key)
  act(preservedDialog.open)
  act(open)

  expectDialogVisibility([preservedDialog.key, key])
})

it.each(dialogTransitions)('closes $key without changing other dialogs', ({ key, close }) => {
  renderHarness()
  act(() => dialogTransitions.forEach(({ open }) => open()))
  act(close)

  expectDialogVisibility(dialogKeys.filter((dialogKey) => dialogKey !== key))
})

it('toggles metrics independently from dialog visibility', () => {
  renderHarness()

  act(() => currentState?.toggleMetrics())
  expect(currentState?.showMetrics).toBe(true)
  expectDialogVisibility([])

  act(() => currentState?.toggleMetrics())
  expect(currentState?.showMetrics).toBe(false)
})
