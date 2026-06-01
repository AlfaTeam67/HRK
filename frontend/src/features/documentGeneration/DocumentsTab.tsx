import { useMemo, useState } from 'react'

import {
  type GenerationRecord,
  type GenerationStatus,
  useAcceptGeneration,
  useDocumentGenerations,
  useRejectGeneration,
} from '@/hooks/documentGenerations'
import {
  useDeleteDocument,
  useDocumentDownloadUrl,
  useDocumentsQuery,
  useReindexDocument,
  useToggleAiAssistant,
} from '@/hooks/documents'
import { useContracts } from '@/hooks/contracts'
import { useAppSelector } from '@/hooks/store'
import {
  AiAssistantOffConfirm,
  AiAssistantToggle,
} from '@/components/ui/AiAssistantToggle'
import { deriveAiToggleState } from '@/components/ui/aiAssistantToggleHelpers'
import { OcrStatusBadge } from '@/components/ui/OcrStatusBadge'
import { PdfPreviewModal } from '@/components/ui/PdfPreviewModal'
import type { Contract, DocumentRead } from '@/types/models'
import type { OcrStatus } from '@/components/ui/OcrStatusBadge'

import { DraftDataEditModal } from './DraftDataEditModal'
import { colors, fmtMoneyPL } from './wizardStyles'

interface Props {
  customerId: string
  onOpenContract?: (contractId: string) => void
}

type QuickFilter = 'all' | 'client' | 'contracts' | 'requires_action'

const STATUS_META: Record<
  GenerationStatus,
  { label: string; bg: string; fg: string; border: string }
> = {
  draft: { label: 'Szkic', bg: '#fff8f4', fg: colors.draftText, border: colors.draftBorder },
  preview: { label: 'Do akceptacji', bg: colors.draftBg, fg: colors.draftText, border: colors.draftBorder },
  finalized: { label: 'Sfinalizowany', bg: colors.acceptedBg, fg: colors.acceptedText, border: colors.acceptedBorder },
  accepted: { label: 'Zaakceptowany', bg: colors.acceptedBg, fg: colors.acceptedText, border: colors.acceptedBorder },
  sent: { label: 'Wysłany', bg: '#ebf8ff', fg: '#2b6cb0', border: '#bee3f8' },
  superseded: { label: 'Zastąpiony', bg: '#f0eeeb', fg: colors.textSubtle, border: colors.border },
  rejected: { label: 'Odrzucony', bg: colors.rejectedBg, fg: colors.rejectedText, border: colors.rejectedBorder },
}

const DOC_TYPE_LABELS: Record<string, string> = {
  contract: 'Umowa',
  amendment: 'Aneks',
  power_of_attorney: 'Pełnomocnictwo',
  service_order: 'Zamówienie',
  invoice: 'Faktura',
  other: 'Inny',
}

const FILTER_LABELS: Record<QuickFilter, string> = {
  all: 'Wszystkie',
  client: 'Klient',
  contracts: 'Umowy',
  requires_action: 'Wymaga akcji',
}

export function DocumentsTab({ customerId, onOpenContract }: Props) {
  const user = useAppSelector((s) => s.auth.user)
  const { data: generations = [], isLoading: genLoading } = useDocumentGenerations(customerId)
  const { data: attachments = [], isLoading: attLoading } = useDocumentsQuery({ customer_id: customerId })
  const { data: contracts = [] } = useContracts({ customer_id: customerId })
  const acceptMut = useAcceptGeneration()
  const rejectMut = useRejectGeneration()
  const downloadMut = useDocumentDownloadUrl()
  const deleteMut = useDeleteDocument()
  const toggleAi = useToggleAiAssistant()
  const reindexMut = useReindexDocument()
  const [busyId, setBusyId] = useState<string | null>(null)
  const [filter, setFilter] = useState<QuickFilter>('all')
  const [typeFilter, setTypeFilter] = useState<string>('')

  const [previewDoc, setPreviewDoc] = useState<{ id: string; title: string } | null>(null)
  const [editingGen, setEditingGen] = useState<GenerationRecord | null>(null)
  const [confirmAiOff, setConfirmAiOff] = useState<string | null>(null)
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())

  const isLoading = genLoading || attLoading
  const pendingGens = generations.filter((g) => g.status === 'preview' || g.status === 'draft')

  const filteredDocs = useMemo(() => {
    // Exclude attachments belonging to pending (not yet accepted) generations
    const pendingAttachmentIds = new Set(
      pendingGens.flatMap((g) => [g.attachment_pdf_id, g.cover_letter_attachment_id].filter(Boolean)),
    )
    let docs = attachments.filter((a) => !pendingAttachmentIds.has(a.id))
    if (filter === 'client') docs = docs.filter((a) => !a.contract_id)
    else if (filter === 'contracts') docs = docs.filter((a) => !!a.contract_id)
    else if (filter === 'requires_action') return []
    if (typeFilter) docs = docs.filter((a) => a.document_type === typeFilter)
    return docs
  }, [attachments, filter, typeFilter, pendingGens])

  const docTypes = useMemo(() => {
    const set = new Set(attachments.map((a) => a.document_type))
    return Array.from(set).sort()
  }, [attachments])

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
      await rejectMut.mutateAsync({ id: gen.id, rejected_by: user.id, customer_id: gen.customer_id })
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

  function handlePreview(attachmentId: string | null, title: string) {
    if (!attachmentId || !user?.id) return
    setPreviewDoc({ id: attachmentId, title })
  }

  async function handleDelete(doc: DocumentRead) {
    if (!user?.id) return
    if (!window.confirm(`Usunąć dokument "${doc.original_filename}"? Ta operacja jest nieodwracalna.`)) return
    try {
      await deleteMut.mutateAsync({ id: doc.id, userId: user.id })
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Nieznany błąd'
      alert(`Nie udało się usunąć dokumentu.\n\n${msg}`)
    }
  }

  async function handleAiToggle(doc: DocumentRead, next: boolean) {
    if (!user?.id) return
    if (!next) { setConfirmAiOff(doc.id); return }
    try {
      await toggleAi.mutateAsync({ id: doc.id, enabled: true, userId: user.id })
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Nieznany błąd'
      alert(`Nie udało się włączyć dokumentu w asystencie AI.\n\n${msg}`)
    }
  }

  async function handleAiRetry(doc: DocumentRead) {
    if (!user?.id) return
    try {
      await reindexMut.mutateAsync({ id: doc.id, userId: user.id })
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Nieznany błąd'
      alert(`Nie udało się ponowić indeksacji.\n\n${msg}`)
    }
  }

  async function handleConfirmedAiOff() {
    if (!user?.id || !confirmAiOff) return
    try {
      await toggleAi.mutateAsync({ id: confirmAiOff, enabled: false, userId: user.id })
      setConfirmAiOff(null)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Nieznany błąd'
      alert(`Nie udało się wyłączyć dokumentu z asystenta AI.\n\n${msg}`)
    }
  }

  return (
    <div>
      {/* Filters */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
        {(Object.keys(FILTER_LABELS) as QuickFilter[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            style={{
              padding: '5px 12px',
              borderRadius: 6,
              border: `1px solid ${filter === f ? '#e85c04' : colors.border}`,
              background: filter === f ? '#fff5f0' : 'white',
              color: filter === f ? '#c94f02' : colors.textPrimary,
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            {FILTER_LABELS[f]}
            {f === 'requires_action' && pendingGens.length > 0 && ` (${pendingGens.length})`}
          </button>
        ))}
        {docTypes.length > 1 && (
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            style={{ padding: '5px 10px', borderRadius: 6, border: `1px solid ${colors.border}`, fontSize: 12, background: 'white', color: colors.textPrimary }}
          >
            <option value="">Typ: wszystkie</option>
            {docTypes.map((t) => (
              <option key={t} value={t}>{DOC_TYPE_LABELS[t] ?? t}</option>
            ))}
          </select>
        )}
      </div>

      {isLoading && <p style={{ fontSize: 13, color: colors.textMuted }}>Ładowanie…</p>}

      {/* Wymaga akcji */}
      {pendingGens.length > 0 && filter !== 'client' && (
        <section style={{ marginBottom: 20, background: '#fff8f4', border: '1px solid #fdd5b8', borderRadius: 10, padding: '14px 16px' }}>
          <SectionLabel accent="#c94f02">Wymaga akcji ({pendingGens.length})</SectionLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {pendingGens.map((g) => (
              <GenerationRow
                key={g.id}
                gen={g}
                busy={busyId === g.id}
                onAccept={() => handleAccept(g)}
                onReject={() => handleReject(g)}
                onDownloadPdf={() => handleDownload(g.attachment_pdf_id)}
                onDownloadCover={() => handleDownload(g.cover_letter_attachment_id)}
                onEdit={() => setEditingGen(g)}
              />
            ))}
          </div>
        </section>
      )}

      {/* Document stream — grouped by contract, collapsible */}
      {filter !== 'requires_action' && (
        <section style={{ marginBottom: 20 }}>
          <SectionLabel>Dokumenty ({filteredDocs.length})</SectionLabel>
          {filteredDocs.length === 0 ? (
            <EmptyState>Brak dokumentów pasujących do filtra.</EmptyState>
          ) : (
            <GroupedDocumentList
              docs={filteredDocs}
              contracts={contracts}
              collapsed={collapsed}
              onToggleCollapse={setCollapsed}
              onDownload={handleDownload}
              onPreview={handlePreview}
              onDelete={handleDelete}
              onAiToggle={handleAiToggle}
              onAiRetry={handleAiRetry}
              onOpenContract={onOpenContract}
              deleteBusy={deleteMut.isPending ? deleteMut.variables?.id ?? null : null}
              toggleAiBusy={toggleAi.isPending ? toggleAi.variables?.id ?? null : null}
              reindexBusy={reindexMut.isPending ? reindexMut.variables?.id ?? null : null}
            />
          )}
        </section>
      )}

      {!isLoading && pendingGens.length === 0 && attachments.length === 0 && (
        <EmptyState>Brak dokumentów. Kliknij <strong>Dodaj dokument</strong> lub <strong>Generuj dokument</strong>, aby zacząć.</EmptyState>
      )}

      {previewDoc && user?.id && (
        <PdfPreviewModal
          key={previewDoc.id}
          attachmentId={previewDoc.id}
          title={previewDoc.title}
          userId={user.id}
          onClose={() => setPreviewDoc(null)}
        />
      )}

      {editingGen && (
        <DraftDataEditModal
          key={editingGen.id}
          gen={editingGen}
          isOpen={!!editingGen}
          onClose={() => setEditingGen(null)}
          onSaved={() => setEditingGen(null)}
        />
      )}

      <AiAssistantOffConfirm
        isOpen={confirmAiOff !== null}
        count={1}
        busy={toggleAi.isPending}
        onConfirm={handleConfirmedAiOff}
        onCancel={() => setConfirmAiOff(null)}
      />
    </div>
  )
}

// ── Grouped document list with collapsible sections ──────────────────────────

function GroupedDocumentList({
  docs,
  contracts,
  collapsed,
  onToggleCollapse,
  onDownload,
  onPreview,
  onDelete,
  onAiToggle,
  onAiRetry,
  onOpenContract,
  deleteBusy,
  toggleAiBusy,
  reindexBusy,
}: {
  docs: DocumentRead[]
  contracts: Contract[]
  collapsed: Set<string>
  onToggleCollapse: React.Dispatch<React.SetStateAction<Set<string>>>
  onDownload: (id: string) => void
  onPreview: (id: string, title: string) => void
  onDelete: (doc: DocumentRead) => void
  onAiToggle: (doc: DocumentRead, next: boolean) => void
  onAiRetry: (doc: DocumentRead) => void
  onOpenContract?: (contractId: string) => void
  deleteBusy: string | null
  toggleAiBusy: string | null
  reindexBusy: string | null
}) {
  const groups = useMemo(() => {
    const byContract = new Map<string, DocumentRead[]>()
    const clientDocs: DocumentRead[] = []
    for (const doc of docs) {
      if (doc.contract_id) {
        const arr = byContract.get(doc.contract_id) ?? []
        arr.push(doc)
        byContract.set(doc.contract_id, arr)
      } else {
        clientDocs.push(doc)
      }
    }
    const contractMap = new Map(contracts.map((c) => [c.id, c]))
    const contractGroups: { contract: Contract; docs: DocumentRead[] }[] = []
    for (const [contractId, cDocs] of byContract) {
      const contract = contractMap.get(contractId)
      if (contract) contractGroups.push({ contract, docs: cDocs })
      else clientDocs.push(...cDocs)
    }
    contractGroups.sort((a, b) => (b.contract.start_date ?? '').localeCompare(a.contract.start_date ?? ''))
    return { contractGroups, clientDocs }
  }, [docs, contracts])

  function toggle(id: string) {
    onToggleCollapse((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {groups.contractGroups.map(({ contract, docs: cDocs }) => {
        const isOpen = !collapsed.has(contract.id)
        return (
          <div key={contract.id} style={{ border: `1px solid ${colors.border}`, borderRadius: 10, overflow: 'hidden' }}>
            {/* Contract header — clickable to collapse */}
            <button
              onClick={() => toggle(contract.id)}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                width: '100%', padding: '12px 16px',
                background: '#f9f7f5', border: 'none', borderBottom: isOpen ? `1px solid ${colors.border}` : 'none',
                cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <svg
                  width="14" height="14" viewBox="0 0 24 24" fill="none"
                  stroke="#9e9389" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                  style={{ transition: 'transform 0.2s', transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)', flexShrink: 0 }}
                >
                  <polyline points="9 18 15 12 9 6" />
                </svg>
                <span style={{ fontSize: 14 }}>📋</span>
                <div style={{ textAlign: 'left' }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: colors.textPrimary }}>
                    Umowa {contract.contract_number}
                  </div>
                  <div style={{ fontSize: 11, color: colors.textMuted, marginTop: 2 }}>
                    {cDocs.length} {cDocs.length === 1 ? 'plik' : 'plików'}
                  </div>
                </div>
              </div>
              {onOpenContract && (
                <span
                  onClick={(e) => { e.stopPropagation(); onOpenContract(contract.id) }}
                  style={{ ...btnLinkStyle, color: '#2b6cb0', borderColor: '#bee3f8' }}
                >
                  Otwórz umowę →
                </span>
              )}
            </button>
            {/* Collapsible content */}
            {isOpen && (
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {cDocs.map((doc) => (
                  <AttachmentRow
                    key={doc.id}
                    doc={doc}
                    onDownload={() => onDownload(doc.id)}
                    onPreview={() => onPreview(doc.id, doc.original_filename)}
                    onDelete={() => onDelete(doc)}
                    onAiToggle={(next) => onAiToggle(doc, next)}
                    onAiRetry={() => onAiRetry(doc)}
                    deleteBusy={deleteBusy === doc.id}
                    aiBusy={toggleAiBusy === doc.id || reindexBusy === doc.id}
                  />
                ))}
              </div>
            )}
          </div>
        )
      })}
      {groups.clientDocs.length > 0 && (
        <div style={{ border: `1px solid ${colors.border}`, borderRadius: 10, overflow: 'hidden' }}>
          <button
            onClick={() => toggle('__client__')}
            style={{
              display: 'flex', alignItems: 'center', gap: 10,
              width: '100%', padding: '12px 16px',
              background: '#f9f7f5', border: 'none',
              borderBottom: !collapsed.has('__client__') ? `1px solid ${colors.border}` : 'none',
              cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            <svg
              width="14" height="14" viewBox="0 0 24 24" fill="none"
              stroke="#9e9389" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
              style={{ transition: 'transform 0.2s', transform: !collapsed.has('__client__') ? 'rotate(90deg)' : 'rotate(0deg)', flexShrink: 0 }}
            >
              <polyline points="9 18 15 12 9 6" />
            </svg>
            <span style={{ fontSize: 14 }}>📂</span>
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: colors.textPrimary }}>
                Dokumenty klienta
              </div>
              <div style={{ fontSize: 11, color: colors.textMuted, marginTop: 2 }}>
                {groups.clientDocs.length} {groups.clientDocs.length === 1 ? 'plik' : 'plików'}
              </div>
            </div>
          </button>
          {!collapsed.has('__client__') && (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {groups.clientDocs.map((doc) => (
                <AttachmentRow
                  key={doc.id}
                  doc={doc}
                  onDownload={() => onDownload(doc.id)}
                  onPreview={() => onPreview(doc.id, doc.original_filename)}
                  onDelete={() => onDelete(doc)}
                  onAiToggle={(next) => onAiToggle(doc, next)}
                  onAiRetry={() => onAiRetry(doc)}
                  deleteBusy={deleteBusy === doc.id}
                  aiBusy={toggleAiBusy === doc.id || reindexBusy === doc.id}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Sub-components ──────────────────────────────────────────────────────────

interface RowProps {
  gen: GenerationRecord
  busy: boolean
  onAccept: () => void
  onReject: () => void
  onDownloadPdf: () => void
  onDownloadCover: () => void
  onEdit: () => void
}

function GenerationRow({ gen, busy, onAccept, onReject, onDownloadPdf, onDownloadCover, onEdit }: RowProps) {
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
            fontSize: 9, fontWeight: 700, color: '#7a6f67',
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
            <button onClick={onEdit} disabled={busy} style={btnEditStyle}>Edytuj dane</button>
            <button onClick={onAccept} disabled={busy} style={btnAcceptStyle}>
              {busy ? 'Akceptuję…' : 'Akceptuj'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}

function AttachmentRow({
  doc,
  onDownload,
  onPreview,
  onDelete,
  onAiToggle,
  onAiRetry,
  deleteBusy,
  aiBusy,
}: {
  doc: DocumentRead
  onDownload: () => void
  onPreview: () => void
  onDelete: () => void
  onAiToggle: (next: boolean) => void
  onAiRetry: () => void
  deleteBusy: boolean
  aiBusy: boolean
}) {
  const created = new Date(doc.created_at).toLocaleString('pl-PL', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
  const aiState = deriveAiToggleState({
    enabled: doc.include_in_ai_assistant,
    ocrStatus: doc.ocr_status as OcrStatus,
    mimeType: doc.mime_type,
  })

  return (
    <div style={{
      padding: '12px 16px 12px 42px',
      borderBottom: `1px solid ${colors.border}`,
      display: 'flex',
      alignItems: 'center',
      gap: 14,
    }}>
      {/* Left: info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: colors.textPrimary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {doc.original_filename}
          </span>
          <span style={{ fontSize: 9.5, fontWeight: 700, padding: '2px 8px', borderRadius: 4, background: '#f2f0ed', color: '#6b6b6b', border: '1px solid #e3e0db', textTransform: 'uppercase', letterSpacing: 0.3, whiteSpace: 'nowrap', flexShrink: 0 }}>
            {DOC_TYPE_LABELS[doc.document_type] ?? doc.document_type}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11.5, color: colors.textMuted, marginTop: 3 }}>
          <span>{created}</span>
          <OcrStatusBadge status={doc.ocr_status as OcrStatus} />
        </div>
      </div>
      {/* AI toggle */}
      <AiAssistantToggle
        state={aiState}
        busy={aiBusy}
        onChange={onAiToggle}
        onRetry={onAiRetry}
        onUnsupportedClick={() =>
          alert('Format pliku niewspierany przez asystenta AI (tylko PDF, TXT i obrazy są indeksowane).')
        }
      />
      {/* Right: actions */}
      <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
        <button onClick={onPreview} style={btnLinkStyle}>Podgląd</button>
        <button onClick={onDownload} style={btnLinkStyle}>Pobierz</button>
        <button onClick={onDelete} disabled={deleteBusy} style={btnDeleteStyle}>
          {deleteBusy ? 'Usuwanie…' : 'Usuń'}
        </button>
      </div>
    </div>
  )
}

function SectionLabel({ children, accent }: { children: React.ReactNode; accent?: string }) {
  return <div style={{ fontSize: 10.5, fontWeight: 700, color: accent ?? colors.textMuted, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>{children}</div>
}

function EmptyState({ children }: { children: React.ReactNode }) {
  return <div style={{ background: '#fafaf9', borderRadius: 10, padding: 20, textAlign: 'center', color: colors.textMuted, fontSize: 13, border: `1px solid ${colors.border}` }}>{children}</div>
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

const btnDeleteStyle: React.CSSProperties = {
  background: 'white',
  color: '#dc2626',
  border: '1px solid #fecaca',
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

const btnEditStyle: React.CSSProperties = {
  background: 'white',
  color: colors.textSubtle,
  border: `1px solid ${colors.border}`,
  borderRadius: 6,
  padding: '5px 10px',
  fontSize: 11.5,
  fontWeight: 600,
  cursor: 'pointer',
  fontFamily: 'inherit',
}
