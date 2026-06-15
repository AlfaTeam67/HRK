/**
 * HelpTooltip — reusable "?" icon with a hover tooltip.
 *
 * Usage:
 *   <HelpTooltip text="Pole CKK to unikalny identyfikator klienta w systemie HRK." />
 *
 * Renders a small question-mark badge; on hover shows a floating tooltip.
 * Pure CSS — no extra libraries required.
 */

import { useRef, useState, type ReactNode } from 'react'

interface HelpTooltipProps {
  /** Tooltip content — can be plain text or JSX */
  text: ReactNode
  /** Optional size of the trigger icon in px (default 14) */
  size?: number
}

export function HelpTooltip({ text, size = 14 }: HelpTooltipProps) {
  const [visible, setVisible] = useState(false)
  const ref = useRef<HTMLSpanElement>(null)

  return (
    <span
      ref={ref}
      style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
      onFocus={() => setVisible(true)}
      onBlur={() => setVisible(false)}
    >
      {/* Trigger icon */}
      <span
        tabIndex={0}
        role="button"
        aria-label="Pomoc"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: size,
          height: size,
          borderRadius: '50%',
          background: '#e8e2db',
          color: '#7a6f67',
          fontSize: size * 0.65,
          fontWeight: 700,
          cursor: 'help',
          userSelect: 'none',
          flexShrink: 0,
          outline: 'none',
          transition: 'background 0.1s',
        }}
        onMouseEnter={e => { (e.currentTarget as HTMLSpanElement).style.background = '#e85c04'; (e.currentTarget as HTMLSpanElement).style.color = 'white' }}
        onMouseLeave={e => { (e.currentTarget as HTMLSpanElement).style.background = '#e8e2db'; (e.currentTarget as HTMLSpanElement).style.color = '#7a6f67' }}
      >
        ?
      </span>

      {/* Tooltip bubble */}
      {visible && (
        <span
          role="tooltip"
          style={{
            position: 'absolute',
            bottom: '100%',
            left: '50%',
            transform: 'translateX(-50%)',
            marginBottom: 6,
            background: '#1a1714',
            color: '#f5f0ea',
            fontSize: 12,
            lineHeight: 1.5,
            padding: '7px 10px',
            borderRadius: 7,
            boxShadow: '0 4px 12px rgba(0,0,0,0.25)',
            whiteSpace: 'normal',
            maxWidth: 260,
            minWidth: 140,
            width: 'max-content',
            zIndex: 9999,
            pointerEvents: 'none',
          }}
        >
          {text}
          {/* Arrow */}
          <span style={{
            position: 'absolute',
            top: '100%',
            left: '50%',
            transform: 'translateX(-50%)',
            border: '5px solid transparent',
            borderTopColor: '#1a1714',
          }} />
        </span>
      )}
    </span>
  )
}
