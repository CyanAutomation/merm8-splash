import { expect, it } from 'vitest'
import { getCheckActionState } from '../lib/checkAction'

const base = {
  endpoint: 'https://api.example.test',
  connectionStatus: 'connected' as const,
  resultState: 'ready' as const,
  isAnalyzing: false,
  canRecheck: true,
}

it('uses setup and connection actions until the endpoint is ready', () => {
  expect(getCheckActionState({ ...base, endpoint: '', connectionStatus: 'disconnected' })).toMatchObject({
    kind: 'setup',
    label: 'Set up API',
    disabled: false,
    busy: false,
  })
  expect(getCheckActionState({ ...base, connectionStatus: 'error' })).toMatchObject({
    kind: 'test',
    label: 'Test API',
    disabled: false,
    busy: false,
  })
  expect(getCheckActionState({ ...base, connectionStatus: 'checking' })).toMatchObject({
    kind: 'test',
    label: 'Testing…',
    disabled: true,
    busy: true,
  })
})

it('uses check loading and disabled states after the API connects', () => {
  expect(getCheckActionState({ ...base, resultState: 'loading-rules', canRecheck: false })).toMatchObject({
    kind: 'run',
    label: 'Loading rules…',
    disabled: true,
    busy: true,
  })
  expect(getCheckActionState({ ...base, isAnalyzing: true, resultState: 'loading-rules' })).toMatchObject({
    kind: 'run',
    label: 'Checking…',
    busy: true,
  })
  expect(getCheckActionState({ ...base, canRecheck: false })).toMatchObject({
    kind: 'run',
    label: 'Run check',
    disabled: true,
    busy: false,
  })
})
