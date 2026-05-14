import { useState } from 'react'

import {
  type GenerationRecord,
  type GenerationStatus,
  useAcceptGeneration,
  useDocumentGenerations,
  useRejectGeneration,
} from '@/hooks/documentGenerations'
import { useDocumentDownloadUrl } from '@/hooks/documents'
import { useAppSelector } from '@/hooks/store'

import { colors, fmtMoneyPL } from './wizardStyles'

interface Props {
  customerId: string
  onGenerateClick: () => void
}

const STATUS_META: Record<
  GenerationStatus,
  { label: string; bg: string; fg: string; border: string }
> = {
  draft: { label: 'Szkic', bg: '#fff8f4', fg: colors.draftText, border: colors.draftBorder },
  preview: {
    label: 'Do akceptacji',
    bg: colors.draftBg,
    fg: colors.draftText,
    border: colors.draftBorder,
  },
  finalized: {
    label: 'Sfinalizowany',
    bg: colors.acceptedBg,
    fg: colors.acceptedText,
    border: colors.acceptedBorder,
  },
  accepted: {
    label: 'Zaakceptowany',
    bg: colors.acceptedBg,
    fg: colors.acceptedText,
    border: colors.acceptedBorder,
  },
  sent: {
    label: 'Wysłany',
    bg: '#ebf8ff',
    fg: '#2b6cb0',
    border: '#bee3f8',
  },
  superseded: {
    label: 'Zastąpiony',
    bg: '#f0eeeb',
    fg: colors.textSubtle,
    border: colors.border,
  },
  rejected: {
    label: 'Odrzucony',
    bg: colors.rejectedBg,
    fg: colors.rejectedText,
    border: colors.rejectedBorder,
  },
}

export function DocumentsTab({ customerId, onGenerateClick }: Props) {
  const user = useAppSelector((s) => s.auth.user)
  const { data: generations = [], isLoading } = useDocumentGenerations(customerId)
  const acceptMut = useAcceptGeneration()
  const rejectMut = useRejectGeneration()
  const downloadMut = useDocumentDownloadUrl()
  const [busyId, setBusyId] = useState<string | null>(null)

  async function handleAccept(gen: GenerationRecord) {
    if (!user?.id) return
    setBusyId(gen.id)
    try {
      await acceptMut.mutateAsync({ id: gen.id, accepted_by: user.id })
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Nieznany błąd'
      alert(`Nie udało się zaakceptować dokumentu.\n\n${msg}`)
    } finally {
      setBusyId(null)
    }
  }

  async function handleReject(gen: GenerationRecord) {
    if (!user?.id) return
    if (!window.confirm('Odrzucić ten dokument? Zostanie oznaczony jako odrzucony.')) return
    setBusyId(gen.id)
    try {
      await rejectMut.mutateAsync({
        id: gen.id,
        rejected_by: user.id,
        customer_id: gen.customer_id,
      })
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Nieznany błąd'
      alert(`Nie udało się odrzucić dokumentu.\n\n${msg}`)
    } finally {
      setBusyId(null)
    }
  }

  async function handleDownload(attachmentId: string | null) {
    if (!attachmentId || !user?.id) return
    try {
      const { url } = await downloadMut.mutateAsync({ id: attachmentId, userId: user.id })
      window.open(url, '_blank', 'noopener,noreferrer')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Nieznany błąd'
      alert(`Nie udało się pobrać pliku.\n\n${msg}`)
    }
  }

  return (
    <div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 14,
        }}
      >
        <div>
          <h3 style={{ fontSize: 14, fontWeight: 800, color: colors.textPrimary, margin: 0 }}>
            Wygenerowane dokumenty
          </h3>
          <p style={{ fontSize: 11.5, color: colors.textMuted, margin: '2px 0 0' }}>
            Aneksy, pisma przewodnie i nowe umowy generowane automatycznie.
          </p>
        </div>
        <button
          onClick={onGenerateClick}
          style={{
            background: colors.orange,
            color: 'white',
            border: 'none',
            borderRadius: 8,
            padding: '8px 16px',
            fontSize: 12.5,
            fontWeight: 700,
            cursor: 'pointer',
            fontFamily: 'inherit',
            boxShadow: '0 2px 8px rgba(232,92,4,0.25)',
          }}
        >
          ✦ Generuj dokument
        </button>
      </div>

      {isLoading && (
        <p style={{ fontSize: 13, color: colors.textMuted }}>Ładowanie…</p>
      )}

      {!isLoading && generations.length === 0 && (
        <div
          style={{
            background: colors.cardBg,
            borderRadius: 10,
            padding: 24,
            textAlign: 'center',
            color: colors.textMuted,
            fontSize: 13,
          }}
        >
          Brak wygenerowanych dokumentów. Kliknij <strong>Generuj dokument</strong>, aby
          zacząć.
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {generations.map((g) => (
          <GenerationRow
            key={g.id}
            gen={g}
            busy={busyId === g.id}
            onAccept={() => handleAccept(g)}
            onReject={() => handleReject(g)}
            onDownloadPdf={() => handleDownload(g.attachment_pdf_id)}
            onDownloadCover={() => handleDownload(g.cover_letter_attachment_id)}
          />
        ))}
      </div>
    </div>
  )
}

interface RowProps {
  gen: GenerationRecord
  busy: boolean
  onAccept: () => void
  onReject: () => void
  onDownloadPdf: () => void
  onDownloadCover: () => void
}

function GenerationRow({ gen, busy, onAccept, onReject, onDownloadPdf, onDownloadCover }: RowProps) {
  const meta = STATUS_META[gen.status]
  const sim = (gen.simulation as Record<string, unknown>) ?? {}
  const deltaYear = sim.delta_annual_revenue as string | undefined
  const indexPct = (sim.weighted_avg_index_pct ?? sim.delta_annual_revenue_pct) as string | undefined
  const canAccept = gen.status === 'preview' || gen.status === 'draft'
  const created = new Date(gen.created_at).toLocaleString('pl-PL', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })

  return (
    <div
      style={{
        background: 'white',
        border: `1px solid ${colors.border}`,
        borderLeft: `3px solid ${meta.fg}`,
        borderRadius: 10,
        padding: '12px 16px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 14,
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <span
            style={{
              fontSize: 9.5,
              fontWeight: 700,
              padding: '2px 8px',
              borderRadius: 4,
              background: meta.bg,
              color: meta.fg,
              border: `1px solid ${meta.border}`,
              textTransform: 'uppercase',
              letterSpacing: 0.3,
            }}
          >
            {meta.label}
          </span>
          <span style={{ fontSize: 13, fontWeight: 700, color: colors.textPrimary }}>
            {gen.template_key} v{gen.template_version}
          </span>
        </div>
        <div style={{ fontSize: 11.5, color: colors.textMuted }}>
          {created}
          {deltaYear && (
            <>
              {' · Δ rok: '}
              <strong style={{ color: colors.textPrimary }}>{fmtMoneyPL(deltaYear)}</strong>
            </>
          )}
          {indexPct && (
            <>
              {' · indeks ≈ '}
              {indexPct}%
            </>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
        {gen.attachment_pdf_id && (
          <button onClick={onDownloadPdf} style={btnLinkStyle}>
            Aneks PDF
          </button>
        )}
        {gen.cover_letter_attachment_id && (
          <button onClick={onDownloadCover} style={btnLinkStyle}>
            Pismo PDF
          </button>
        )}
        {canAccept && (
          <>
            <button onClick={onReject} disabled={busy} style={btnRejectStyle}>
              Odrzuć
            </button>
            <button onClick={onAccept} disabled={busy} style={btnAcceptStyle}>
              {busy ? 'Akceptuję…' : 'Akceptuj'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}

const btnLinkStyle: React.CSSProperties = {
  background: 'white',
  color: colors.textPrimary,
  border: `1px solid ${colors.border}`,
  borderRadius: 6,
  padding: '5px 10px',
  fontSize: 11.5,
  fontWeight: 600,
  cursor: 'pointer',
  fontFamily: 'inherit',
}

const btnAcceptStyle: React.CSSProperties = {
  background: colors.acceptedText,
  color: 'white',
  border: 'none',
  borderRadius: 6,
  padding: '5px 12px',
  fontSize: 11.5,
  fontWeight: 700,
  cursor: 'pointer',
  fontFamily: 'inherit',
}

const btnRejectStyle: React.CSSProperties = {
  background: 'white',
  color: colors.negative,
  border: `1px solid ${colors.rejectedBorder}`,
  borderRadius: 6,
  padding: '5px 10px',
  fontSize: 11.5,
  fontWeight: 600,
  cursor: 'pointer',
  fontFamily: 'inherit',
}
