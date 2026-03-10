'use client'

import { useEffect, useState } from 'react'

interface LayoutPreferences {
  leftPanelSize: number // percentage
  editorSize: number // percentage of left column
  previewSize: number // percentage of right column
  useBeautifulRenderer: boolean
}

const DEFAULT_PREFS: LayoutPreferences = {
  leftPanelSize: 40,
  editorSize: 70,
  previewSize: 55,
  useBeautifulRenderer: false,
}

const STORAGE_KEY = 'merm8-layout-prefs'

function sanitizeLayoutPreferences(
  values: Partial<LayoutPreferences>,
): LayoutPreferences {
  const sanitizeValue = (
    value: unknown,
    min: number,
    max: number,
    fallback: number,
  ) => {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      return fallback
    }

    return Math.min(max, Math.max(min, value))
  }

  return {
    leftPanelSize: sanitizeValue(values.leftPanelSize, 25, 75, DEFAULT_PREFS.leftPanelSize),
    editorSize: sanitizeValue(values.editorSize, 30, 70, DEFAULT_PREFS.editorSize),
    previewSize: sanitizeValue(values.previewSize, 25, 75, DEFAULT_PREFS.previewSize),
    useBeautifulRenderer: typeof values.useBeautifulRenderer === 'boolean' ? values.useBeautifulRenderer : false,
  }
}

export function useLayoutPreferences() {
  const [prefs, setPrefs] = useState<LayoutPreferences>(DEFAULT_PREFS)
  const [isMobile, setIsMobile] = useState(false)

  // Load preferences from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        const parsed = JSON.parse(stored)
        setPrefs(sanitizeLayoutPreferences({ ...DEFAULT_PREFS, ...parsed }))
      }
    } catch (err) {
      console.debug('Failed to load layout preferences:', err)
    }
  }, [])

  // Detect mobile breakpoint
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768)
    }

    // Set initial state
    handleResize()
    
    // Listen for resize
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  // Save preferences to localStorage
  const savePrefs = (newPrefs: Partial<LayoutPreferences>) => {
    setPrefs((prev) => {
      const updated = sanitizeLayoutPreferences({ ...prev, ...newPrefs })
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
      } catch (err) {
        console.debug('Failed to save layout preferences:', err)
      }
      return updated
    })
  }

  // Reset to defaults
  const resetPrefs = () => {
    setPrefs(DEFAULT_PREFS)
    try {
      localStorage.removeItem(STORAGE_KEY)
    } catch (err) {
      console.debug('Failed to reset layout preferences:', err)
    }
  }

  return {
    prefs,
    savePrefs,
    resetPrefs,
    isMobile,
  }
}
