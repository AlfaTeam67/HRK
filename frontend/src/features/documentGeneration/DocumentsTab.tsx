import { useState } from 'react'

import {
  type GenerationRecord,
  type GenerationStatus,
  useAcceptGeneration,
  useDocumentGenerations,
  useRejectGeneration,
} from '@/hooks/documentGenerations'
import {
  useDocumentDownloadUrl,
  useDocumentsQuery,
} from '@/hooks/documents'
import { useContracts } from '@/hooks/contracts'
import { useAppSelector } from '@/hooks/store'
import { UploadWizard } from '@/features/documents/UploadWizard'
import type { DocumentRead } from '@/types/models'

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

const OCR_META: Record<string, { label: string; bg: string; fg: string }> = {
  pending:    { label: 'Oczekuje', bg: '#f2f0ed', fg: '#6b6b6b' },
  processing: { label: 'Przetwarza…', bg: '#eff6ff', fg: '#1d4ed8' },
  done:       { label: 'RAG gotowy', bg: '#f0fff4', fg: '#276749' },
  failed:     { label: 'Błąd OCR', bg: '#fff5f0', fg: '#c94f02' },
  skipped:    { label: 'Pominięto', bg: '#fafaf9', fg: '#9e9389' },
}

const DOC_TYPE_LABELS: Record<string, string> = {
  contract:          'Umowa',
  amendment:         'Aneks',
  power_of_attorney: 'Pełnomocnictwo',
  service_order:     'Zamówienie',
  invoice:           'Faktura',
  other:             'Inny',
}

export function DocumentsTab({ customerId, onGenerateClick }: Props) {
  const user = useAppSelector((s) => s.auth.user)
  const { data: generations = [], isLoading: genLoading } = useDocumentGenerations(customerId)
  const { data: attachments = [], isLoading: attLoading } = useDocumentsQuery({ customer_id: customerId })
  const { data: contracts = [] } = useContracts({ customer_id: customerId })
  const acceptMut = useAcceptGeneration()
  const rejectMut = useRejectGeneration()
  const downloadMut = useDocumentDownloadUrl()
  const [busyId, setBusyId] = useState<string | null>(null)

  const [wizardOpen, setWizardOpen] = useState(false)

  const isLoading = genLoading || attLoading
  const clientDocs = attachments.filter((a) => !a.contract_id)
  const contractDocs = attachments.filter((a) => !!a.contract_id)

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
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <h3 style={{ fontSize: 14, fontWeight: 800, color: colors.textPrimary, margin: 0 }}>Dokumenty klienta</h3>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => setWizardOpen(true)} style={btnSecStyle}>+ Wgraj plik</button>
          <button onClick={onGenerateClick} style={btnPriStyle}>✦ Generuj aneks</button>
        </div>
      </div>

      {isLoading && <p style={{ fontSize: 13, color: colors.textMuted }}>Ładowanie…</p>}

      {/* Dokumenty ogólne klienta */}
      <section style={{ marginBottom: 20 }}>
        <SectionLabel>Dokumenty ogólne</SectionLabel>
        {clientDocs.length === 0 ? (
          <EmptyState>Brak dokumentów ogólnych. Użyj <strong>Wgraj plik</strong>, aby dodać pełnomocnictwo lub inne dokumenty klienta.</EmptyState>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {clientDocs.map((doc) => <AttachmentRow key={doc.id} doc={doc} onDownload={() => handleDownload(doc.id)} />)}
          </div>
        )}
      </section>

      {/* Podgląd dokumentów umów */}
      {contractDocs.length > 0 && (
        <section style={{ marginBottom: 20 }}>
          <SectionLabel>Dokumenty powiązane z umowami</SectionLabel>
          <p style={{ fontSize: 11.5, color: colors.textMuted, margin: '0 0 8px' }}>Zarządzanie tymi plikami odbywa się z poziomu konkretnej umowy.</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {contractDocs.map((doc) => {
              const contract = contracts.find((c) => c.id === doc.contract_id)
              return (
                <div key={doc.id} style={{ background: 'white', border: `1px solid ${colors.border}`, borderRadius: 8, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10, opacity: 0.8 }}>
                  {contract && <span style={{ fontSize: 10, fontWeight: 700, color: colors.textMuted, background: '#f2f0ed', border: `1px solid ${colors.border}`, borderRadius: 4, padding: '1px 6px', whiteSpace: 'nowrap' }}>{contract.contract_number}</span>}
                  <span style={{ fontSize: 12.5, color: colors.textPrimary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{doc.original_filename}</span>
                  <button onClick={() => handleDownload(doc.id)} style={btnSecStyle}>Pobierz</button>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* Generacje AI */}
      {generations.length > 0 && (
        <section>
          <SectionLabel>Wygenerowane przez AI</SectionLabel>
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
        </section>
      )}

      {!isLoading && generations.length === 0 && clientDocs.length === 0 && contractDocs.length === 0 && (
        <EmptyState>Brak dokumentów. Kliknij <strong>Wgraj plik</strong> lub <strong>Generuj aneks</strong>, aby zacząć.</EmptyState>
      )}

      {wizardOpen && (
        <UploadWizard customerId={customerId} onClose={() => setWizardOpen(false)} />
      )}
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
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })

  return (
    <div style={{
      background: 'white',
      border: `1px solid ${colors.border}`,
      borderLeft: `3px solid ${meta.fg}`,
      borderRadius: 10,
      padding: '12px 16px',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: 14,
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <span style={{
            fontSize: 9.5, fontWeight: 700, padding: '2px 8px', borderRadius: 4,
            background: meta.bg, color: meta.fg, border: `1px solid ${meta.border}`,
            textTransform: 'uppercase', letterSpacing: 0.3,
          }}>
            {meta.label}
          </span>
          <span style={{ fontSize: 13, fontWeight: 700, color: colors.textPrimary }}>
            {gen.template_key} v{gen.template_version}
          </span>
        </div>
        <div style={{ fontSize: 11.5, color: colors.textMuted }}>
          {created}
          {deltaYear && <>{' · Δ rok: '}<strong style={{ color: colors.textPrimary }}>{fmtMoneyPL(deltaYear)}</strong></>}
          {indexPct && <>{' · indeks ≈ '}{indexPct}%</>}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, flexShrink: 0, alignItems: 'center' }}>
        {canAccept && (
          <span style={{
            fontSize: 9, fontWeight: 700, color: '#9e9389',
            background: '#f5f2ef', border: '1px solid #e3e0db',
            borderRadius: 4, padding: '2px 6px', letterSpacing: '0.05em', whiteSpace: 'nowrap',
          }}>
            WERSJA ROBOCZA
          </span>
        )}
        {gen.attachment_pdf_id && <button onClick={onDownloadPdf} style={btnLinkStyle}>Aneks PDF</button>}
        {gen.cover_letter_attachment_id && <button onClick={onDownloadCover} style={btnLinkStyle}>Pismo PDF</button>}
        {canAccept && (
          <>
            <button onClick={onReject} disabled={busy} style={btnRejectStyle}>Odrzuć</button>
            <button onClick={onAccept} disabled={busy} style={btnAcceptStyle}>
              {busy ? 'Akceptuję…' : 'Akceptuj'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}

function AttachmentRow({ doc, onDownload }: { doc: DocumentRead; onDownload: () => void }) {
  const ocrKey = doc.ocr_status ?? 'pending'
  const ocr = OCR_META[ocrKey] ?? OCR_META['pending']
  const created = new Date(doc.created_at).toLocaleString('pl-PL', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })

  return (
    <div style={{
      background: 'white',
      border: `1px solid ${colors.border}`,
      borderLeft: `3px solid #9e9389`,
      borderRadius: 10,
      padding: '12px 16px',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: 14,
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: colors.textPrimary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {doc.original_filename}
          </span>
          <span style={{ fontSize: 9.5, fontWeight: 700, padding: '2px 8px', borderRadius: 4, background: '#f2f0ed', color: '#6b6b6b', border: '1px solid #e3e0db', textTransform: 'uppercase', letterSpacing: 0.3, whiteSpace: 'nowrap' }}>
            {DOC_TYPE_LABELS[doc.document_type] ?? doc.document_type}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11.5, color: colors.textMuted }}>
          {created}
          <span style={{ padding: '1px 6px', borderRadius: 10, fontSize: 10, fontWeight: 600, background: ocr.bg, color: ocr.fg }}>
            {ocr.label}
          </span>
        </div>
      </div>

      <button onClick={onDownload} style={btnLinkStyle}>
        Pobierz
      </button>
    </div>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 10.5, fontWeight: 700, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>{children}</div>
}

function EmptyState({ children }: { children: React.ReactNode }) {
  return <div style={{ background: '#fafaf9', borderRadius: 10, padding: 20, textAlign: 'center', color: colors.textMuted, fontSize: 13, border: `1px solid ${colors.border}` }}>{children}</div>
}

const btnPriStyle: React.CSSProperties = {
  background: colors.orange, color: 'white', border: 'none', borderRadius: 8,
  padding: '8px 16px', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
  boxShadow: '0 2px 8px rgba(232,92,4,0.25)',
}

const btnSecStyle: React.CSSProperties = {
  background: 'white', color: colors.textPrimary, border: `1px solid ${colors.border}`,
  borderRadius: 8, padding: '8px 14px', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
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
