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

it('opens and closes each dialog independently', () => {
  renderHarness()

  expect(currentState).toMatchObject({
    isResetConfirmationOpen: false,
    isRulesOpen: false,
    isApiConfigurationOpen: false,
    isFullscreenOpen: false,
    isSemanticReviewOpen: false,
    showMetrics: false,
  })

  act(() => currentState?.openApiConfiguration())
  act(() => currentState?.openRules())
  act(() => currentState?.openFullscreen())
  act(() => currentState?.openSemanticReview())
  act(() => currentState?.openResetConfirmation())
  act(() => currentState?.toggleMetrics())

  expect(currentState).toMatchObject({
    isResetConfirmationOpen: true,
    isRulesOpen: true,
    isApiConfigurationOpen: true,
    isFullscreenOpen: true,
    isSemanticReviewOpen: true,
    showMetrics: true,
  })

  act(() => currentState?.closeApiConfiguration())
  act(() => currentState?.closeRules())
  act(() => currentState?.closeFullscreen())
  act(() => currentState?.closeSemanticReview())
  act(() => currentState?.closeResetConfirmation())
  act(() => currentState?.toggleMetrics())

  expect(currentState).toMatchObject({
    isResetConfirmationOpen: false,
    isRulesOpen: false,
    isApiConfigurationOpen: false,
    isFullscreenOpen: false,
    isSemanticReviewOpen: false,
    showMetrics: false,
  })
})
