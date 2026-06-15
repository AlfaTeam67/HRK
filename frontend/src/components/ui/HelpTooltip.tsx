/**
 * HelpTooltip — reusable "?" icon with a hover tooltip.
 *
 * Tooltip is rendered via a React portal directly into document.body so it
 * is never clipped by overflow:hidden parents (modals, table cells, etc.).
 * Position is computed from the trigger's bounding rect.
 */

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

interface HelpTooltipProps {
  /** Tooltip content — can be plain text or JSX */
  text: ReactNode
  /** Optional size of the trigger icon in px (default 14) */
  size?: number
}

interface TooltipPos {
  top: number
  left: number
}

export function HelpTooltip({ text, size = 14 }: HelpTooltipProps) {
  const [visible, setVisible] = useState(false)
  const [pos, setPos] = useState<TooltipPos>({ top: 0, left: 0 })
  const triggerRef = useRef<HTMLSpanElement>(null)

  function computePos() {
    if (!triggerRef.current) return
    const rect = triggerRef.current.getBoundingClientRect()
    setPos({
      // place tooltip above the trigger, centred horizontally
      top: rect.top + window.scrollY - 8,   // 8px gap + arrow
      left: rect.left + window.scrollX + rect.width / 2,
    })
  }

  function show() {
    computePos()
    setVisible(true)
  }

  function hide() {
    setVisible(false)
  }

  // Recompute on scroll/resize while visible
  useEffect(() => {
    if (!visible) return
    const handler = () => computePos()
    window.addEventListener('scroll', handler, true)
    window.addEventListener('resize', handler)
    return () => {
      window.removeEventListener('scroll', handler, true)
      window.removeEventListener('resize', handler)
    }
  }, [visible])

  const tooltip = visible
    ? createPortal(
        <span
          role="tooltip"
          style={{
            position: 'absolute',
            top: pos.top,
            left: pos.left,
            transform: 'translate(-50%, -100%)',
            marginTop: -6,
            background: '#1a1714',
            color: '#f5f0ea',
            fontSize: 12,
            lineHeight: 1.5,
            padding: '7px 10px',
            borderRadius: 7,
            boxShadow: '0 4px 12px rgba(0,0,0,0.28)',
            whiteSpace: 'normal',
            maxWidth: 260,
            minWidth: 140,
            width: 'max-content',
            zIndex: 99999,
            pointerEvents: 'none',
          }}
        >
          {text}
          {/* Arrow pointing down */}
          <span
            style={{
              position: 'absolute',
              top: '100%',
              left: '50%',
              transform: 'translateX(-50%)',
              border: '5px solid transparent',
              borderTopColor: '#1a1714',
            }}
          />
        </span>,
        document.body,
      )
    : null

  return (
    <span style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
      <span
        ref={triggerRef}
        tabIndex={0}
        role="button"
        aria-label="Pomoc"
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={hide}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: size,
          height: size,
          borderRadius: '50%',
          background: visible ? '#e85c04' : '#e8e2db',
          color: visible ? 'white' : '#7a6f67',
          fontSize: size * 0.65,
          fontWeight: 700,
          cursor: 'help',
          userSelect: 'none',
          flexShrink: 0,
          outline: 'none',
          transition: 'background 0.1s, color 0.1s',
        }}
      >
        ?
      </span>
      {tooltip}
    </span>
  )
}
