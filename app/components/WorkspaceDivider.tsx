'use client'

import { useCallback, useEffect, useRef } from 'react'
import type { MouseEvent as ReactMouseEvent } from 'react'
import { calculateResizedPanelPercentage } from '../../lib/panelResize'

interface WorkspaceDividerProps {
  direction: 'horizontal' | 'vertical'
  currentPercentage: number
  minPercentage: number
  maxPercentage: number
  onResize: (percentage: number) => void
}

export default function WorkspaceDivider({
  direction,
  currentPercentage,
  minPercentage,
  maxPercentage,
  onResize,
}: WorkspaceDividerProps) {
  const cleanupRef = useRef<(() => void) | null>(null)

  const stopDragging = useCallback(() => {
    cleanupRef.current?.()
    cleanupRef.current = null
  }, [])

  useEffect(() => stopDragging, [stopDragging])

  const startDragging = (event: ReactMouseEvent<HTMLDivElement>) => {
    event.preventDefault()
    stopDragging()

    const gridContainer = event.currentTarget.parentElement
    if (!gridContainer) return

    const isHorizontal = direction === 'horizontal'
    const startPosition = isHorizontal ? event.clientY : event.clientX
    const handleMouseMove = (moveEvent: MouseEvent) => {
      const currentPosition = isHorizontal ? moveEvent.clientY : moveEvent.clientX
      const containerSize = isHorizontal ? gridContainer.clientHeight : gridContainer.clientWidth
      onResize(calculateResizedPanelPercentage(
        currentPercentage,
        currentPosition - startPosition,
        containerSize,
        minPercentage,
        maxPercentage
      ))
    }
    const handleMouseUp = () => stopDragging()
    const cleanup = () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }

    cleanupRef.current = cleanup
    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  }

  const isHorizontal = direction === 'horizontal'

  return (
    <div
      className="workspace-divider"
      style={{
        gridColumn: isHorizontal ? '1 / 4' : 2,
        gridRow: isHorizontal ? 2 : '1 / 2',
        background: 'var(--color-border)',
        cursor: isHorizontal ? 'row-resize' : 'col-resize',
        transition: 'background 0.2s ease',
      }}
      onMouseEnter={(event) => {
        event.currentTarget.style.background = 'var(--color-accent-primary)'
      }}
      onMouseLeave={(event) => {
        event.currentTarget.style.background = 'var(--color-border)'
      }}
      onMouseDown={startDragging}
    />
  )
}
