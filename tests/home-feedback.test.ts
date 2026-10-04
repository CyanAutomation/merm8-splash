import { expect, it } from 'vitest'
import {
  getConnectionNotice,
  getEndpointSaveNotice,
  getManualAnalysisNotice,
  getPendingEndpointNotice,
} from '../lib/homeFeedback'

it('maps connection state transitions to concise feedback', () => {
  expect(getConnectionNotice('checking', 'connected', '', 'Connected')).toEqual({
    message: 'Connection verified.',
    tone: 'success',
  })
  expect(getConnectionNotice('checking', 'error', '', 'Invalid endpoint URL')).toEqual({
    message: 'Invalid endpoint. Check URL format and try again.',
    tone: 'error',
  })
  const connectionFailure = 'Could not connect to the API endpoint. Check the URL, network connection, and server status.'
  expect(getConnectionNotice('checking', 'error', '', connectionFailure)).toEqual({
    message: connectionFailure,
    tone: 'error',
  })
  expect(getConnectionNotice('error', 'error', 'Old error', 'Old error')).toBeNull()
})

it('maps endpoint save outcomes to feedback', () => {
  expect(getEndpointSaveNotice('Saved to localStorage')).toEqual({ message: 'Endpoint saved.', tone: 'success' })
  expect(getEndpointSaveNotice('Invalid endpoint')).toEqual({ message: 'Save blocked: invalid endpoint.', tone: 'error' })
  expect(getEndpointSaveNotice('Could not save endpoint')).toEqual({ message: 'Save blocked in this browser context.', tone: 'error' })
  expect(getEndpointSaveNotice('')).toBeNull()
})

it('only resolves pending endpoint actions when the matching status changes', () => {
  expect(getPendingEndpointNotice('test-connection', 'checking', 'connected', '', 'Connected'))
    .toEqual({ message: 'Connection verified.', tone: 'success' })
  expect(getPendingEndpointNotice('test-connection', 'error', 'error', 'Same', 'Same')).toBeNull()
  expect(getPendingEndpointNotice('save-endpoint', 'disconnected', 'disconnected', 'Saving', 'Saved to localStorage'))
    .toEqual({ message: 'Endpoint saved.', tone: 'success' })
  expect(getPendingEndpointNotice('save-endpoint', 'disconnected', 'disconnected', 'Same', 'Same')).toBeNull()
  expect(getPendingEndpointNotice(null, 'checking', 'connected', '', 'Connected')).toBeNull()
})

it('formats completed manual analysis results and ignores non-manual runs', () => {
  expect(getManualAnalysisNotice({
    id: 1,
    source: 'manual',
    status: 'success',
    violationsCount: 2,
    error: null,
  })).toEqual({ message: 'Check complete: 2 violations', tone: 'success' })
  expect(getManualAnalysisNotice({
    id: 2,
    source: 'manual',
    status: 'error',
    violationsCount: 0,
    error: 'Request timed out',
  })).toEqual({ message: 'Check failed: Request timed out', tone: 'error' })
  expect(getManualAnalysisNotice({
    id: 3,
    source: 'input',
    status: 'success',
    violationsCount: 0,
    error: null,
  })).toBeNull()
})
