const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const snackbarSourcePath = path.join(__dirname, '..', 'app', 'components', 'Snackbar.tsx')
const source = fs.readFileSync(snackbarSourcePath, 'utf8')

test('SnackbarProvider tracks timeout IDs in a ref-backed Set', () => {
  assert.match(
    source,
    /const\s+timeoutIdsRef\s*=\s*useRef<Set<number>>\(new Set\(\)\)/,
    'timeout IDs should be tracked in a Set<number> ref'
  )
})

test('SnackbarProvider removes timeout IDs when timers fire', () => {
  assert.match(
    source,
    /const\s+timerId\s*=\s*window\.setTimeout\(\(\)\s*=>\s*{[\s\S]*timeoutIdsRef\.current\.delete\(timerId\)/,
    'timer callback should remove timer ID from the ref set before state updates'
  )
})

test('SnackbarProvider cleanup clears pending timers on unmount', () => {
  assert.match(
    source,
    /useEffect\(\(\)\s*=>\s*{[\s\S]*const\s+timeoutIds\s*=\s*timeoutIdsRef\.current[\s\S]*return\s*\(\)\s*=>\s*{[\s\S]*timeoutIds\.forEach\(\(timerId\)\s*=>\s*{\s*window\.clearTimeout\(timerId\)/,
    'cleanup should clear all outstanding timers'
  )

  assert.match(source, /timeoutIds\.clear\(\)/, 'cleanup should empty timeout ID set')
})
