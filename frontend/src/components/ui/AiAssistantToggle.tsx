import type { CSSProperties } from 'react'

import type { AiToggleState } from '@/components/ui/aiAssistantToggleHelpers'

const C = {
  orangeOn: '#e85c04',
  orangeOff: '#e3e0db',
  green: '#276749',
  greenBg: '#f0fff4',
  greenBorder: '#9ae6b4',
  red: '#c94f02',
  redBg: '#fff5f0',
  redBorder: '#fdd5b8',
  amber: '#c94f02',
  amberBg: '#fff5f0',
  amberBorder: '#fdd5b8',
  grey: '#9e9389',
  greyBg: '#f5f2ef',
  greyBorder: '#e3e0db',
  text: '#1a1714',
}

interface Props {
  state: AiToggleState
  busy?: boolean
  onChange: (next: boolean) => void
  onRetry?: () => void
  onUnsupportedClick?: () => void
}

const switchTrack = (active: boolean, disabled: boolean): CSSProperties => ({
  position: 'relative',
  display: 'inline-block',
  width: 36,
  height: 20,
  borderRadius: 10,
  background: active ? C.orangeOn : C.orangeOff,
  transition: 'background 0.15s',
  cursor: disabled ? 'not-allowed' : 'pointer',
  opacity: disabled ? 0.6 : 1,
  flexShrink: 0,
  border: 'none',
  padding: 0,
})

const switchThumb = (active: boolean): CSSProperties => ({
  position: 'absolute',
  top: 2,
  left: active ? 18 : 2,
  width: 16,
  height: 16,
  borderRadius: '50%',
  background: 'white',
  boxShadow: '0 1px 2px rgba(0,0,0,0.2)',
  transition: 'left 0.15s',
})

const badgeStyle = (fg: string, bg: string, border: string): CSSProperties => ({
  display: 'inline-flex',
  alignItems: 'center',
  gap: 5,
  fontSize: 9.5,
  fontWeight: 600,
  padding: '2px 7px',
  borderRadius: 10,
  background: bg,
  color: fg,
  border: `1px solid ${border}`,
  whiteSpace: 'nowrap',
})

const spinnerStyle: CSSProperties = {
  display: 'inline-block',
  width: 8,
  height: 8,
  borderRadius: '50%',
  border: '1.5px solid transparent',
  borderTopColor: C.amber,
  animation: 'hrk-spin 0.75s linear infinite',
  flexShrink: 0,
}

const retryBtn: CSSProperties = {
  background: 'white',
  color: C.red,
  border: `1px solid ${C.redBorder}`,
  borderRadius: 6,
  padding: '3px 8px',
  fontSize: 10.5,
  fontWeight: 600,
  cursor: 'pointer',
  fontFamily: 'inherit',
}

export function AiAssistantToggle({
  state,
  busy = false,
  onChange,
  onRetry,
  onUnsupportedClick,
}: Props) {
  const interactiveDisabled = busy || state === 'indexing' || state === 'failed'

  function handleSwitchClick() {
    if (state === 'unsupported') {
      onUnsupportedClick?.()
      return
    }
    if (interactiveDisabled) return
    onChange(state === 'off' ? true : false)
  }

  const active = state === 'on' || state === 'indexing' || state === 'failed'

  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
      <button
        type="button"
        aria-label="Załącz dla asystenta AI"
        aria-pressed={active}
        onClick={handleSwitchClick}
        style={switchTrack(active, interactiveDisabled && state !== 'unsupported')}
      >
        <span style={switchThumb(active)} />
      </button>

      {state === 'on' && (
        <span style={badgeStyle(C.green, C.greenBg, C.greenBorder)}>
          <span style={{ fontSize: 9 }}>✓</span> W asystencie AI
        </span>
      )}
      {state === 'off' && (
        <span style={badgeStyle(C.grey, C.greyBg, C.greyBorder)}>Wyłączony</span>
      )}
      {state === 'indexing' && (
        <span style={badgeStyle(C.amber, C.amberBg, C.amberBorder)}>
          <span style={spinnerStyle} /> Indeksowanie…
        </span>
      )}
      {state === 'failed' && (
        <>
          <span style={badgeStyle(C.red, C.redBg, C.redBorder)}>
            <span style={{ fontSize: 9 }}>✕</span> Błąd indeksacji
          </span>
          {onRetry && (
            <button type="button" onClick={onRetry} disabled={busy} style={retryBtn}>
              Spróbuj ponownie
            </button>
          )}
        </>
      )}
      {state === 'unsupported' && (
        <span style={badgeStyle(C.grey, C.greyBg, C.greyBorder)}>Format niewspierany</span>
      )}
    </div>
  )
}

interface ConfirmProps {
  isOpen: boolean
  count?: number
  onConfirm: () => void
  onCancel: () => void
  busy?: boolean
}

export function AiAssistantOffConfirm({ isOpen, count, onConfirm, onCancel, busy }: ConfirmProps) {
  if (!isOpen) return null
  const isBulk = (count ?? 1) > 1
  return (
    <div
      onClick={onCancel}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1200,
        background: 'rgba(26,23,20,0.5)',
        backdropFilter: 'blur(2px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'white',
          borderRadius: 12,
          maxWidth: 440,
          width: '100%',
          boxShadow: '0 24px 64px rgba(0,0,0,0.22)',
          padding: 24,
        }}
      >
        <h3 style={{ fontSize: 15, fontWeight: 800, color: C.text, margin: '0 0 8px' }}>
          {isBulk
            ? `Wyłączyć ${count} dokumentów z asystenta AI?`
            : 'Wyłączyć dokument z asystenta AI?'}
        </h3>
        <p style={{ fontSize: 13, color: C.grey, margin: '0 0 16px', lineHeight: 1.5 }}>
          Wszystkie chunki zostaną skasowane. Plik pozostanie w S3 i można włączyć ponownie później.
        </p>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            style={{
              padding: '9px 16px',
              borderRadius: 7,
              border: `1px solid ${C.greyBorder}`,
              background: 'white',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: 'inherit',
              color: C.text,
            }}
          >
            Anuluj
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            style={{
              padding: '9px 16px',
              borderRadius: 7,
              border: 'none',
              background: busy ? C.greyBorder : C.red,
              color: 'white',
              fontSize: 13,
              fontWeight: 700,
              cursor: busy ? 'not-allowed' : 'pointer',
              fontFamily: 'inherit',
            }}
          >
            {busy ? 'Wyłączam…' : 'Wyłącz i usuń chunki'}
          </button>
        </div>
      </div>
    </div>
  )
}
