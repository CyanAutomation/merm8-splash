export function canonicalizeEndpoint(endpoint: string): string {
  const trimmedEndpoint = endpoint.trim()

  try {
    const url = new URL(trimmedEndpoint)
    url.protocol = url.protocol.toLowerCase()
    url.hostname = url.hostname.toLowerCase()

    if (!url.pathname.endsWith('/')) {
      url.pathname = `${url.pathname}/`
    }

    return url.toString()
  } catch {
    return trimmedEndpoint
  }
}
