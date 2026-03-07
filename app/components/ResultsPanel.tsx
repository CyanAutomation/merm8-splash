"use client";

import { useState, useRef, useImperativeHandle, forwardRef } from "react";
import { Violation } from "@/lib/api";

interface ResultsPanelProps {
  results: Violation[];
  isAnalyzing: boolean;
  analyzeError: string | null;
  onJumpToLine?: (line: number) => void;
}

export interface ResultsPanelRef {
  focus: () => void;
}

type SeverityFilter = "all" | "error" | "warning" | "info";

const severityColor = (severity: string) => {
  switch (severity) {
    case "error":
      return "var(--color-error)";
    case "warning":
      return "var(--color-warning)";
    default:
      return "var(--color-info)";
  }
};

const violationKey = (violation: Violation): string => {
  const { rule_id, severity, message, line, node_id } = violation;
  return [rule_id, severity, message, line ?? "", node_id ?? ""].join("::");
};

const ResultsPanel = forwardRef<ResultsPanelRef, ResultsPanelProps>(
  ({ results, isAnalyzing, analyzeError, onJumpToLine }, ref) => {
    const panelRef = useRef<HTMLDivElement>(null);
    const [filter, setFilter] = useState<SeverityFilter>("all");
    const [sortBy, setSortBy] = useState<"severity" | "line">("severity");
    const [copiedKey, setCopiedKey] = useState<string | null>(null);

    useImperativeHandle(ref, () => ({
      focus: () => panelRef.current?.focus(),
    }));

    const filtered = results
      .filter((v) => filter === "all" || v.severity === filter)
      .sort((a, b) => {
        if (sortBy === "line") return (a.line ?? 0) - (b.line ?? 0);
        const order = { error: 0, warning: 1, info: 2 };
        return (order[a.severity] ?? 3) - (order[b.severity] ?? 3);
      });

    const copyViolation = (v: Violation, key: string) => {
      const text = `[${v.severity}] ${v.rule_id}: ${v.message}${v.line ? ` (line ${v.line})` : ""}`;
      navigator.clipboard.writeText(text).then(() => {
        setCopiedKey(key);
        setTimeout(() => setCopiedKey(null), 1500);
      });
    };

    return (
      <div
        ref={panelRef}
        className="panel"
        tabIndex={-1}
        style={{
          height: "100%",
          display: "flex",
          flexDirection: "column",
          outline: "none",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "8px",
            flexWrap: "wrap",
            gap: "4px",
          }}
        >
          <div className="panel-title" style={{ marginBottom: 0 }}>
            ▦ Results{" "}
            {results.length > 0 && (
              <span
                style={{
                  background: results.some((r) => r.severity === "error")
                    ? "var(--color-error)"
                    : "var(--color-warning)",
                  color: "var(--color-bg-primary)",
                  padding: "0 6px",
                  fontSize: "10px",
                  borderRadius: "2px",
                  marginLeft: "4px",
                }}
              >
                {results.length}
              </span>
            )}
          </div>

          <div style={{ display: "flex", gap: "4px", flexWrap: "wrap" }}>
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value as SeverityFilter)}
              style={{
                background: "var(--color-bg-primary)",
                border: "1px solid var(--color-border)",
                color: "var(--color-text-secondary)",
                fontFamily: "var(--font-mono)",
                fontSize: "11px",
                padding: "2px 4px",
              }}
            >
              <option value="all">All</option>
              <option value="error">Error</option>
              <option value="warning">Warning</option>
              <option value="info">Info</option>
            </select>

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as "severity" | "line")}
              style={{
                background: "var(--color-bg-primary)",
                border: "1px solid var(--color-border)",
                color: "var(--color-text-secondary)",
                fontFamily: "var(--font-mono)",
                fontSize: "11px",
                padding: "2px 4px",
              }}
            >
              <option value="severity">Sort: Severity</option>
              <option value="line">Sort: Line</option>
            </select>
          </div>
        </div>

        <div style={{ flex: 1, overflow: "auto" }}>
          {isAnalyzing ? (
            <div
              style={{
                padding: "12px",
                color: "var(--color-accent-primary)",
                fontSize: "12px",
              }}
            >
              ⠋ Analyzing...
            </div>
          ) : analyzeError ? (
            <div
              style={{
                padding: "12px",
                color: "var(--color-error)",
                fontSize: "12px",
                border: "1px solid var(--color-error)",
              }}
            >
              ⚠ {analyzeError}
            </div>
          ) : filtered.length === 0 ? (
            <div
              style={{
                padding: "16px",
                color: "var(--color-success)",
                fontSize: "13px",
                textAlign: "center",
              }}
            >
              ✓ No violations found
            </div>
          ) : (
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                fontSize: "12px",
              }}
            >
              <thead>
                <tr
                  style={{
                    borderBottom: "1px solid var(--color-border)",
                    color: "var(--color-text-secondary)",
                    fontSize: "11px",
                    textAlign: "left",
                  }}
                >
                  <th style={{ padding: "4px 8px", whiteSpace: "nowrap" }}>
                    Rule
                  </th>
                  <th style={{ padding: "4px 8px" }}>Sev</th>
                  <th style={{ padding: "4px 8px", width: "100%" }}>Message</th>
                  <th style={{ padding: "4px 8px", whiteSpace: "nowrap" }}>
                    Line
                  </th>
                  <th style={{ padding: "4px 4px" }}></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((v) => {
                  const key = violationKey(v);

                  return (
                    <tr
                      key={key}
                      style={{
                        borderBottom: "1px solid rgba(68,68,68,0.3)",
                        cursor: v.line ? "pointer" : "default",
                      }}
                      onClick={() => v.line && onJumpToLine?.(v.line)}
                    >
                      <td
                        style={{
                          padding: "6px 8px",
                          color: "var(--color-accent-primary)",
                          whiteSpace: "nowrap",
                          fontWeight: 600,
                        }}
                      >
                        {v.rule_id}
                      </td>
                      <td style={{ padding: "6px 8px" }}>
                        <span
                          style={{
                            color: severityColor(v.severity),
                            border: `1px solid ${severityColor(v.severity)}`,
                            padding: "1px 4px",
                            fontSize: "10px",
                            borderRadius: "2px",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {v.severity}
                        </span>
                      </td>
                      <td
                        style={{
                          padding: "6px 8px",
                          color: "var(--color-text-primary)",
                        }}
                      >
                        {v.message}
                      </td>
                      <td
                        style={{
                          padding: "6px 8px",
                          color: "var(--color-text-secondary)",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {v.line ?? "—"}
                      </td>
                      <td style={{ padding: "6px 4px" }}>
                        <button
                          className="btn"
                          style={{ fontSize: "10px", padding: "1px 4px" }}
                          onClick={(e) => {
                            e.stopPropagation();
                            copyViolation(v, key);
                          }}
                          title="Copy"
                        >
                          {copiedKey === key ? "✓" : "⎘"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    );
  },
);

ResultsPanel.displayName = "ResultsPanel";
export default ResultsPanel;
