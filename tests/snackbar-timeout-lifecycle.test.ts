import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import ts from 'typescript'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const snackbarSourcePath = path.join(__dirname, '..', 'app', 'components', 'Snackbar.tsx')
const source = fs.readFileSync(snackbarSourcePath, 'utf8')

it('SnackbarProvider tracks timeout IDs in a ref-backed Set', () => {
  expect(source).toMatch(/const\s+timeoutIdsRef\s*=\s*useRef<Set<number>>\(new Set\(\)\)/) // 'timeout IDs should be tracked in a Set<number> ref'
})

it('SnackbarProvider removes timeout IDs when timers fire', () => {
  expect(source).toMatch(/const\s+timerId\s*=\s*window\.setTimeout\(\(\)\s*=>\s*{[\s\S]*timeoutIdsRef\.current\.delete\(timerId\)/,
    'timer callback should remove timer ID from the ref set before state updates'
  )
})

it('SnackbarProvider cleanup clears pending timers on unmount', () => {
  assert.match(
    source,
    /useEffect\(\(\)\s*=>\s*{[\s\S]*const\s+timeoutIds\s*=\s*timeoutIdsRef\.current[\s\S]*return\s*\(\)\s*=>\s*{[\s\S]*timeoutIds\.forEach\(\(timerId\)\s*=>\s*{\s*window\.clearTimeout\(timerId\)/,
    'cleanup should clear all outstanding timers'
  )

  expect(source).toMatch(/timeoutIds\.clear\(\)/) // 'cleanup should empty timeout ID set'
})
