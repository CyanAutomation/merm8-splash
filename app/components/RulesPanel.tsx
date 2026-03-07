'use client'

import { useState } from 'react'
import { Rule } from '@/lib/api'

interface RulesPanelProps {
  rules: Rule[]
  enabledRules: string[]
  onRulesChange: (rules: string[]) => void
  isLoading: boolean
}

export default function RulesPanel({
  rules,
  enabledRules,
  onRulesChange,
  isLoading,
}: RulesPanelProps) {
  const [collapsed, setCollapsed] = useState(false)

  const toggleRule = (ruleId: string) => {
    if (enabledRules.includes(ruleId)) {
      onRulesChange(enabledRules.filter((r) => r !== ruleId))
    } else {
      onRulesChange([...enabledRules, ruleId])
    }
  }

  const enableAll = () => onRulesChange(rules.map((r) => r.id))
  const disableAll = () => onRulesChange([])

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
            {enabledRules.length}/{rules.length}
          </span>
        </div>
        {!collapsed && (
          <div style={{ display: 'flex', gap: '4px' }} onClick={(e) => e.stopPropagation()}>
            <button
              className="btn"
              style={{ fontSize: '12px', padding: '4px 12px' }}
              onClick={enableAll}
            >
              All
            </button>
            <button
              className="btn"
              style={{ fontSize: '12px', padding: '4px 12px' }}
              onClick={disableAll}
            >
              None
            </button>
          </div>
        )}
      </div>

      {!collapsed && (
        <div style={{ overflow: 'auto', maxHeight: '250px' }}>
          {isLoading ? (
            <div style={{ color: 'var(--color-text-secondary)', fontSize: '12px', padding: '8px 0' }}>
              ⠋ Loading rules...
            </div>
          ) : rules.length === 0 ? (
            <div style={{ color: 'var(--color-text-secondary)', fontSize: '12px', padding: '8px 0' }}>
              No rules loaded. Test API connection to fetch rules.
            </div>
          ) : (
            rules.map((rule) => (
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
                  onChange={() => toggleRule(rule.id)}
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
                      {rule.id}
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
