import type { ApiEndpointInfo, ApiEndpointSource, EndpointValidationResult } from '../api'

const DEFAULT_API_ENDPOINT = 'https://merm8.scheimann.workers.dev'

export const API_ENDPOINT_STORAGE_KEY = 'merm8_api_endpoint'

function normalizeHost(hostname: string): string {
  const lowerCased = hostname.toLowerCase().replace(/\.+$/g, '')
  const unbracketed = lowerCased.replace(/^\[/, '').replace(/\]$/, '')
  const decoded = (() => {
    try {
      return decodeURIComponent(unbracketed)
    } catch {
      return unbracketed
    }
  })()

  return decoded.split('%')[0]
}

interface Ipv4PartFormat {
  maxima: number[]
  weights: number[]
}

const IPV4_PART_FORMATS: Record<number, Ipv4PartFormat> = {
  1: { maxima: [0xffff_ffff], weights: [1] },
  2: { maxima: [0xff, 0xff_ff_ff], weights: [0x01_00_00_00, 1] },
  3: { maxima: [0xff, 0xff, 0xff_ff], weights: [0x01_00_00_00, 0x01_00_00, 1] },
  4: { maxima: [0xff, 0xff, 0xff, 0xff], weights: [0x01_00_00_00, 0x01_00_00, 0x01_00, 1] },
}

function parseIpv4Parts(parts: string[]): number[] | null {
  const format = IPV4_PART_FORMATS[parts.length]
  if (!format || parts.some((part) => !/^\d+$/.test(part))) return null

  const values = parts.map(Number)
  if (values.some((value, index) => value > format.maxima[index])) return null

  const address = values.reduce((total, value, index) => total + value * format.weights[index], 0)
  if (address > 0xffff_ffff) return null

  return [
    (address >>> 24) & 0xff,
    (address >>> 16) & 0xff,
    (address >>> 8) & 0xff,
    address & 0xff,
  ]
}

function parseIpv4(host: string): number[] | null {
  return parseIpv4Parts(host.split('.'))
}

function isPrivateOrLoopbackIpv4(host: string): boolean {
  const octets = parseIpv4(host)
  if (!octets) return false

  return isPrivateOrLoopbackIpv4Octets(octets)
}

interface Ipv4Range {
  name: string
  start: number
  end: number
}

function ipv4OctetsToInt(octets: number[]): number | null {
  if (octets.length !== 4) return null

  const [first, second, third, fourth] = octets

  return first * 0x01_00_00_00 + second * 0x01_00_00 + third * 0x01_00 + fourth
}

function ipv4CidrToRange(base: [number, number, number, number], prefixLength: number): Ipv4Range {
  const network = ipv4OctetsToInt(base)
  if (network === null || prefixLength < 0 || prefixLength > 32) {
    throw new Error('Invalid IPv4 CIDR range configuration')
  }

  const hostBits = 32 - prefixLength
  const mask = hostBits === 0 ? 0 : 2 ** hostBits - 1

  return {
    name: `${base.join('.')}/${prefixLength}`,
    start: network,
    end: network + mask,
  }
}

const NON_PUBLIC_IPV4_RANGES: Ipv4Range[] = [
  ipv4CidrToRange([0, 0, 0, 0], 8), // "this" network
  ipv4CidrToRange([10, 0, 0, 0], 8), // RFC1918
  ipv4CidrToRange([100, 64, 0, 0], 10), // Carrier-grade NAT
  ipv4CidrToRange([127, 0, 0, 0], 8), // Loopback
  ipv4CidrToRange([169, 254, 0, 0], 16), // Link-local
  ipv4CidrToRange([172, 16, 0, 0], 12), // RFC1918
  ipv4CidrToRange([192, 0, 0, 0], 24), // IETF protocol assignments
  ipv4CidrToRange([192, 0, 2, 0], 24), // TEST-NET-1
  ipv4CidrToRange([192, 88, 99, 0], 24), // Deprecated 6to4 relay anycast
  ipv4CidrToRange([192, 168, 0, 0], 16), // RFC1918
  ipv4CidrToRange([198, 18, 0, 0], 15), // Benchmarking
  ipv4CidrToRange([198, 51, 100, 0], 24), // TEST-NET-2
  ipv4CidrToRange([203, 0, 113, 0], 24), // TEST-NET-3
  ipv4CidrToRange([224, 0, 0, 0], 4), // Multicast
  ipv4CidrToRange([240, 0, 0, 0], 4), // Reserved + limited broadcast
]

function isPrivateOrLoopbackIpv4Octets(octets: number[]): boolean {
  const ipv4Int = ipv4OctetsToInt(octets)
  if (ipv4Int === null) return false

  return NON_PUBLIC_IPV4_RANGES.some((range) => ipv4Int >= range.start && ipv4Int <= range.end)
}

function expandEmbeddedIpv4(host: string): string | null {
  if (!host.includes('.')) return host

  const lastColonIndex = host.lastIndexOf(':')
  if (lastColonIndex === -1) return null

  const octets = parseIpv4(host.slice(lastColonIndex + 1))
  if (!octets) return null

  const highWord = ((octets[0] << 8) | octets[1]).toString(16)
  const lowWord = ((octets[2] << 8) | octets[3]).toString(16)
  return `${host.slice(0, lastColonIndex)}:${highWord}:${lowWord}`
}

interface Ipv6Sections {
  hasCompression: boolean
  leftParts: string[]
  rightParts: string[]
}

function splitIpv6Sections(host: string): Ipv6Sections | null {
  if (!host.includes(':')) return null

  const sections = host.split('::')
  if (sections.length > 2) return null

  return {
    hasCompression: sections.length === 2,
    leftParts: sections[0] ? sections[0].split(':').filter(Boolean) : [],
    rightParts: sections[1] ? sections[1].split(':').filter(Boolean) : [],
  }
}

function hasValidIpv6SegmentCount(hasCompression: boolean, totalParts: number): boolean {
  return hasCompression ? totalParts < 8 : totalParts === 8
}

function isIpv6Segment(segment: string): boolean {
  return /^[0-9a-f]{1,4}$/i.test(segment)
}

function expandIpv6Segments(host: string): string[] | null {
  const sections = splitIpv6Sections(host)
  if (!sections) return null

  const { hasCompression, leftParts, rightParts } = sections
  const totalParts = leftParts.length + rightParts.length
  if (!hasValidIpv6SegmentCount(hasCompression, totalParts)) return null

  const zeroParts = hasCompression ? Array(8 - totalParts).fill('0') : []
  const expandedParts = [...leftParts, ...zeroParts, ...rightParts]
  return expandedParts.length === 8 && expandedParts.every(isIpv6Segment)
    ? expandedParts
    : null
}

function parseIpv6ToBigInt(host: string): bigint | null {
  const normalizedHost = expandEmbeddedIpv4(host.toLowerCase())
  if (!normalizedHost) return null

  const expandedParts = expandIpv6Segments(normalizedHost)
  if (!expandedParts) return null

  return expandedParts.reduce(
    (value, part) => (value << BigInt(16)) + BigInt(parseInt(part, 16)),
    BigInt(0),
  )
}

function isPrivateOrLoopbackIpv6(host: string): boolean {
  const parsed = parseIpv6ToBigInt(host)
  if (parsed === null) return false

  const BIGINT_ONE = BigInt(1)
  const fe80Prefix = BigInt('0xfe800000000000000000000000000000')
  const fe80Mask = BigInt('0xffc00000000000000000000000000000')
  const fc00Prefix = BigInt('0xfc000000000000000000000000000000')
  const fc00Mask = BigInt('0xfe000000000000000000000000000000')

  if ((parsed & BigInt('0xffffffffffffffffffffffff00000000')) === BigInt('0x00000000000000000000ffff00000000')) {
    const embeddedIpv4 = Number(parsed & BigInt(0xffff_ffff))
    const octets = [
      (embeddedIpv4 >>> 24) & 0xff,
      (embeddedIpv4 >>> 16) & 0xff,
      (embeddedIpv4 >>> 8) & 0xff,
      embeddedIpv4 & 0xff,
    ]

    return isPrivateOrLoopbackIpv4Octets(octets)
  }

  return parsed === BIGINT_ONE || (parsed & fe80Mask) === fe80Prefix || (parsed & fc00Mask) === fc00Prefix
}

export function safeGetLocalStorage(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

export function safeSetLocalStorage(key: string, value: string): boolean {
  try {
    localStorage.setItem(key, value)
    return true
  } catch {
    return false
  }
}

/**
 * Resolve API endpoint precedence as:
 * 1) `?api=` query param when present and valid.
 * 2) `localStorage.merm8_api_endpoint` when present and valid.
 * 3) `NEXT_PUBLIC_MERM8_API_URL`.
 *
 * Invalid query-param values are ignored (with a warning) and resolution continues
 * through the remaining fallbacks.
 */
function getValidatedEndpoint(value: string): string | null {
  return value && validateApiEndpoint(value).valid ? value : null
}

interface ResolvedEndpoint {
  endpoint: string
  source: Exclude<ApiEndpointSource, 'default'>
}

function resolveUrlParameterEndpoint(params: URLSearchParams): ResolvedEndpoint | null {
  if (!params.has('api')) return null

  const endpoint = params.get('api') ?? ''
  const validatedEndpoint = getValidatedEndpoint(endpoint)
  if (validatedEndpoint) return { endpoint: validatedEndpoint, source: 'query-param' }

  console.warn('Invalid API endpoint from URL parameter, using default')
  return null
}

function resolveStoredEndpoint(): ResolvedEndpoint | null {
  const stored = safeGetLocalStorage(API_ENDPOINT_STORAGE_KEY)
  const validatedEndpoint = stored ? getValidatedEndpoint(stored) : null
  return validatedEndpoint ? { endpoint: validatedEndpoint, source: 'stored' } : null
}

function resolveBrowserEndpoint(): ResolvedEndpoint | null {
  if (typeof window === 'undefined') return null

  const params = new URLSearchParams(window.location.search)
  const parameterEndpoint = resolveUrlParameterEndpoint(params)
  if (parameterEndpoint) return parameterEndpoint

  return resolveStoredEndpoint()
}

function resolveEnvironmentEndpoint(): ResolvedEndpoint | null {
  const envValue = process.env.NEXT_PUBLIC_MERM8_API_URL ?? ''
  if (!envValue) return null

  const validatedEndpoint = getValidatedEndpoint(envValue)
  if (validatedEndpoint) return { endpoint: validatedEndpoint, source: 'environment' }

  console.warn('Invalid API endpoint from NEXT_PUBLIC_MERM8_API_URL, using default')
  return null
}

/**
 * Resolve the API endpoint and where it came from, following the precedence:
 * 1) `?api=` query param when present and valid.
 * 2) `localStorage.merm8_api_endpoint` when present and valid.
 * 3) `NEXT_PUBLIC_MERM8_API_URL`.
 * 4) The default endpoint.
 */
export function resolveApiEndpointInfo(): ApiEndpointInfo {
  return (
    resolveBrowserEndpoint() ??
    resolveEnvironmentEndpoint() ??
    { endpoint: DEFAULT_API_ENDPOINT, source: 'default' }
  )
}

export function resolveApiEndpoint(): string {
  return resolveApiEndpointInfo().endpoint
}

export function validateApiEndpoint(url: string): EndpointValidationResult {
  if (!url.trim()) {
    return { valid: false, message: 'Endpoint is required.' }
  }

  try {
    const parsed = new URL(url)

    if (parsed.username || parsed.password) {
      return { valid: false, message: 'Endpoint must not include credentials.' }
    }

    // Only allow http/https protocols
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return { valid: false, message: 'Endpoint must start with http:// or https://.' }
    }
    // Reject localhost and internal IPs in production
    if (process.env.NODE_ENV === 'production') {
      const normalizedHostname = normalizeHost(parsed.hostname)

      if (
        normalizedHostname === 'localhost' ||
        isPrivateOrLoopbackIpv4(normalizedHostname) ||
        isPrivateOrLoopbackIpv6(normalizedHostname)
      ) {
        return {
          valid: false,
          message: 'Local/private network endpoints are not allowed in production.',
        }
      }
    }
    return { valid: true }
  } catch {
    return { valid: false, message: `Enter a valid URL (example: ${DEFAULT_API_ENDPOINT}).` }
  }
}
