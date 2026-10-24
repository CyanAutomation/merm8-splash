'use client'

import type { SemanticReviewFinding, SemanticReviewResponse } from '@/lib/api'
import { createCodeDiff, getReviewActions, getReviewItems, hasMixedReviewSignals } from '@/lib/semanticReview'
import { severityColor } from '@/lib/severity'
import type { CSSProperties } from 'react'
import Button from './Button'

interface SemanticReviewResultsProps {
  result: SemanticReviewResponse | null
  error: string | null
  isLoading: boolean
  code: string
  onBack: () => void
  onReviewAgain: () => void
  onJumpToLine?: (line: number) => void
  onApplySuggestedCode?: (code: string) => void
}

function percent(value: number): string {
  return `${Math.round(value * 100)}%`
}

function findingEvidenceLabel(evidence: SemanticReviewFinding['evidence'][number]): string | null {
  const parts = [
    evidence.nodeId ? `Node ${evidence.nodeId}` : null,
    evidence.label ? `“${evidence.label}”` : null,
    evidence.from && evidence.to ? `Connection ${evidence.from} → ${evidence.to}` : null,
  ].filter((part): part is string => Boolean(part))

  return parts.length > 0 ? parts.join(' · ') : evidence.line ? `Line ${evidence.line}` : null
}

function findingKey(finding: SemanticReviewFinding, index: number): string {
  return finding.id ?? `${finding.title}-${index}`
}

function sortFindings(findings: SemanticReviewFinding[]): SemanticReviewFinding[] {
  const priorityRank: Record<string, number> = { high: 0, medium: 1, low: 2 }

  return findings.slice().sort((left, right) =>
    (priorityRank[left.priority ?? ''] ?? 3) - (priorityRank[right.priority ?? ''] ?? 3)
  )
}

function SuggestedCode({
  finding,
  currentCode,
  onApply,
}: {
  finding: SemanticReviewFinding
  currentCode: string
  onApply?: (code: string) => void
}) {
  if (!finding.suggestedCode?.trim()) return null

  const diff = createCodeDiff(currentCode, finding.suggestedCode)
  const hasChanges = diff.some((line) => line.kind !== 'keep')

  return (
    <div className="semantic-review-code-change">
      <details>
        <summary>Preview suggested code change</summary>
        {hasChanges ? (
          <ol className="semantic-review-diff" aria-label="Suggested Mermaid code changes">
            {diff.map((line, index) => (
              <li key={`${line.kind}-${index}`} data-change={line.kind}>
                <span className="semantic-review-diff-kind">
                  {line.kind === 'remove' ? 'Remove' : line.kind === 'add' ? 'Add' : 'Keep'}
                </span>
                <code>{line.text || ' '}</code>
              </li>
            ))}
          </ol>
        ) : (
          <p className="semantic-review-note">The suggested code matches the current diagram.</p>
        )}
      </details>
      {hasChanges && onApply && (
        <Button size="small" onClick={() => onApply(finding.suggestedCode!)}>
          Apply suggested code
        </Button>
      )}
    </div>
  )
}

function ReviewFinding({
  finding,
  code,
  onJumpToLine,
  onApplySuggestedCode,
}: {
  finding: SemanticReviewFinding
  code: string
  onJumpToLine?: (line: number) => void
  onApplySuggestedCode?: (code: string) => void
}) {
  return (
    <li className="semantic-review-finding">
      <div className="semantic-review-finding-heading">
        <h4>{finding.title}</h4>
        {finding.priority && <span className="semantic-review-priority">{finding.priority} priority</span>}
      </div>
      <p>{finding.explanation}</p>
      {finding.evidence.length > 0 && (
        <div className="semantic-review-evidence">
          <div>Evidence:</div>
          <ul>
            {finding.evidence.map((evidence, evidenceIndex) => {
              const label = findingEvidenceLabel(evidence)
              if (!label) return null

              return (
                <li key={`${label}-${evidenceIndex}`}>
                  {label}
                  {evidence.line != null && onJumpToLine && (
                    <Button size="small" variant="quiet" onClick={() => onJumpToLine(evidence.line!)}>
                      Go to line {evidence.line}
                    </Button>
                  )}
                </li>
              )
            })}
          </ul>
        </div>
      )}
      {finding.suggestion && (
        <p className="semantic-review-suggestion"><strong>Suggested change:</strong> {finding.suggestion}</p>
      )}
      <SuggestedCode finding={finding} currentCode={code} onApply={onApplySuggestedCode} />
    </li>
  )
}

function RuleFindings({
  result,
  onJumpToLine,
}: {
  result: SemanticReviewResponse
  onJumpToLine?: (line: number) => void
}) {
  const results = Array.isArray(result.results) ? result.results : []
  const hasAnalysisData = result.valid !== undefined
    || result.lintSupported !== undefined
    || result.metrics !== undefined
    || results.length > 0

  if (!hasAnalysisData) return null

  return (
    <section className="semantic-rule-findings" aria-labelledby="semantic-rule-findings-title">
      <h3 id="semantic-rule-findings-title">Rule check</h3>
      {result.lintSupported === false ? (
        <p className="semantic-review-note">The diagram parsed, but this API doesn’t have rules for its diagram type.</p>
      ) : results.length === 0 ? (
        <p className="semantic-review-note">No rule issues were found in this review.</p>
      ) : (
        <ul>
          {results.map((issue, index) => (
            <li key={`${issue.rule_id}-${issue.line ?? ''}-${index}`}>
              <span
                className="severity-label"
                style={{ '--severity-color': severityColor(issue.severity) } as CSSProperties}
              >
                {issue.severity}
              </span>
              <strong>{issue.rule_id}:</strong> {issue.message}
              {issue.line != null && onJumpToLine && (
                <Button size="small" variant="quiet" onClick={() => onJumpToLine(issue.line!)}>
                  Go to line {issue.line}
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

export default function SemanticReviewResults({
  result,
  error,
  isLoading,
  code,
  onBack,
  onReviewAgain,
  onJumpToLine,
  onApplySuggestedCode,
}: SemanticReviewResultsProps) {
  const review = result?.['semantic-review']
  const isFlowchart = ['flowchart', 'flow-chart'].includes(
    (result?.metrics?.diagramType || result?.diagram_type || '').toLowerCase()
  )
  const hasBranching = isFlowchart && result?.metrics
    ? result.metrics.maxFanout > 1
    : undefined
  const reviewFindings = result?.['review-findings']
    ? sortFindings(result['review-findings'])
    : []

  return (
    <section aria-label="Diagram review results" style={{ padding: '12px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
        <h2 className="panel-heading" style={{ marginBottom: 0 }}>Diagram review</h2>
        <Button onClick={onBack}>Back to results</Button>
      </div>

      {error && <p role="alert" style={{ color: 'var(--color-error)', marginBottom: '12px' }}>{error}</p>}
      {isLoading && <p role="status" style={{ color: 'var(--color-text-secondary)', marginBottom: '12px' }}>Reviewing diagram…</p>}
      {!result && !error && !isLoading && (
        <p role="status" style={{ color: 'var(--color-text-secondary)', marginBottom: '12px' }}>
          The diagram has changed. Run a new review to see updated feedback.
        </p>
      )}

      {result && review && (
        <>
          <p className="semantic-review-intro">
            This is an AI review of clarity and meaning. Scores are model estimates; use the findings to guide a human review.
          </p>

          {hasMixedReviewSignals(review) && (
            <p className="semantic-review-mixed-signals" role="note">
              Mixed signals: the model detected ambiguity but selected no review priority. These are separate judgements; check the suggested actions before relying on the diagram.
            </p>
          )}

          <div className="semantic-review-score-grid">
            {getReviewItems(review, { hasBranching }).map((item) => (
              <div
                className="semantic-review-score"
                data-concern={item.isConcern}
                key={item.id}
              >
                <div className="semantic-review-score-label">{item.label}</div>
                <div className="semantic-review-score-value">{item.value}</div>
                {item.score != null && (
                  <div className="semantic-review-score-explanation">
                    {item.scoreLabel}: {percent(item.score)}
                  </div>
                )}
                {item.detail && <div className="semantic-review-score-explanation">{item.detail}</div>}
              </div>
            ))}
          </div>

          {reviewFindings.length > 0 ? (
            <section className="semantic-review-findings" aria-labelledby="semantic-review-findings-title">
              <h3 id="semantic-review-findings-title">Findings</h3>
              <ol>
                {reviewFindings.map((finding, index) => (
                  <ReviewFinding
                    finding={finding}
                    code={code}
                    onJumpToLine={onJumpToLine}
                    onApplySuggestedCode={(suggestedCode) => {
                      onApplySuggestedCode?.(suggestedCode)
                      onBack()
                    }}
                    key={findingKey(finding, index)}
                  />
                ))}
              </ol>
            </section>
          ) : (
            <section className="semantic-review-actions" aria-labelledby="semantic-review-actions-title">
              <h3 id="semantic-review-actions-title">Suggested checks</h3>
              <ul>
                {getReviewActions(review, { hasBranching }).map((action) => (
                  <li key={action.title}>
                    <strong>{action.title}:</strong> {action.description}
                  </li>
                ))}
              </ul>
            </section>
          )}

          <RuleFindings result={result} onJumpToLine={onJumpToLine} />

          <p className="semantic-review-model">Model: {result.meta.model}</p>
        </>
      )}

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '18px' }}>
        <Button variant="primary" onClick={onReviewAgain} disabled={isLoading}>
          {isLoading ? 'Reviewing…' : error ? 'Try again' : result ? 'Review again' : 'Review diagram'}
        </Button>
      </div>
    </section>
  )
}
