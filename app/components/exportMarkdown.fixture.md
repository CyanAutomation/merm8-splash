# exportMarkdown fixture

This fixture documents markdown table sanitization for messages containing pipe characters and line breaks.

## Input violation

```json
{
  "rule_id": "SQL|001",
  "severity": "warning",
  "message": "Avoid `SELECT *` | project columns\nSecond line",
  "line": 12
}
```

## Expected markdown row

```md
| SQL\|001 | warning | Avoid `SELECT *` \| project columns<br>Second line | 12 |
```
