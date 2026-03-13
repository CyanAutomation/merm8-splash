'use client'

import { useState } from 'react'
import { Rule, deriveDisplayName } from '@/lib/api'
import { getApplicableRules } from '@/lib/diagramTypes'

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

export default function RulesPanel({
  rules,
  enabledRules,
  onToggleRule,
  onEnableAll,
  onDisableAll,
  isLoading,
  isUnavailable,
  diagramType,
}: RulesPanelProps) {
  const [collapsed, setCollapsed] = useState(false)

  // Filter rules to only show those applicable to the detected diagram type
  const allRuleIds = rules.map((r) => r.id)
  const applicableRuleIds = getApplicableRules(diagramType, allRuleIds)
  const displayedRules = rules.filter((rule) => applicableRuleIds.has(rule.id))
  const applicableEnabledRules = enabledRules.filter((id) => applicableRuleIds.has(id))
  const rulesBadgeLabel = isUnavailable
    ? 'Server defaults'
    : `${applicableEnabledRules.length}/${displayedRules.length}`

  const severityColor = (severity: string) => {
    switch (severity) {
      case 'error': return 'var(--color-error)'
      case 'warning': return 'var(--color-warning)'
      default: return 'var(--color-info)'
    }
  }

  return (
    <div className="panel" style={{ height: '100%' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: collapsed ? 0 : '8px',
          cursor: 'pointer',
        }}
        onClick={() => setCollapsed(!collapsed)}
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
            {rulesBadgeLabel}
          </span>
        </div>
        {!collapsed && (
          <div style={{ display: 'flex', gap: '4px' }} onClick={(e) => e.stopPropagation()}>
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


      {!collapsed && !isLoading && (
        <div style={{ color: 'var(--color-text-secondary)', fontSize: '12px', marginBottom: '8px' }}>
          {isUnavailable
            ? 'Analysis uses server defaults for linting.'
            : displayedRules.length > 0
              ? 'Analysis uses your selected rules.'
              : 'Connect and test API to fetch rules metadata.'}
        </div>
      )}

      {!collapsed && (
        <div style={{ overflow: 'auto', maxHeight: '250px' }}>
          {isLoading ? (
            <div style={{ color: 'var(--color-text-secondary)', fontSize: '12px', padding: '8px 0' }}>
              ⠋ Loading rules...
            </div>
          ) : isUnavailable ? (
            <div style={{ color: 'var(--color-text-secondary)', fontSize: '12px', padding: '8px 0' }}>
              Rules metadata unavailable for this API endpoint.
            </div>
          ) : displayedRules.length === 0 ? (
            <div style={{ color: 'var(--color-text-secondary)', fontSize: '12px', padding: '8px 0' }}>
              No rules loaded yet. Connect and test API to fetch rules metadata.
            </div>
          ) : (
            displayedRules.map((rule) => (
              <div
                key={rule.id}
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
                  checked={enabledRules.includes(rule.id)}
                  onChange={() => onToggleRule(rule.id)}
                  style={{ marginTop: '2px', cursor: 'pointer', accentColor: 'var(--color-accent-primary)' }}
                />
                <label
                  htmlFor={`rule-${rule.id}`}
                  style={{ cursor: 'pointer', flex: 1 }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span
                      style={{
                        fontSize: '12px',
                        color: 'var(--color-text-primary)',
                        fontWeight: 600,
                      }}
                    >
                      {deriveDisplayName(rule.id)}
                    </span>
                    <span
                      style={{
                        fontSize: '10px',
                        color: 'var(--color-text-secondary)',
                        fontFamily: 'monospace',
                      }}
                    >
                      ({rule.id})
                    </span>
                    <span
                      style={{
                        fontSize: '12px',
                        color: severityColor(rule.severity),
                        border: `1px solid ${severityColor(rule.severity)}`,
                        padding: '2px 8px',
                        borderRadius: '8px',
                      }}
                    >
                      {rule.severity}
                    </span>
                  </div>
                  <div
                    style={{
                      fontSize: '12px',
                      color: 'var(--color-text-secondary)',
                      marginTop: '2px',
                    }}
                  >
                    {rule.description}
                  </div>
                </label>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}
