'use client'

import { useState } from 'react'
import type { CSSProperties } from 'react'
import { Rule, deriveDisplayName } from '@/lib/api'
import { getApplicableRules } from '@/lib/diagramTypes'
import { severityColor } from '@/lib/severity'
import Button from './Button'

interface RulesPanelProps {
  rules: Rule[]
  enabledRules: string[]
  onToggleRule: (ruleId: string) => void
  onEnableAll: () => void
  onDisableAll: () => void
  isLoading: boolean
  isUnavailable: boolean
  rulesReady?: boolean
  diagramType: string | null
}

interface RulesPanelView {
  displayedRules: Rule[]
  applicableEnabledCount: number
  hasNoRulesForDiagramType: boolean
}

function getRulesPanelView(rules: Rule[], enabledRules: string[], diagramType: string | null): RulesPanelView {
  const applicableRuleIds = getApplicableRules(diagramType, rules.map((rule) => rule.id))
  const displayedRules = rules.filter((rule) => applicableRuleIds.has(rule.id))
  const applicableEnabledCount = enabledRules.filter((id) => applicableRuleIds.has(id)).length

  return {
    displayedRules,
    applicableEnabledCount,
    hasNoRulesForDiagramType: Boolean(diagramType && rules.length > 0 && displayedRules.length === 0),
  }
}

function RulesPanelHeader({
  collapsed,
  badgeLabel,
  displayedRuleCount,
  onToggle,
  onEnableAll,
  onDisableAll,
  isLoading,
  isUnavailable,
}: {
  collapsed: boolean
  badgeLabel: string
  displayedRuleCount: number
  onToggle: () => void
  onEnableAll: () => void
  onDisableAll: () => void
  isLoading: boolean
  isUnavailable: boolean
}) {
  return (
    <div className="rules-panel-header">
      <Button
        variant="quiet"
        className="rules-panel-toggle"
        aria-expanded={!collapsed}
        aria-controls="rules-content"
        onClick={onToggle}
      >
        <span className="panel-heading">Rules</span>
        <span className="rules-count">{badgeLabel}</span>
      </Button>
      {!collapsed && !isLoading && !isUnavailable && displayedRuleCount > 0 && (
        <div className="rules-panel-actions">
          <Button onClick={onEnableAll}>Enable all</Button>
          <Button onClick={onDisableAll}>Disable all</Button>
        </div>
      )}
    </div>
  )
}

function RulesDescription({
  isUnavailable,
  hasNoRulesForDiagramType,
  displayedRuleCount,
  diagramType,
}: {
  isUnavailable: boolean
  hasNoRulesForDiagramType: boolean
  displayedRuleCount: number
  diagramType: string | null
}) {
  const message = isUnavailable
    ? 'Checks use the API’s default rules.'
    : hasNoRulesForDiagramType
      ? `No checks are available for ${diagramType} diagrams.`
      : displayedRuleCount > 0
        ? 'Checks use the rules you’ve selected.'
        : 'Test the API connection to load rules.'

  return (
    <div className="rules-description">
      {message}
    </div>
  )
}

function RuleRow({ rule, enabled, onToggle }: {
  rule: Rule
  enabled: boolean
  onToggle: () => void
}) {
  const color = severityColor(rule.severity)

  return (
    <div className="rule-row">
      <input
        type="checkbox"
        id={`rule-${rule.id}`}
        checked={enabled}
        onChange={onToggle}
        className="rule-checkbox"
      />
      <label htmlFor={`rule-${rule.id}`} className="rule-label">
        <div className="rule-name-row">
          <span className="rule-name">
            {deriveDisplayName(rule.id)}
          </span>
          <span className="rule-id">
            ({rule.id})
          </span>
          <span className="rule-severity" style={{ '--severity-color': color } as CSSProperties}>
            {rule.severity}
          </span>
        </div>
        <div className="rule-description">
          {rule.description}
        </div>
      </label>
    </div>
  )
}

function RulesContent({
  isLoading,
  isUnavailable,
  rulesReady,
  displayedRules,
  enabledRules,
  onToggleRule,
  hasNoRulesForDiagramType,
  diagramType,
}: {
  isLoading: boolean
  isUnavailable: boolean
  rulesReady: boolean
  displayedRules: Rule[]
  enabledRules: string[]
  onToggleRule: (ruleId: string) => void
  hasNoRulesForDiagramType: boolean
  diagramType: string | null
}) {
  let content
  if (isLoading) {
    content = <div className="rules-empty-state" role="status">Loading rules…</div>
  } else if (isUnavailable) {
    content = <div className="rules-empty-state">We couldn’t load the rules. Checks can still use the API’s defaults.</div>
  } else if (!rulesReady) {
    content = <div className="rules-empty-state">Test API to load rules.</div>
  } else if (displayedRules.length === 0) {
    const message = hasNoRulesForDiagramType
      ? `No rules are available for ${diagramType} diagrams.`
      : 'The API hasn’t provided any rules for this diagram type.'
    content = <div className="rules-empty-state">{message}</div>
  } else {
    content = displayedRules.map((rule) => (
      <RuleRow
        key={rule.id}
        rule={rule}
        enabled={enabledRules.includes(rule.id)}
        onToggle={() => onToggleRule(rule.id)}
      />
    ))
  }

  return <div className="rules-list">{content}</div>
}

export default function RulesPanel(props: RulesPanelProps) {
  const [collapsed, setCollapsed] = useState(false)
  const rulesReady = props.rulesReady ?? props.rules.length > 0
  const view = getRulesPanelView(props.rules, props.enabledRules, props.diagramType)
  const badgeLabel = props.isUnavailable
    ? 'Server defaults'
    : props.isLoading
      ? 'Loading…'
      : !rulesReady
        ? 'Not loaded'
        : view.displayedRules.length === 0
          ? 'No rules'
          : `${view.applicableEnabledCount}/${view.displayedRules.length}`

  return (
    <div className="panel rules-panel">
      <RulesPanelHeader
        collapsed={collapsed}
        badgeLabel={badgeLabel}
        displayedRuleCount={view.displayedRules.length}
        onToggle={() => setCollapsed(!collapsed)}
        onEnableAll={props.onEnableAll}
        onDisableAll={props.onDisableAll}
        isLoading={props.isLoading}
        isUnavailable={props.isUnavailable}
      />
      <div id="rules-content" hidden={collapsed}>
        {!props.isLoading && (view.displayedRules.length > 0 || props.isUnavailable) && (
          <RulesDescription
            isUnavailable={props.isUnavailable}
            hasNoRulesForDiagramType={view.hasNoRulesForDiagramType}
            displayedRuleCount={view.displayedRules.length}
            diagramType={props.diagramType}
          />
        )}
        <RulesContent
          isLoading={props.isLoading}
          isUnavailable={props.isUnavailable}
          rulesReady={rulesReady}
          displayedRules={view.displayedRules}
          enabledRules={props.enabledRules}
          onToggleRule={props.onToggleRule}
          hasNoRulesForDiagramType={view.hasNoRulesForDiagramType}
          diagramType={props.diagramType}
        />
      </div>
    </div>
  )
}
