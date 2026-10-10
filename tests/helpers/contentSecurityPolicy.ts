export function parseContentSecurityPolicy(policy: string): Record<string, string[]> {
  const directives: Record<string, string[]> = {}

  for (const section of policy.split(';').filter((part) => part.trim())) {
    const [name, ...sources] = section.trim().split(/\s+/)
    if (!name || sources.length === 0 || Object.hasOwn(directives, name)) {
      throw new Error(`Invalid or duplicate Content-Security-Policy directive: ${section}`)
    }
    directives[name] = sources
  }

  return directives
}
