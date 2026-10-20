import { describe, expect, it } from 'vitest'
import {
  getValidationArguments,
  toolDefinitions,
  updateWorkflowToolPins,
} from '../scripts/update-workflow-tool-pins.mjs'

const workflow = [
  "actionlint_version='1.7.12'",
  `actionlint_sha256='${'a'.repeat(64)}'`,
  "zizmor_version='1.30.1'",
  `zizmor_sha256='${'b'.repeat(64)}'`,
].join('\n')

describe('updateWorkflowToolPins', () => {
  it('updates each analyzer version and checksum together', () => {
    const updated = updateWorkflowToolPins(workflow, {
      actionlint: { version: '1.8.0', sha256: 'c'.repeat(64) },
      zizmor: { version: '1.31.0', sha256: 'd'.repeat(64) },
    })

    expect(updated).toContain("actionlint_version='1.8.0'")
    expect(updated).toContain(`actionlint_sha256='${'c'.repeat(64)}'`)
    expect(updated).toContain("zizmor_version='1.31.0'")
    expect(updated).toContain(`zizmor_sha256='${'d'.repeat(64)}'`)
    expect(updated).not.toContain("actionlint_version='1.7.12'")
    expect(updated).not.toContain("zizmor_version='1.30.1'")
  })

  it('leaves the workflow unchanged when versions and checksums match', () => {
    expect(updateWorkflowToolPins(workflow, {
      actionlint: { version: '1.7.12', sha256: 'a'.repeat(64) },
      zizmor: { version: '1.30.1', sha256: 'b'.repeat(64) },
    })).toBe(workflow)
  })

  it('rejects invalid versions, checksums, and missing pin declarations', () => {
    expect(() => updateWorkflowToolPins(workflow, {
      actionlint: { version: 'latest', sha256: 'c'.repeat(64) },
      zizmor: { version: '1.31.0', sha256: 'd'.repeat(64) },
    })).toThrow(/Invalid actionlint release/)

    expect(() => updateWorkflowToolPins(workflow, {
      actionlint: { version: '1.8.0', sha256: 'not-a-sha256' },
      zizmor: { version: '1.31.0', sha256: 'd'.repeat(64) },
    })).toThrow(/Invalid actionlint release/)

    expect(() => updateWorkflowToolPins(workflow.replace("zizmor_version='1.30.1'\n", ''), {
      actionlint: { version: '1.8.0', sha256: 'c'.repeat(64) },
      zizmor: { version: '1.31.0', sha256: 'd'.repeat(64) },
    })).toThrow(/exactly one zizmor_version pin/)
  })
})

describe('analyzer workflow validation commands', () => {
  it('gets each analyzer command from its tool definition', () => {
    const workflowPaths = ['.github/workflows/ci.yml', '.github/workflows/main.yaml']
    const workflowDirectory = '/workspace/.github/workflows'

    expect(getValidationArguments(toolDefinitions[0], workflowPaths, workflowDirectory))
      .toEqual(workflowPaths)
    expect(getValidationArguments(toolDefinitions[1], workflowPaths, workflowDirectory))
      .toEqual(['--offline', workflowDirectory])
  })

  it('rejects tool definitions without explicit validation arguments', () => {
    expect(() => getValidationArguments(
      { name: 'future-tool', executable: 'future-tool' },
      [],
      '/workspace/.github/workflows',
    )).toThrow(/future-tool must define validateArgs/)
  })
})
