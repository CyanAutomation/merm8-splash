"use client";

import { useState, useRef, useImperativeHandle, forwardRef, useEffect } from "react";
import { Violation } from "@/lib/api";
import Modal from "./Modal";

interface ResultsPanelProps {
  results: Violation[];
  isAnalyzing: boolean;
  analyzeError: string | null;
  analysisHints: string[];
  parseError?: string | null;
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

const violationKey = (violation: Violation, index: number): string => {
  const { rule_id, severity, message, line, node_id } = violation;
  return [rule_id, severity, message, line ?? "", node_id ?? "", index].join("::");
};

const hintedLine = (hint: string): number | null => {
  const match = hint.match(/\bat line (\d+)\b/i) || hint.match(/\bline (\d+)\b/i);
  if (!match) {
    return null;
  }

  const line = Number(match[1]);
  return Number.isFinite(line) && line > 0 ? line : null;
};

const ResultsPanel = forwardRef<ResultsPanelRef, ResultsPanelProps>(
  ({ results, isAnalyzing, analyzeError, analysisHints, parseError, onJumpToLine }, ref) => {
    const panelRef = useRef<HTMLDivElement>(null);
    const [filter, setFilter] = useState<SeverityFilter>("all");
    const [sortBy, setSortBy] = useState<"severity" | "line">("severity");
    const [showFilterModal, setShowFilterModal] = useState(false);
    const [copiedKey, setCopiedKey] = useState<string | null>(null);
    const [copyErrorKey, setCopyErrorKey] = useState<string | null>(null);
    const copiedTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const copyErrorTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(
      () => () => {
        if (copiedTimeoutRef.current) {
          clearTimeout(copiedTimeoutRef.current);
        }
        if (copyErrorTimeoutRef.current) {
          clearTimeout(copyErrorTimeoutRef.current);
        }
      },
      [],
    );

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

    const fallbackCopyWithTextarea = (text: string): boolean => {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.setAttribute("readonly", "");
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      textarea.style.left = "-9999px";
      document.body.appendChild(textarea);
      textarea.select();

      let success = false;
      try {
        success = document.execCommand("copy");
      } catch {
        success = false;
      } finally {
        if (textarea.parentNode) {
          textarea.parentNode.removeChild(textarea);
        }
      }

      return success;
    };

    const copyViolation = async (v: Violation, key: string) => {
      const text = `[${v.severity}] ${v.rule_id}: ${v.message}${v.line != null ? ` (line ${v.line})` : ""}`;

      const hasClipboardApi = typeof navigator !== "undefined" && !!navigator.clipboard?.writeText;
      let copied = false;

      if (hasClipboardApi) {
        try {
          await navigator.clipboard.writeText(text);
          copied = true;
        } catch {
          copied = fallbackCopyWithTextarea(text);
        }
      } else {
        copied = fallbackCopyWithTextarea(text);
      }

      if (copied) {
        if (copiedTimeoutRef.current) {
          clearTimeout(copiedTimeoutRef.current);
        }
        if (copyErrorTimeoutRef.current) {
          clearTimeout(copyErrorTimeoutRef.current);
          copyErrorTimeoutRef.current = null;
        }

        setCopiedKey(key);
        setCopyErrorKey(null);
        copiedTimeoutRef.current = setTimeout(() => {
          setCopiedKey((current) => (current === key ? null : current));
          copiedTimeoutRef.current = null;
        }, 1500);
        return;
      }

      if (copiedTimeoutRef.current) {
        clearTimeout(copiedTimeoutRef.current);
        copiedTimeoutRef.current = null;
      }
      if (copyErrorTimeoutRef.current) {
        clearTimeout(copyErrorTimeoutRef.current);
      }

      // Removed setCopiedKey(null) to avoid clearing other rows' success indicators
      setCopyErrorKey(key);
      copyErrorTimeoutRef.current = setTimeout(() => {
        setCopyErrorKey((current) => (current === key ? null : current));
        copyErrorTimeoutRef.current = null;
      }, 2000);
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
          <div className="panel-heading" style={{ marginBottom: 0 }}>
            ▦ Results{" "}
            {results.length > 0 && (
              <span
                style={{
                  background: results.some((r) => r.severity === "error")
                    ? "var(--color-error)"
                    : "var(--color-warning)",
                  color: "var(--color-bg-primary)",
                  padding: "0 6px",
                  fontSize: "12px",
                  borderRadius: "8px",
                  marginLeft: "4px",
                }}
              >
                {results.length}
              </span>
            )}
          </div>

          <button
            className="btn"
            style={{ fontSize: "12px", padding: "4px 12px" }}
            onClick={() => setShowFilterModal(true)}
            title="Filter and sort results"
          >
            ⚲ Filter
          </button>
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
          ) : (
            <>
              {analyzeError && (
                <div
                  style={{
                    padding: "12px",
                    color: "var(--color-error)",
                    fontSize: "12px",
                    border: "1px solid var(--color-error)",
                    marginBottom: analysisHints.length > 0 ? "8px" : "0",
                  }}
                >
                  <div>⚠ {analyzeError}</div>
                </div>
              )}

              {analysisHints.length > 0 && (
                <div
                  style={{
                    border: "1px solid var(--color-border)",
                    borderRadius: "8px",
                    padding: "10px 12px",
                    marginBottom: "8px",
                    background: "var(--color-bg-secondary)",
                  }}
                >
                  <div
                    style={{
                      color: "var(--color-text-secondary)",
                      fontSize: "11px",
                      fontWeight: 600,
                      marginBottom: "6px",
                      textTransform: "uppercase",
                      letterSpacing: "0.02em",
                    }}
                  >
                    Hints
                  </div>
                  <ol
                    style={{
                      margin: 0,
                      paddingLeft: "18px",
                      color: "var(--color-text-primary)",
                      fontSize: "12px",
                    }}
                  >
                    {analysisHints.map((hint, index) => {
                      const line = hintedLine(hint);
                      return (
                        <li key={`hint-${index}`} style={{ marginBottom: "4px" }}>
                          {hint}{" "}
                          {line != null && onJumpToLine && (
                            <button
                              className="btn"
                              style={{ fontSize: "10px", padding: "1px 6px", marginLeft: "6px" }}
                              onClick={() => onJumpToLine(line)}
                            >
                              Show Me Where
                            </button>
                          )}
                        </li>
                      );
                    })}
                  </ol>
                </div>
              )}

              {parseError ? (
                <div
                  style={{
                    border: "1px solid var(--color-error)",
                    borderRadius: "8px",
                    padding: "10px 12px",
                    marginBottom: "8px",
                    background: "var(--color-bg-secondary)",
                  }}
                >
                  <div
                    style={{
                      color: "var(--color-error)",
                      fontSize: "11px",
                      fontWeight: 600,
                      marginBottom: "6px",
                      textTransform: "uppercase",
                      letterSpacing: "0.02em",
                    }}
                  >
                    Syntax Error
                  </div>
                  <div
                    style={{
                      color: "var(--color-error)",
                      fontSize: "12px",
                      whiteSpace: "pre-wrap",
                      wordBreak: "break-word",
                    }}
                  >
                    {parseError}
                  </div>
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
                    {filtered.map((v, i) => {
                      const key = violationKey(v, i);

                      return (
                        <tr
                          key={key}
                          style={{
                            borderBottom: "1px solid rgba(68,68,68,0.3)",
                            cursor: v.line != null ? "pointer" : "default",
                          }}
                          onClick={() => v.line != null && onJumpToLine?.(v.line)}
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
                                padding: "2px 8px",
                                fontSize: "12px",
                                borderRadius: "8px",
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
                              {copiedKey === key ? "✓" : copyErrorKey === key ? "⚠" : "⎘"}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </>
          )}
        </div>

        <Modal
          isOpen={showFilterModal}
          onClose={() => setShowFilterModal(false)}
          title="Results Filters"
          maxWidth={420}
        >
          <div style={{ display: "grid", gap: "12px" }}>
            <label style={{ display: "grid", gap: "6px", fontSize: "12px", color: "var(--color-text-secondary)" }}>
              Severity
              <select
                value={filter}
                onChange={(e) => setFilter(e.target.value as SeverityFilter)}
                style={{
                  background: "var(--color-bg-primary)",
                  border: "1px solid var(--color-border)",
                  color: "var(--color-text-secondary)",
                  fontFamily: "var(--font-sans)",
                  fontSize: "12px",
                  padding: "6px 8px",
                  borderRadius: "8px",
                }}
              >
                <option value="all">All</option>
                <option value="error">Error</option>
                <option value="warning">Warning</option>
                <option value="info">Info</option>
              </select>
            </label>

            <label style={{ display: "grid", gap: "6px", fontSize: "12px", color: "var(--color-text-secondary)" }}>
              Sort
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as "severity" | "line")}
                style={{
                  background: "var(--color-bg-primary)",
                  border: "1px solid var(--color-border)",
                  color: "var(--color-text-secondary)",
                  fontFamily: "var(--font-sans)",
                  fontSize: "12px",
                  padding: "6px 8px",
                  borderRadius: "8px",
                }}
              >
                <option value="severity">Severity</option>
                <option value="line">Line</option>
              </select>
            </label>
          </div>
        </Modal>
      </div>
    );
  },
);

ResultsPanel.displayName = "ResultsPanel";
export default ResultsPanel;
