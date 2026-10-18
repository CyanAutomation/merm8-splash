import { describe, expect, it } from 'vitest'
import { getApiFailureMessage, type ApiFailureContext } from '../lib/api'

describe('getApiFailureMessage', () => {
  it.each([
    {
      name: 'semantic review authentication failures',
      context: 'semantic-review' as const,
      status: 401,
      expected: 'The API key is missing, expired, or invalid. Check the key and try again.',
    },
    {
      name: 'semantic review permission failures',
      context: 'semantic-review' as const,
      status: 403,
      expected: 'This API key is not authorized to use semantic review. Check its permissions.',
    },
    {
      name: 'connection authentication failures',
      context: 'connection' as const,
      status: 401,
      expected: 'The endpoint responded, but denied access to its health check (HTTP 401). Check its access settings.',
    },
    {
      name: 'analysis authorization failures',
      context: 'analysis' as const,
      status: 403,
      expected: 'The API denied this request (HTTP 403). Check API access settings.',
    },
    {
      name: 'analysis rate limits',
      context: 'analysis' as const,
      status: 429,
      expected: 'The API is rate-limiting requests. Wait a moment and try again.',
    },
    {
      name: 'connection rate limits',
      context: 'connection' as const,
      status: 429,
      expected: 'The endpoint is rate-limiting health checks. Wait a moment and try again.',
    },
    {
      name: 'semantic review rate limits',
      context: 'semantic-review' as const,
      status: 429,
      expected: 'Semantic review is temporarily rate-limited. Wait a moment and try again.',
    },
    {
      name: 'analysis server failures',
      context: 'analysis' as const,
      status: 503,
      expected: 'The API is temporarily unavailable (HTTP 503). Try again later.',
    },
    {
      name: 'connection server failures',
      context: 'connection' as const,
      status: 503,
      expected: 'The endpoint returned a server error (HTTP 503). Try again later.',
    },
    {
      name: 'semantic review server failures',
      context: 'semantic-review' as const,
      status: 503,
      expected: 'The semantic review service is temporarily unavailable (HTTP 503). Try again later.',
    },
    {
      name: 'connection route failures',
      context: 'connection' as const,
      status: 404,
      expected: 'The endpoint responded, but its health check route was not found (HTTP 404). Check that the URL points to a compatible merm8 API.',
    },
    {
      name: 'semantic review route failures',
      context: 'semantic-review' as const,
      status: 404,
      expected: 'This endpoint does not provide semantic review (HTTP 404). Check that the URL points to a compatible API.',
    },
    {
      name: 'other connection client errors',
      context: 'connection' as const,
      status: 422,
      expected: 'The endpoint responded with HTTP 422 during its health check. Check the endpoint and its access settings.',
    },
  ])('preserves $name', ({ context, status, expected }) => {
    expect(getApiFailureMessage({ status }, context)).toBe(expected)
  })

  it.each([
    ['analysis', 'Analysis timed out while waiting for the API. Check the endpoint and try again.'],
    ['connection', 'The API endpoint did not respond within 10 seconds. Check its URL and server status.'],
    ['semantic-review', 'Semantic review timed out while waiting for the API. Check the endpoint and try again.'],
  ] satisfies Array<[ApiFailureContext, string]>)('returns the %s timeout guidance', (context, expected) => {
    expect(getApiFailureMessage({ name: 'TimeoutError' }, context)).toBe(expected)
  })

  it.each([
    ['analysis', 'Could not connect to the API endpoint. Check the URL, network connection, and server status.'],
    ['connection', 'Could not connect to the API endpoint. Check the URL, network connection, and server status.'],
    ['semantic-review', 'Could not connect to the API for semantic review. Check your network connection and API endpoint, then try again.'],
  ] satisfies Array<[ApiFailureContext, string]>)('returns the %s network guidance', (context, expected) => {
    expect(getApiFailureMessage({ name: 'TypeError', message: 'Failed to fetch' }, context)).toBe(expected)
  })

  it('uses the health-check fallback only for connection errors', () => {
    const error = { message: 'API health check failed: expected status "ok".' }

    expect(getApiFailureMessage(error, 'connection'))
      .toBe('The endpoint responded, but returned an unexpected health check response. Check that the URL points to a compatible merm8 API.')
    expect(getApiFailureMessage(error, 'analysis')).toBeNull()
  })

  it.each([
    ['60', 'Semantic review is temporarily rate-limited. Try again in 60 seconds.'],
    ['1', 'Semantic review is temporarily rate-limited. Try again in 1 second.'],
  ])('shows the semantic review retry delay when the API provides %s seconds', (retryAfter, expected) => {
    expect(getApiFailureMessage({ status: 429, headers: new Headers({ 'retry-after': retryAfter }) }, 'semantic-review'))
      .toBe(expected)
  })

  it('returns null for errors without a known recovery message', () => {
    expect(getApiFailureMessage(new Error('Unexpected response'))).toBeNull()
  })
})
