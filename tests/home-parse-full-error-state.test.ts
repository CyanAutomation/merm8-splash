// @vitest-environment jsdom
import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it } from 'vitest'
import { useHomeParseState } from '../app/useHomePageState'

let root: Root | null = null
let container: HTMLDivElement

function ParseStateHarness() {
  const { parseErrorFullDetail, onParseStateChange } = useHomeParseState()

  return createElement('div', null,
    createElement('output', { 'data-testid': 'full-error' }, parseErrorFullDetail ?? ''),
    createElement('button', {
      onClick: () => onParseStateChange({
        hasParseError: true,
        message: 'Unexpected token',
        fullMessage: 'Unexpected token\nParse error on line 7\nParser trace',
      }),
    }, 'Report syntax error'),
  )
}

beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(() => {
  if (root) act(() => root?.unmount())
  root = null
  container.remove()
  vi.unstubAllGlobals()
})

it('retains full parser details for the fullscreen preview', () => {
  act(() => root?.render(createElement(ParseStateHarness)))

  const reportErrorButton = container.querySelector('button') as HTMLButtonElement
  act(() => reportErrorButton.click())

  expect(container.querySelector('[data-testid="full-error"]')?.textContent)
    .toBe('Unexpected token\nParse error on line 7\nParser trace')
})
