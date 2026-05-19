// Inline style tokens shared across wizard steps. Keeps step components
// short by avoiding repeating the same color/spacing literals.

export const colors = {
  orange: '#e85c04',
  orangeDark: '#c94f02',
  orangeLight: '#fff5f0',
  border: '#e3e0db',
  borderSoft: '#f2f0ed',
  cardBg: '#fafaf9',
  textPrimary: '#1a1714',
  textMuted: '#9e9389',
  textSubtle: '#7a6f67',
  positive: '#276749',
  negative: '#9b2c2c',
  draftBg: '#fff5f0',
  draftBorder: '#fdd5b8',
  draftText: '#c94f02',
  acceptedBg: '#f0fff4',
  acceptedText: '#276749',
  acceptedBorder: '#c6f6d5',
  rejectedBg: '#fff5f5',
  rejectedText: '#9b2c2c',
  rejectedBorder: '#feb2b2',
} as const

export const radii = {
  sm: 6,
  md: 8,
  lg: 12,
} as const

export function fmtMoneyPL(value: string | number | null | undefined): string {
  if (value == null || value === '') return '—'
  const n = typeof value === 'string' ? Number(value) : value
  if (Number.isNaN(n)) return String(value)
  return new Intl.NumberFormat('pl-PL', {
    style: 'currency',
    currency: 'PLN',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n)
}

export function fmtPctPL(value: string | number | null | undefined): string {
  if (value == null || value === '') return '—'
  const n = typeof value === 'string' ? Number(value) : value
  if (Number.isNaN(n)) return String(value)
  return `${n.toFixed(2).replace('.', ',')}%`
}
