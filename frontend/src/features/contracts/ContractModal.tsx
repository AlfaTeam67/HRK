import { useState, useEffect, useRef } from 'react'

import { useContract, useUpdateContract } from '@/hooks/contracts'
import { useDocumentsQuery, useDocumentDownloadUrl, useDeleteDocument } from '@/hooks/documents'
import { useDocumentGenerations, useAcceptGeneration, useRejectGeneration } from '@/hooks/documentGenerations'
import { useNotes, useCreateNote } from '@/hooks/notes'
import { useAppSelector } from '@/hooks/store'
import { UploadWizard } from '@/features/documents/UploadWizard'
import { PdfPreviewModal } from '@/components/ui/PdfPreviewModal'
import { OcrStatusBadge } from '@/components/ui/OcrStatusBadge'
import type { OcrStatus } from '@/components/ui/OcrStatusBadge'
import type { ContractStatus, ContractType, BillingCycle } from '@/types/models'

/* ─── Palette ─────────────────────────────────────────────────── */
const C = {
  bg: '#ffffff',
  surface: '#fafaf9',
  border: '#e8e5e0',
  orange: '#e85c04',
  text: '#1a1714',
  muted: '#9e9389',
  subtle: '#6b6361',
  green: '#276749',
  greenBg: '#f0fff4',
  red: '#c94f02',
  redBg: '#fff5f0',
  blue: '#1d4ed8',
  blueBg: '#eff6ff',
}

const CONTRACT_TYPES: ContractType[] = ['ramowa', 'aneks', 'SLA', 'DPA', 'PPK', 'inne']
const CONTRACT_STATUSES: ContractStatus[] = ['draft', 'signed', 'active', 'terminated', 'expiring']
const BILLING_CYCLES: { v: BillingCycle; l: string }[] = [
  { v: 'monthly', l: 'Miesięczny' },
  { v: 'quarterly', l: 'Kwartalny' },
  { v: 'annual', l: 'Roczny' },
  { v: 'one_time', l: 'Jednorazowy' },
]
const DOC_TYPE_LABELS: Record<string, string> = {
  contract: 'Umowa',
  amendment: 'Aneks',
  power_of_attorney: 'Pełnomocnictwo',
  service_order: 'Zamówienie',
  invoice: 'Faktura',
  other: 'Inny',
}
const STATUS_COLOR: Record<string, string> = {
  draft: '#6b6b6b', signed: '#4338ca', active: '#276749',
  terminated: '#c94f02', expiring: '#92400e',
}
const GEN_STATUS_META: Record<string, { l: string; bg: string; fg: string }> = {
  draft:      { l: 'Szkic',         bg: '#fff8f4', fg: '#c94f02' },
  preview:    { l: 'Do akceptacji', bg: '#fff8f4', fg: '#c94f02' },
  finalized:  { l: 'Sfinalizowany', bg: '#f0fff4', fg: '#276749' },
  accepted:   { l: 'Zaakceptowany', bg: '#f0fff4', fg: '#276749' },
  sent:       { l: 'Wysłany',       bg: '#eff6ff', fg: '#1d4ed8' },
  superseded: { l: 'Zastąpiony',    bg: '#f0eeeb', fg: '#9e9389' },
  rejected:   { l: 'Odrzucony',     bg: '#fff5f0', fg: '#c94f02' },
}

function fmtDate(v?: string | null) {
  if (!v) return '—'
  return new Date(v).toLocaleDateString('pl-PL', { day: '2-digit', month: 'short', year: 'numeric' })
}

type Tab = 'dane' | 'dokumenty' | 'notatki'

interface Props {
  contractId: string
  customerId: string
  onClose: () => void
  autoEdit?: boolean
}

export function ContractModal({ contractId, customerId, onClose, autoEdit = false }: Props) {
  const user = useAppSelector((s) => s.auth.user)
  const [activeTab, setActiveTab] = useState<Tab>('dane')

  const { data: contract, isLoading } = useContract(contractId)
  const { data: attachments = [] } = useDocumentsQuery({ contract_id: contractId })
  const { data: allGenerations = [] } = useDocumentGenerations(customerId)
  const { data: notes = [] } = useNotes({ contract_id: contractId })
  const generations = allGenerations.filter((g) => g.contract_id === contractId)

  const updateContract = useUpdateContract()
  const deleteMut = useDeleteDocument()
  const downloadMut = useDocumentDownloadUrl()
  const acceptMut = useAcceptGeneration()
  const rejectMut = useRejectGeneration()
  const createNote = useCreateNote()

  const [uploadWizardOpen, setUploadWizardOpen] = useState(false)
  const [previewDoc, setPreviewDoc] = useState<{ id: string; title: string } | null>(null)

  /* ─── Edit form state ───────────────────────────────────────── */
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({
    contract_number: '',
    contract_type: '' as ContractType,
    status: '' as ContractStatus,
    start_date: '',
    end_date: '',
    billing_cycle: '' as BillingCycle | '',
    notes: '',
  })

  const autoEditDone = useRef(false)
  useEffect(() => {
    if (autoEdit && contract && !autoEditDone.current) {
      autoEditDone.current = true
      setForm({
        contract_number: contract.contract_number,
        contract_type: contract.contract_type,
        status: contract.status,
        start_date: contract.start_date,
        end_date: contract.end_date ?? '',
        billing_cycle: contract.billing_cycle ?? '',
        notes: contract.notes ?? '',
      })
      setEditing(true)
    }
  }, [autoEdit, contract])

  function startEdit() {
    if (!contract) return
    setForm({
      contract_number: contract.contract_number,
      contract_type: contract.contract_type,
      status: contract.status,
      start_date: contract.start_date,
      end_date: contract.end_date ?? '',
      billing_cycle: contract.billing_cycle ?? '',
      notes: contract.notes ?? '',
    })
    setEditing(true)
  }

  async function saveEdit() {
    await updateContract.mutateAsync({
      id: contractId,
      payload: {
        contract_number: form.contract_number || null,
        contract_type: form.contract_type || null,
        status: form.status || null,
        start_date: form.start_date || null,
        end_date: form.end_date || null,
        billing_cycle: (form.billing_cycle as BillingCycle) || null,
        notes: form.notes || null,
      },
    })
    setEditing(false)
  }

  async function handleDownload(id: string) {
    if (!user?.id) return
    const { url } = await downloadMut.mutateAsync({ id, userId: user.id })
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  function handlePreview(id: string, title: string) {
    setPreviewDoc({ id, title })
  }

  async function handleDeleteDoc(id: string) {
    if (!user?.id || !window.confirm('Usunąć ten plik?')) return
    await deleteMut.mutateAsync({ id, userId: user.id })
  }

  /* ─── Note state ────────────────────────────────────────────── */
  const [noteText, setNoteText] = useState('')
  async function addNote() {
    if (!noteText.trim() || !user?.id) return
    await createNote.mutateAsync({
      contract_id: contractId,
      customer_id: customerId,
      content: noteText,
      note_type: 'internal',
    })
    setNoteText('')
  }

  /* ─── Generation actions ────────────────────────────────────── */
  const [busyGenId, setBusyGenId] = useState<string | null>(null)

  async function handleAccept(genId: string) {
    if (!user?.id) return
    setBusyGenId(genId)
    try { await acceptMut.mutateAsync({ id: genId, accepted_by: user.id }) }
    finally { setBusyGenId(null) }
  }

  async function handleReject(genId: string, cid: string) {
    if (!user?.id || !window.confirm('Odrzucić ten dokument?')) return
    setBusyGenId(genId)
    try { await rejectMut.mutateAsync({ id: genId, rejected_by: user.id, customer_id: cid }) }
    finally { setBusyGenId(null) }
  }

  /* ─── Render ────────────────────────────────────────────────── */
  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(26,23,20,0.45)', backdropFilter: 'blur(2px)',
        padding: 24,
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{
        background: C.bg,
        borderRadius: 14,
        width: '100%', maxWidth: 720,
        maxHeight: '90vh',
        display: 'flex', flexDirection: 'column',
        boxShadow: '0 24px 64px rgba(0,0,0,0.22)',
        overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          padding: '18px 24px 0',
          borderBottom: `1px solid ${C.border}`,
          flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14 }}>
            <div>
              {isLoading ? (
                <div style={{ width: 200, height: 20, background: '#f2f0ed', borderRadius: 4 }} />
              ) : (
                <>
                  <div style={{ fontSize: 18, fontWeight: 800, color: C.text }}>
                    {contract?.contract_number ?? '—'}
                  </div>
                  <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>
                    {contract?.contract_type} · {fmtDate(contract?.start_date)} → {fmtDate(contract?.end_date)}
                    {contract?.status && (
                      <span style={{
                        marginLeft: 10, fontSize: 10, fontWeight: 700, padding: '1px 7px',
                        borderRadius: 10, background: STATUS_COLOR[contract.status] + '18',
                        color: STATUS_COLOR[contract.status], textTransform: 'uppercase',
                      }}>
                        {contract.status}
                      </span>
                    )}
                  </div>
                </>
              )}
            </div>
            <button
              onClick={onClose}
              style={{
                background: 'none', border: `1px solid ${C.border}`, borderRadius: 8,
                width: 34, height: 34, cursor: 'pointer', fontSize: 16, color: C.muted,
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}
            >✕</button>
          </div>

          {/* Tabs */}
          <div style={{ display: 'flex', gap: 0 }}>
            {([
              ['dane', 'Dane umowy'],
              ['dokumenty', `Dokumenty (${attachments.length})`],
              ['notatki', `Notatki (${notes.length})`],
            ] as [Tab, string][]).map(([k, label]) => (
              <button
                key={k}
                onClick={() => setActiveTab(k)}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  padding: '8px 16px', fontSize: 13, fontWeight: activeTab === k ? 700 : 500,
                  color: activeTab === k ? C.orange : C.muted,
                  borderBottom: activeTab === k ? `2px solid ${C.orange}` : '2px solid transparent',
                  fontFamily: 'inherit', transition: 'color 0.12s',
                  marginBottom: -1,
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
          {activeTab === 'dane' && (
            <DaneTab
              contract={contract}
              editing={editing}
              form={form}
              saving={updateContract.isPending}
              onStartEdit={startEdit}
              onCancelEdit={() => setEditing(false)}
              onSave={saveEdit}
              onFormChange={(k, v) => setForm((p) => ({ ...p, [k]: v }))}
            />
          )}

          {activeTab === 'dokumenty' && (
            <DokumentyTab
              contract={contract}
              attachments={attachments}
              generations={generations}
              busyGenId={busyGenId}
              onOpenWizard={() => setUploadWizardOpen(true)}
              onSetPrimary={(id) => updateContract.mutateAsync({ id: contractId, payload: { primary_document_id: id } })}
              onDownload={handleDownload}
              onPreview={handlePreview}
              onDelete={handleDeleteDoc}
              onAccept={handleAccept}
              onReject={handleReject}
            />
          )}

          {activeTab === 'notatki' && (
            <HistoriaTab
              notes={notes}
              noteText={noteText}
              saving={createNote.isPending}
              onNoteChange={setNoteText}
              onAddNote={addNote}
            />
          )}
        </div>
      </div>

      {uploadWizardOpen && (
        <UploadWizard
          customerId={customerId}
          preselectedContractId={contractId}
          onClose={() => setUploadWizardOpen(false)}
        />
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
    </div>
  )
}

/* ─── Tab: Dane umowy ─────────────────────────────────────────── */
function DaneTab({ contract, editing, form, saving, onStartEdit, onCancelEdit, onSave, onFormChange }: {
  contract: ReturnType<typeof useContract>['data']
  editing: boolean
  form: Record<string, string>
  saving: boolean
  onStartEdit: () => void
  onCancelEdit: () => void
  onSave: () => void
  onFormChange: (k: string, v: string) => void
}) {
  if (!contract) return <p style={{ color: C.muted, fontSize: 13 }}>Ładowanie…</p>

  if (editing) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Field label="Numer umowy">
          <input value={form.contract_number} onChange={(e) => onFormChange('contract_number', e.target.value)} style={inputStyle} />
        </Field>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Field label="Typ umowy">
            <select value={form.contract_type} onChange={(e) => onFormChange('contract_type', e.target.value)} style={inputStyle}>
              {CONTRACT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </Field>
          <Field label="Status">
            <select value={form.status} onChange={(e) => onFormChange('status', e.target.value)} style={inputStyle}>
              {CONTRACT_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </Field>
          <Field label="Data od">
            <input type="date" value={form.start_date} onChange={(e) => onFormChange('start_date', e.target.value)} style={inputStyle} />
          </Field>
          <Field label="Data do">
            <input type="date" value={form.end_date} onChange={(e) => onFormChange('end_date', e.target.value)} style={inputStyle} />
          </Field>
          <Field label="Cykl rozliczeniowy">
            <select value={form.billing_cycle} onChange={(e) => onFormChange('billing_cycle', e.target.value)} style={inputStyle}>
              <option value="">—</option>
              {BILLING_CYCLES.map((b) => <option key={b.v} value={b.v}>{b.l}</option>)}
            </select>
          </Field>
        </div>
        <Field label="Notatki">
          <textarea
            value={form.notes}
            onChange={(e) => onFormChange('notes', e.target.value)}
            rows={3}
            style={{ ...inputStyle, resize: 'vertical' }}
          />
        </Field>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onCancelEdit} style={btnSecondary}>Anuluj</button>
          <button onClick={onSave} disabled={saving} style={btnPrimary}>
            {saving ? 'Zapisuję…' : 'Zapisz zmiany'}
          </button>
        </div>
      </div>
    )
  }

  const rows = [
    { label: 'Numer umowy', value: contract.contract_number },
    { label: 'Typ', value: contract.contract_type },
    { label: 'Status', value: contract.status },
    { label: 'Data rozpoczęcia', value: fmtDate(contract.start_date) },
    { label: 'Data zakończenia', value: fmtDate(contract.end_date) },
    { label: 'Cykl rozliczeniowy', value: BILLING_CYCLES.find((b) => b.v === contract.billing_cycle)?.l ?? '—' },
    { label: 'Dodano', value: fmtDate(contract.created_at) },
    { label: 'Zaktualizowano', value: fmtDate(contract.updated_at) },
  ]

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
        {rows.map((r) => (
          <div key={r.label} style={{ background: C.surface, borderRadius: 8, padding: '10px 14px', border: `1px solid ${C.border}` }}>
            <div style={{ fontSize: 10.5, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3 }}>{r.label}</div>
            <div style={{ fontSize: 13.5, fontWeight: 600, color: C.text }}>{r.value ?? '—'}</div>
          </div>
        ))}
      </div>
      {contract.notes && (
        <div style={{ background: C.surface, borderRadius: 8, padding: '12px 14px', border: `1px solid ${C.border}`, marginBottom: 16 }}>
          <div style={{ fontSize: 10.5, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Notatki</div>
          <p style={{ fontSize: 13, color: C.text, margin: 0, lineHeight: 1.6 }}>{contract.notes}</p>
        </div>
      )}
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button onClick={onStartEdit} style={btnPrimary}>Edytuj</button>
      </div>
    </div>
  )
}

/* ─── Tab: Dokumenty ──────────────────────────────────────────── */
function DokumentyTab({ contract, attachments, generations, busyGenId, onOpenWizard, onSetPrimary, onDownload, onPreview, onDelete, onAccept, onReject }: {
  contract: ReturnType<typeof useContract>['data']
  attachments: ReturnType<typeof useDocumentsQuery>['data'] & object[]
  generations: ReturnType<typeof useDocumentGenerations>['data'] & object[]
  busyGenId: string | null
  onOpenWizard: () => void
  onSetPrimary: (id: string) => void
  onDownload: (id: string) => void
  onPreview: (id: string, title: string) => void
  onDelete: (id: string) => void
  onAccept: (id: string) => void
  onReject: (id: string, customerId: string) => void
}) {
  const primaryDocId = contract?.primary_document_id
  const primaryDoc = attachments.find((a) => a.id === primaryDocId)
  const otherDocs = attachments.filter((a) => a.id !== primaryDocId)
  const pendingGens = generations.filter((g) => g.status === 'preview' || g.status === 'draft')
  const historyGens = generations.filter((g) => g.status !== 'preview' && g.status !== 'draft')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Sekcja 1: Do akceptacji */}
      {pendingGens.length > 0 && (
        <section style={{ background: '#fff8f4', border: '1px solid #fdd5b8', borderRadius: 10, padding: '14px 16px' }}>
          <SectionHeader label={`Do akceptacji (${pendingGens.length})`} accent={C.red} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {pendingGens.map((g) => {
              const meta = GEN_STATUS_META[g.status] ?? GEN_STATUS_META['draft']
              const busy = busyGenId === g.id
              const delta = (g.simulation as Record<string, unknown>)?.delta_annual_revenue as string | undefined
              return (
                <div key={g.id} style={{ ...rowStyle, borderLeft: `3px solid ${meta.fg}` }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                      <span style={{ fontSize: 9.5, fontWeight: 700, padding: '2px 8px', borderRadius: 4, background: meta.bg, color: meta.fg, textTransform: 'uppercase' as const, letterSpacing: 0.3 }}>{meta.l}</span>
                      <span style={{ fontSize: 12.5, fontWeight: 700, color: C.text }}>{g.template_key} v{g.template_version}</span>
                    </div>
                    <div style={{ fontSize: 11, color: C.muted }}>{fmtDate(g.created_at)}{delta && <> · Δ rok: <strong style={{ color: C.text }}>{delta}</strong></>}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0, alignItems: 'center' }}>
                    {g.attachment_pdf_id && <button onClick={() => onDownload(g.attachment_pdf_id!)} style={btnSecondary}>PDF</button>}
                    <button onClick={() => onReject(g.id, g.customer_id)} disabled={busy} style={btnDanger}>Odrzuć</button>
                    <button onClick={() => onAccept(g.id)} disabled={busy} style={btnPrimary}>{busy ? 'Akceptuję…' : 'Akceptuj'}</button>
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* Sekcja 2: Główny dokument */}
      <section>
        <SectionHeader label="Główny dokument" />
        {primaryDoc ? (
          <DocRow
            doc={primaryDoc}
            isPrimary
            onPreview={() => onPreview(primaryDoc.id, primaryDoc.original_filename)}
            onDownload={() => onDownload(primaryDoc.id)}
            onDelete={() => onDelete(primaryDoc.id)}
          />
        ) : (
          <div style={{ background: C.surface, border: `2px dashed ${C.border}`, borderRadius: 10, padding: '20px 16px', textAlign: 'center' }}>
            <p style={{ fontSize: 12.5, color: C.muted, margin: '0 0 12px' }}>Brak głównego dokumentu umowy</p>
            <button onClick={onOpenWizard} style={btnPrimary}>+ Wgraj dokument</button>
          </div>
        )}
      </section>

      {/* Sekcja 3: Pozostałe załączniki */}
      <section>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <SectionHeader label={`Załączniki (${otherDocs.length})`} noMargin />
          <button onClick={onOpenWizard} style={btnSecondary}>+ Dodaj</button>
        </div>
        {otherDocs.length === 0 ? (
          <Empty>Brak dodatkowych załączników.</Empty>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {otherDocs.map((doc) => (
              <DocRow
                key={doc.id}
                doc={doc}
                onPreview={() => onPreview(doc.id, doc.original_filename)}
                onDownload={() => onDownload(doc.id)}
                onDelete={() => onDelete(doc.id)}
                onSetPrimary={() => onSetPrimary(doc.id)}
              />
            ))}
          </div>
        )}
      </section>

      {/* Sekcja 4: Historia aneksów */}
      {historyGens.length > 0 && (
        <section>
          <SectionHeader label={`Historia aneksów (${historyGens.length})`} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {historyGens.map((g) => {
              const meta = GEN_STATUS_META[g.status] ?? GEN_STATUS_META['finalized']
              const delta = (g.simulation as Record<string, unknown>)?.delta_annual_revenue as string | undefined
              return (
                <div key={g.id} style={{ ...rowStyle, borderLeft: `3px solid ${meta.fg}`, opacity: g.status === 'superseded' || g.status === 'rejected' ? 0.65 : 1 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                      <span style={{ fontSize: 9.5, fontWeight: 700, padding: '2px 8px', borderRadius: 4, background: meta.bg, color: meta.fg, textTransform: 'uppercase' as const, letterSpacing: 0.3 }}>{meta.l}</span>
                      <span style={{ fontSize: 12.5, fontWeight: 700, color: C.text }}>{g.template_key} v{g.template_version}</span>
                    </div>
                    <div style={{ fontSize: 11, color: C.muted }}>{fmtDate(g.created_at)}{delta && <> · Δ rok: <strong style={{ color: C.text }}>{delta}</strong></>}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                    {g.attachment_pdf_id && <button onClick={() => onDownload(g.attachment_pdf_id!)} style={btnSecondary}>Aneks PDF</button>}
                    {g.cover_letter_attachment_id && <button onClick={() => onDownload(g.cover_letter_attachment_id!)} style={btnSecondary}>Pismo PDF</button>}
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      )}

    </div>
  )
}

function DocRow({ doc, isPrimary, onPreview, onDownload, onDelete, onSetPrimary }: {
  doc: { id: string; original_filename: string; document_type: string; ocr_status?: string | null; created_at: string }
  isPrimary?: boolean
  onPreview: () => void
  onDownload: () => void
  onDelete: () => void
  onSetPrimary?: () => void
}) {
  return (
    <div style={{ ...rowStyle, borderLeft: isPrimary ? `3px solid ${C.orange}` : `3px solid #9e9389` }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          {isPrimary && <span style={{ fontSize: 9, fontWeight: 700, color: C.orange, background: '#fff8f4', border: `1px solid #fdd5b8`, borderRadius: 4, padding: '1px 6px', textTransform: 'uppercase' as const }}>GŁÓWNY</span>}
          <span style={{ fontSize: 13, fontWeight: 700, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {doc.original_filename}
          </span>
          <span style={{ ...tagStyle, flexShrink: 0 }}>{DOC_TYPE_LABELS[doc.document_type] ?? doc.document_type}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 11, color: C.muted }}>{fmtDate(doc.created_at)}</span>
          <OcrStatusBadge status={doc.ocr_status as OcrStatus} />
        </div>
      </div>
      <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
        {onSetPrimary && <button onClick={onSetPrimary} title="Ustaw jako główny" style={{ ...btnSecondary, fontSize: 11 }}>Ustaw główny</button>}
        <button onClick={onPreview} style={btnSecondary}>Podgląd</button>
        <button onClick={onDownload} style={btnSecondary}>Pobierz</button>
        <button onClick={onDelete} style={btnDanger}>✕</button>
      </div>
    </div>
  )
}

function SectionHeader({ label, noMargin, accent }: { label: string; noMargin?: boolean; accent?: string }) {
  return (
    <div style={{ fontSize: 10.5, fontWeight: 700, color: accent ?? C.muted, textTransform: 'uppercase' as const, letterSpacing: '0.07em', marginBottom: noMargin ? 0 : 8 }}>
      {label}
    </div>
  )
}

/* ─── Tab: Historia / Notatki ─────────────────────────────────── */
function HistoriaTab({ notes, noteText, saving, onNoteChange, onAddNote }: {
  notes: ReturnType<typeof useNotes>['data'] & object[]
  noteText: string
  saving: boolean
  onNoteChange: (v: string) => void
  onAddNote: () => void
}) {
  return (
    <div>
      {/* Add note */}
      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: 14, marginBottom: 16 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: C.text, marginBottom: 8 }}>Dodaj notatkę</div>
        <textarea
          value={noteText}
          onChange={(e) => onNoteChange(e.target.value)}
          placeholder="Treść notatki…"
          rows={3}
          style={{ ...inputStyle, resize: 'vertical', width: '100%', marginBottom: 8 }}
        />
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button onClick={onAddNote} disabled={!noteText.trim() || saving} style={btnPrimary}>
            {saving ? 'Dodawanie…' : 'Dodaj'}
          </button>
        </div>
      </div>

      {notes.length === 0 && <Empty>Brak notatek dla tej umowy.</Empty>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {(notes ?? []).map((n) => (
          <div key={n.id} style={{ background: 'white', border: `1px solid ${C.border}`, borderRadius: 10, padding: '12px 16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={tagStyle}>{n.note_type}</span>
              <span style={{ fontSize: 11, color: C.muted }}>{fmtDate(n.created_at)}</span>
            </div>
            <p style={{ fontSize: 13, color: C.text, margin: 0, lineHeight: 1.6 }}>{n.content}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ─── Helpers ─────────────────────────────────────────────────── */
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <label style={{ fontSize: 11.5, fontWeight: 700, color: C.muted }}>{label}</label>
      {children}
    </div>
  )
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ background: C.surface, borderRadius: 10, padding: 28, textAlign: 'center', color: C.muted, fontSize: 13, border: `1px solid ${C.border}` }}>
      {children}
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  padding: '9px 12px', borderRadius: 6, border: `1px solid ${C.border}`,
  fontSize: 13, background: 'white', fontFamily: 'inherit', color: C.text, width: '100%',
  boxSizing: 'border-box',
}
const rowStyle: React.CSSProperties = {
  background: 'white', border: `1px solid ${C.border}`, borderRadius: 10,
  padding: '12px 16px', display: 'flex', justifyContent: 'space-between',
  alignItems: 'center', gap: 12,
}
const tagStyle: React.CSSProperties = {
  fontSize: 9.5, fontWeight: 700, padding: '2px 8px', borderRadius: 4,
  background: '#f2f0ed', color: '#6b6b6b', border: '1px solid #e3e0db',
  textTransform: 'uppercase', letterSpacing: 0.3,
}
const btnPrimary: React.CSSProperties = {
  background: C.orange, color: 'white', border: 'none', borderRadius: 7,
  padding: '8px 16px', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
}
const btnSecondary: React.CSSProperties = {
  background: 'white', color: C.text, border: `1px solid ${C.border}`, borderRadius: 7,
  padding: '7px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
}
const btnDanger: React.CSSProperties = {
  background: 'white', color: C.red, border: `1px solid #f2cfc8`, borderRadius: 7,
  padding: '7px 10px', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
}
