export interface CheckReadmeInput {
  readme: string
  packageJson: { scripts?: Record<string, string> }
  rootDir: string
}

export function checkReadme(input: CheckReadmeInput): string[]
