# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - main [ref=e2]:
    - generic [ref=e3]:
      - button "Break left preview" [ref=e4] [cursor=pointer]
      - button "Rapid left changes" [ref=e5] [cursor=pointer]
      - button "Overlap left/right renders" [ref=e6] [cursor=pointer]
    - generic [ref=e7]:
      - generic [ref=e9]:
        - generic [ref=e10]:
          - generic [ref=e11]: ◈ Diagram Preview
          - generic [ref=e12]:
            - 'button "Toggle diagram mode. Current mode: dark" [ref=e13] [cursor=pointer]': ☾ Dark
            - button "↔ Fit" [ref=e14] [cursor=pointer]
            - generic [ref=e15]: ⠋ Rendering...
        - img [ref=e18]
      - generic [ref=e21]:
        - generic [ref=e22]: ◈ Diagram Preview
        - generic [ref=e23]:
          - 'button "Toggle diagram mode. Current mode: dark" [ref=e24] [cursor=pointer]': ☾ Dark
          - button "↔ Fit" [ref=e25] [cursor=pointer]
          - generic [ref=e26]: ⠋ Rendering...
  - button "Open Next.js Dev Tools" [ref=e33] [cursor=pointer]:
    - img [ref=e34]
  - alert [ref=e38]
```