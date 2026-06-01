import type { CSSProperties } from 'react'

export type OcrStatus = 'pending' | 'processing' | 'done' | 'failed' | 'skipped' | null | undefined

interface Config {
  label: string
  fg: string
  bg: string
  border: string
  spinner?: boolean
  icon?: string
}

const CONFIGS: Record<string, Config> = {
  pending: {
    label: 'Oczekuje na przetworzenie',
    fg: '#6b6b6b', bg: '#f2f0ed', border: '#e3e0db',
    spinner: true,
  },
  processing: {
    label: 'Trwa indeksowanie...',
    fg: '#c94f02', bg: '#fff5f0', border: '#fdd5b8',
    spinner: true,
  },
  done: {
    label: 'Gotowe',
    fg: '#276749', bg: '#f0fff4', border: '#9ae6b4',
    icon: '✓',
  },
  failed: {
    label: 'Błąd przetwarzania',
    fg: '#c94f02', bg: '#fff5f0', border: '#fdd5b8',
    icon: '✕',
  },
  skipped: {
    label: 'Nie przetworzone',
    fg: '#7a6f67', bg: '#fafaf9', border: '#e3e0db',
    icon: '—',
  },
}

const spinnerStyle = (color: string): CSSProperties => ({
  display: 'inline-block',
  width: 8,
  height: 8,
  borderRadius: '50%',
  border: '1.5px solid transparent',
  borderTopColor: color,
  animation: 'hrk-spin 0.75s linear infinite',
  flexShrink: 0,
})

interface Props {
  status: OcrStatus
}

export function OcrStatusBadge({ status }: Props) {
  const key = status ?? 'pending'
  const cfg = CONFIGS[key] ?? CONFIGS.pending

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        fontSize: 9.5,
        fontWeight: 600,
        padding: '2px 7px',
        borderRadius: 10,
        background: cfg.bg,
        color: cfg.fg,
        border: `1px solid ${cfg.border}`,
        whiteSpace: 'nowrap',
      }}
    >
      {cfg.spinner ? (
        <span style={spinnerStyle(cfg.fg)} />
      ) : (
        <span style={{ fontSize: 9, lineHeight: 1, flexShrink: 0 }}>{cfg.icon}</span>
      )}
      {cfg.label}
    </span>
  )
}
