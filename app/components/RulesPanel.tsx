'use client'

import { useState } from 'react'
import { Rule, deriveDisplayName } from '@/lib/api'
import { getApplicableRules } from '@/lib/diagramTypes'
import { severityColor } from '@/lib/severity'

interface RulesPanelProps {
  rules: Rule[]
  enabledRules: string[]
  onToggleRule: (ruleId: string) => void
  onEnableAll: () => void
  onDisableAll: () => void
  isLoading: boolean
  isUnavailable: boolean
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
}: {
  collapsed: boolean
  badgeLabel: string
  displayedRuleCount: number
  onToggle: () => void
  onEnableAll: () => void
  onDisableAll: () => void
}) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: collapsed ? 0 : '8px',
        cursor: 'pointer',
      }}
      onClick={onToggle}
    >
      <div className="panel-heading" style={{ marginBottom: 0 }}>
        {collapsed ? '▸' : '▾'} Rules{' '}
        <span
          style={{
            background: 'var(--color-accent-primary)',
            color: 'var(--color-bg-primary)',
            padding: '0 8px',
            fontSize: '12px',
            borderRadius: '8px',
            marginLeft: '4px',
          }}
        >
          {badgeLabel}
        </span>
      </div>
      {!collapsed && displayedRuleCount > 0 && (
        <div style={{ display: 'flex', gap: '4px' }} onClick={(event) => event.stopPropagation()}>
          <button
            className="btn"
            style={{ fontSize: '12px', padding: '4px 12px' }}
            onClick={onEnableAll}
          >
            All visible
          </button>
          <button
            className="btn"
            style={{ fontSize: '12px', padding: '4px 12px' }}
            onClick={onDisableAll}
          >
            None visible
          </button>
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
    ? 'Analysis uses server defaults for linting.'
    : hasNoRulesForDiagramType
      ? `No lint rules are available for ${diagramType} diagrams on this API.`
      : displayedRuleCount > 0
        ? 'Analysis uses your selected rules.'
        : 'Connect and test API to fetch rules metadata.'

  return (
    <div style={{ color: 'var(--color-text-secondary)', fontSize: '12px', marginBottom: '8px' }}>
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
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: '8px',
        padding: '6px 0',
        borderBottom: '1px solid rgba(68,68,68,0.3)',
      }}
    >
      <input
        type="checkbox"
        id={`rule-${rule.id}`}
        checked={enabled}
        onChange={onToggle}
        style={{ marginTop: '2px', cursor: 'pointer', accentColor: 'var(--color-accent-primary)' }}
      />
      <label htmlFor={`rule-${rule.id}`} style={{ cursor: 'pointer', flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ fontSize: '12px', color: 'var(--color-text-primary)', fontWeight: 600 }}>
            {deriveDisplayName(rule.id)}
          </span>
          <span style={{ fontSize: '10px', color: 'var(--color-text-secondary)', fontFamily: 'monospace' }}>
            ({rule.id})
          </span>
          <span
            style={{
              fontSize: '12px',
              color,
              border: `1px solid ${color}`,
              padding: '2px 8px',
              borderRadius: '8px',
            }}
          >
            {rule.severity}
          </span>
        </div>
        <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
          {rule.description}
        </div>
      </label>
    </div>
  )
}

function RulesContent({
  isLoading,
  isUnavailable,
  displayedRules,
  enabledRules,
  onToggleRule,
  hasNoRulesForDiagramType,
  diagramType,
}: {
  isLoading: boolean
  isUnavailable: boolean
  displayedRules: Rule[]
  enabledRules: string[]
  onToggleRule: (ruleId: string) => void
  hasNoRulesForDiagramType: boolean
  diagramType: string | null
}) {
  let content
  if (isLoading) {
    content = <div style={{ color: 'var(--color-text-secondary)', fontSize: '12px', padding: '8px 0' }}>⠋ Loading rules...</div>
  } else if (isUnavailable) {
    content = <div style={{ color: 'var(--color-text-secondary)', fontSize: '12px', padding: '8px 0' }}>Rules metadata could not be loaded. Analysis can continue using the API&apos;s server defaults.</div>
  } else if (displayedRules.length === 0) {
    const message = hasNoRulesForDiagramType
      ? `No lint rules are available for ${diagramType} diagrams on this API.`
      : 'No rules loaded yet. Connect and test API to fetch rules metadata.'
    content = <div style={{ color: 'var(--color-text-secondary)', fontSize: '12px', padding: '8px 0' }}>{message}</div>
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

  return <div style={{ overflow: 'auto', maxHeight: '250px' }}>{content}</div>
}

export default function RulesPanel(props: RulesPanelProps) {
  const [collapsed, setCollapsed] = useState(false)
  const view = getRulesPanelView(props.rules, props.enabledRules, props.diagramType)
  const badgeLabel = props.isUnavailable
    ? 'Server defaults'
    : `${view.applicableEnabledCount}/${view.displayedRules.length}`

  return (
    <div className="panel" style={{ height: '100%' }}>
      <RulesPanelHeader
        collapsed={collapsed}
        badgeLabel={badgeLabel}
        displayedRuleCount={view.displayedRules.length}
        onToggle={() => setCollapsed(!collapsed)}
        onEnableAll={props.onEnableAll}
        onDisableAll={props.onDisableAll}
      />
      {!collapsed && !props.isLoading && (
        <RulesDescription
          isUnavailable={props.isUnavailable}
          hasNoRulesForDiagramType={view.hasNoRulesForDiagramType}
          displayedRuleCount={view.displayedRules.length}
          diagramType={props.diagramType}
        />
      )}
      {!collapsed && (
        <RulesContent
          isLoading={props.isLoading}
          isUnavailable={props.isUnavailable}
          displayedRules={view.displayedRules}
          enabledRules={props.enabledRules}
          onToggleRule={props.onToggleRule}
          hasNoRulesForDiagramType={view.hasNoRulesForDiagramType}
          diagramType={props.diagramType}
        />
      )}
    </div>
  )
}
