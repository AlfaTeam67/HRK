import { useState, useMemo } from 'react'

import { useContactPersons } from '@/hooks/contactPersons'
import { useContracts } from '@/hooks/contracts'
import { useCreateCustomer, useCustomer, useCustomers, useUpdateCustomer } from '@/hooks/customers'
import { useActivities } from '@/hooks/activities'
import { useCreateNote, useNotes } from '@/hooks/notes'
import { useAppSelector } from '@/hooks/store'
import {
  CUSTOMER_STATUS_PL,
  NOTE_TYPE_LABELS,
  validateCustomerForm,
  type ValidationErrors,
} from '@/lib/customerConstants'

type TabKey = 'info' | 'contracts' | 'notes' | 'timeline'

type TLType = 'meeting' | 'call' | 'note' | 'system' | 'contract_signed' | 'contract_expiring' | 'valorization' | 'alert' | 'today' | 'email' | 'document' | 'verification'

interface TLEvent { id: string; date: string; label: string; type: TLType; title: string; detail?: string }

const TODAY = new Date().toISOString().slice(0, 10)
const TODAY_LABEL = new Date().toLocaleDateString('pl-PL', { day: 'numeric', month: 'long', year: 'numeric' })

const TL_META: Record<TLType, { color: string; bg: string; label: string }> = {
  meeting:           { color: '#553c9a', bg: '#faf5ff', label: 'Spotkanie' },
  call:              { color: '#3182ce', bg: '#ebf8ff', label: 'Połączenie' },
  note:              { color: '#374151', bg: '#f3f4f6', label: 'Notatka' },
  system:            { color: '#718096', bg: '#edf2f7', label: 'System' },
  contract_signed:   { color: '#276749', bg: '#f0fff4', label: 'Umowa' },
  contract_expiring: { color: '#c94f02', bg: '#fff5f0', label: 'Termin' },
  valorization:      { color: '#2b6cb0', bg: '#ebf8ff', label: 'Waloryzacja' },
  alert:             { color: '#92400e', bg: '#fffbeb', label: 'Alert' },
  today:             { color: '#e85c04', bg: '#fff8f4', label: 'Dziś' },
  email:             { color: '#319795', bg: '#e6fffa', label: 'Email' },
  document:          { color: '#805ad5', bg: '#faf5ff', label: 'Dokument' },
  verification:      { color: '#d69e2e', bg: '#fffaf0', label: 'Weryfikacja' },
}

const RISK: Record<string, { dot: string; text: string; bg: string; border: string }> = {
  active:           { dot: '#38a169', text: '#276749', bg: '#f0fff4', border: '#c6f6d5' },
  needs_attention:  { dot: '#e85c04', text: '#c94f02', bg: '#fff5f0', border: '#fdd5b8' },
  default:          { dot: '#e53e3e', text: '#9b2c2c', bg: '#fff5f5', border: '#feb2b2' },
}

// Status labels imported from @/lib/customerConstants (single source of truth)
const STATUS_PL = CUSTOMER_STATUS_PL

function ini(n: string) {
  const w = n.replace(/[()]/g, '').split(/\s+/).filter(Boolean)
  return (w.length >= 2 ? w[0][0] + w[1][0] : (w[0] ?? '?').slice(0, 2)).toUpperCase()
}

function fmtDate(v?: string | null) {
  return v ? new Date(v).toLocaleDateString('pl-PL') : '—'
}

function risk(status: string) {
  return RISK[status] ?? RISK.default
}

function PlusIcon() {
  return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
}

function CloseIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
}

function SearchIcon() {
  return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
}

/* ─── Timeline ────────────────────────────────────────────────── */
function Timeline({ events }: { events: TLEvent[] }) {
  if (!events.length) return <p style={{ color: '#9e9389', fontSize: 13 }}>Brak zdarzeń.</p>
  return (
    <div className="cp-tl-wrap">
      <div className="cp-tl-line" />
      {events.map((ev) => {
        if (ev.type === 'today') return (
          <div key={ev.id} className="cp-tl-today">
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#e85c04', flexShrink: 0 }} />
            <span style={{ fontSize: 12, fontWeight: 800, color: '#e85c04' }}>DZIŚ — {ev.label}</span>
          </div>
        )
        const m = TL_META[ev.type] ?? TL_META.system
        return (
          <div key={ev.id} className="cp-tl-item">
            <div className="cp-tl-dot" style={{ background: m.color, boxShadow: `0 0 0 2px ${m.color}30` }} />
            <div className="cp-tl-card" style={{ borderColor: `${m.color}25`, borderLeftColor: m.color }}>
              <div style={{ marginBottom: 4 }}>
                <span className="cp-tl-badge" style={{ background: m.bg, color: m.color, border: `1px solid ${m.color}25` }}>{m.label}</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#9e9389' }}>{ev.label}</span>
              </div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#1a1714' }}>{ev.title}</div>
              {ev.detail && <div style={{ fontSize: 11.5, color: '#7a6f67', marginTop: 4 }}>{ev.detail}</div>}
            </div>
          </div>
        )
      })}
    </div>
  )
}

/* ─── Main ────────────────────────────────────────────────────── */
export function ClientsPageApi() {
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [tab, setTab] = useState<TabKey>('info')
  const [modalOpen, setModalOpen] = useState(false)
  const [modalMode, setModalMode] = useState<'add' | 'edit'>('add')
  const [form, setForm] = useState<any>({ ckk: '', status: 'active', segment: '', industry: '', employee_count: '', payment_period_days: '14', invoice_nip: '', billing_email: '', phone: '' })
  const [formErrors, setFormErrors] = useState<ValidationErrors>({})
  const [noteText, setNoteText] = useState('')
  const [noteType, setNoteType] = useState<'meeting' | 'call' | 'internal' | 'client_request' | 'other'>('internal')

  const user = useAppSelector(s => s.auth.user)

  const { data: clients = [], isLoading } = useCustomers({ q: search })
  const { data: detailCustomer } = useCustomer(selectedId ?? undefined)
  const { data: contracts = [] } = useContracts({ customer_id: selectedId ?? undefined })
  const { data: notes = [] } = useNotes({ customer_id: selectedId ?? undefined })
  const { data: activities = [] } = useActivities({ customer_id: selectedId ?? undefined })
  const { data: contacts = [] } = useContactPersons(selectedId ?? undefined)

  const createCustomer = useCreateCustomer()
  const updateCustomer = useUpdateCustomer()
  const createNote = useCreateNote()

  const selected = useMemo(() => {
    const list = clients ?? []
    if (selectedId) return list.find(c => c.id === selectedId) ?? detailCustomer ?? null
    return list[0] ?? null
  }, [selectedId, clients, detailCustomer])

  const timelineEvents = useMemo<TLEvent[]>(() => {
    const evts: TLEvent[] = activities.map(a => ({
      id: a.id, date: a.activity_date,
      label: fmtDate(a.activity_date),
      type: a.activity_type as TLType,
      title: a.description,
    }))
    evts.push({ id: `today-${TODAY}`, date: TODAY, label: TODAY_LABEL, type: 'today', title: '' })
    return evts.sort((a, b) => b.date.localeCompare(a.date))
  }, [activities])

  function openAdd() {
    setModalMode('add')
    setFormErrors({})
    setForm({ ckk: '', status: 'active', segment: '', industry: '', employee_count: '', payment_period_days: '14', invoice_nip: '', billing_email: '', phone: '', account_manager_id: user?.id ?? '' })
    setModalOpen(true)
  }

  function openEdit() {
    if (!selected) return
    setModalMode('edit')
    setFormErrors({})
    setForm({ ...selected, employee_count: selected.employee_count ?? '', payment_period_days: selected.payment_period_days ?? 14 })
    setModalOpen(true)
  }

  async function saveCustomer() {
    const errors = validateCustomerForm(form)
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors)
      return
    }
    setFormErrors({})
    try {
      const payload = {
        ...form,
        employee_count: form.employee_count !== '' ? Number(form.employee_count) : undefined,
        payment_period_days: Number(form.payment_period_days),
      }
      if (modalMode === 'add') await createCustomer.mutateAsync(payload)
      else await updateCustomer.mutateAsync({ id: selected!.id, payload })
      setModalOpen(false)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Nieznany błąd'
      console.error('[ClientsPage] saveCustomer failed:', err)
      alert(`Nie udało się zapisać klienta.\n\nSzczegóły: ${msg}`)
    }
  }

  async function addNote() {
    if (!noteText.trim() || !selectedId) return
    try {
      await createNote.mutateAsync({ content: noteText.trim(), customer_id: selectedId, note_type: noteType })
      setNoteText('')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Nieznany błąd'
      console.error('[ClientsPage] addNote failed:', err)
      alert(`Nie udało się dodać notatki.\n\nSzczegóły: ${msg}`)
    }
  }

  const r = selected ? risk(selected.status) : risk('active')
  const NOTE_TYPES: Array<typeof noteType> = ['meeting', 'call', 'internal', 'client_request', 'other']
  const NOTE_LABELS = NOTE_TYPE_LABELS as Record<typeof noteType, string>

  return (
    <div className="cp-layout">
      {/* Header */}
      <div className="cp-header">
        <div>
          <h1 className="cp-title">Klienci</h1>
          <p className="cp-subtitle">Profil 360° — dane firmy, umowy, notatki i historia kontaktu.</p>
        </div>
        <button className="cp-btn-add" onClick={openAdd}>
          <PlusIcon /> Dodaj klienta
        </button>
      </div>

      {/* Two-column grid */}
      <div className="cp-grid">
        {/* LIST */}
        <div className="cp-list-panel">
          <div className="cp-search-wrap">
            <span className="cp-search-icon"><SearchIcon /></span>
            <input className="cp-search" placeholder="Szukaj klienta…" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <div className="cp-list-meta">
            <span style={{ fontWeight: 700, color: '#1a1714' }}>{clients.length}</span> klientów &nbsp;·&nbsp;
            <span style={{ color: '#38a169', fontWeight: 600 }}>● {clients.filter(c => c.status === 'active').length} aktywnych</span>
          </div>
          <div className="cp-list-scroll">
            {isLoading && <div style={{ padding: 16, fontSize: 13, color: '#9e9389' }}>Ładowanie…</div>}
            {clients.map(c => {
              const active = selectedId === c.id || (!selectedId && selected?.id === c.id)
              const rs = risk(c.status)
              return (
                <button key={c.id} className={`cp-client-row${active ? ' active' : ''}`} onClick={() => { setSelectedId(c.id); setTab('info') }}>
                  <div className={`cp-avatar ${active ? 'active-av' : 'inactive'}`}>{ini(c.company_name || c.ckk)}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, marginBottom: 2 }}>
                      <span className="cp-client-name">{c.company_name || c.ckk}</span>
                      <span className="cp-status-badge" style={{ background: rs.bg, color: rs.text, border: `1px solid ${rs.border}` }}>
                        <span style={{ display: 'inline-block', width: 5, height: 5, borderRadius: '50%', background: rs.dot, marginRight: 3, verticalAlign: 'middle' }} />
                        {STATUS_PL[c.status] ?? c.status}
                      </span>
                    </div>
                    <div className="cp-client-meta">{c.segment ?? 'Brak segmentu'} · {c.billing_email ?? c.invoice_nip ?? '—'}</div>
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        {/* DETAIL */}
        <div className="cp-detail-panel">
          {!selected ? (
            <div className="cp-empty">
              <div className="cp-empty-icon">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#9e9389" strokeWidth="1.5"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
              </div>
              <span style={{ fontSize: 14, fontWeight: 600 }}>Wybierz klienta z listy</span>
            </div>
          ) : (
            <>
              <div className="cp-detail-header">
                {/* Top row */}
                <div style={{ display: 'flex', gap: 16, marginBottom: 16, alignItems: 'flex-start' }}>
                  <div className="cp-detail-avatar">{ini(selected.company_name || selected.ckk)}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                      <div>
                        <h2 className="cp-company-name">{selected.company_name || selected.ckk}</h2>
                        <p className="cp-company-sub">NIP {selected.invoice_nip || '—'} · Klient od {fmtDate(selected.created_at)}</p>
                      </div>
                      <div style={{ display: 'flex', gap: 8, flexShrink: 0, alignItems: 'center' }}>
                        <button className="cp-btn-edit" onClick={openEdit}>Edytuj</button>
                        <span className="cp-status-badge" style={{ background: r.bg, color: r.text, border: `1px solid ${r.border}`, fontSize: 11, padding: '4px 11px' }}>
                          <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: r.dot, marginRight: 4, verticalAlign: 'middle' }} />
                          {STATUS_PL[selected.status] ?? selected.status}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* KPIs */}
                <div className="cp-kpi-grid">
                  {[
                    { label: 'Pracownicy', value: selected.employee_count?.toLocaleString('pl-PL') ?? '—', accent: '#553c9a', bg: '#faf5ff' },
                    { label: 'Umowy', value: contracts.length, accent: '#2b6cb0', bg: '#ebf8ff' },
                    { label: 'Segment', value: selected.segment || '—', accent: '#276749', bg: '#f0fff4' },
                    { label: 'Notatki', value: notes.length, accent: '#e85c04', bg: '#fff8f4' },
                  ].map(k => (
                    <div key={k.label} className="cp-kpi-card" style={{ background: k.bg, borderTopColor: k.accent }}>
                      <div className="cp-kpi-label" style={{ color: k.accent }}>{k.label}</div>
                      <div className="cp-kpi-value">{k.value}</div>
                    </div>
                  ))}
                </div>

                {/* Tabs */}
                <div className="cp-tabs">
                  {([['info', 'Informacje'], ['contracts', `Umowy (${contracts.length})`], ['notes', `Notatki (${notes.length})`], ['timeline', 'Oś czasu']] as [TabKey, string][]).map(([k, label]) => (
                    <button key={k} className={`cp-tab${tab === k ? ' active' : ''}`} onClick={() => setTab(k)}>{label}</button>
                  ))}
                </div>
              </div>

              <div className="cp-tab-body">
                {/* INFO */}
                {tab === 'info' && (
                  <div className="cp-info-grid">
                    {[
                      { icon: '🏢', label: 'Branża', value: selected.industry || '—' },
                      { icon: '💳', label: 'Nr konta', value: selected.account_number || '—' },
                      { icon: '📅', label: 'Termin płatności', value: selected.payment_period_days ? `${selected.payment_period_days} dni` : '—' },
                      { icon: '📞', label: 'Telefon', value: selected.phone || '—' },
                      { icon: '📧', label: 'Email bilingowy', value: selected.billing_email || '—' },
                      { icon: '👤', label: 'Kontakt', value: contacts[0] ? `${contacts[0].first_name} ${contacts[0].last_name}` : 'Brak' },
                    ].map(it => (
                      <div key={it.label} className="cp-info-card">
                        <div className="cp-info-icon">{it.icon}</div>
                        <div>
                          <div className="cp-info-label">{it.label}</div>
                          <div className="cp-info-value">{it.value}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* CONTRACTS */}
                {tab === 'contracts' && (
                  <div>
                    {contracts.length === 0 && <p style={{ color: '#9e9389', fontSize: 13 }}>Brak umów dla tego klienta.</p>}
                    {contracts.map(c => (
                      <div key={c.id} className="cp-contract-row">
                        <div>
                          <div className="cp-contract-num">{c.contract_number}</div>
                          <div className="cp-contract-sub">{c.contract_type} · {fmtDate(c.start_date)} → {fmtDate(c.end_date)}</div>
                        </div>
                        <span className="cp-contract-status">{c.status}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* NOTES */}
                {tab === 'notes' && (
                  <div>
                    <div className="cp-note-form">
                      <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 10, color: '#1a1714' }}>Nowa notatka</div>
                      <div className="cp-note-types">
                        {NOTE_TYPES.map(t => (
                          <button key={t} className={`cp-note-type-btn${noteType === t ? ' sel' : ''}`} onClick={() => setNoteType(t)}>{NOTE_LABELS[t]}</button>
                        ))}
                      </div>
                      <textarea className="cp-textarea" placeholder="Wpisz treść notatki…" value={noteText} onChange={e => setNoteText(e.target.value)} />
                      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                        <button className="cp-btn-submit" onClick={addNote} disabled={!noteText || createNote.isPending}>
                          {createNote.isPending ? 'Dodawanie…' : 'Dodaj notatkę'}
                        </button>
                      </div>
                    </div>
                    {notes.length === 0 && <p style={{ color: '#9e9389', fontSize: 13 }}>Brak notatek.</p>}
                    {notes.map(n => (
                      <div key={n.id} className="cp-note-item">
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                          <span className="cp-note-author">{n.created_by || 'System'}</span>
                          <span className="cp-note-date">{fmtDate(n.created_at)}</span>
                          {n.note_type && <span className="cp-note-type-tag">{n.note_type}</span>}
                        </div>
                        <p className="cp-note-content">{n.content}</p>
                      </div>
                    ))}
                  </div>
                )}

                {/* TIMELINE */}
                {tab === 'timeline' && <Timeline events={timelineEvents} />}
              </div>
            </>
          )}
        </div>
      </div>

      {/* MODAL */}
      {modalOpen && (
        <div className="cp-overlay" onClick={e => e.target === e.currentTarget && setModalOpen(false)}>
          <div className="cp-modal">
            <div className="cp-modal-header">
              <h3 className="cp-modal-title">{modalMode === 'add' ? '✦ Nowy klient' : '✦ Edytuj klienta'}</h3>
              <button className="cp-modal-close" onClick={() => setModalOpen(false)}><CloseIcon /></button>
            </div>
            <div className="cp-modal-body">
              <div className="cp-form-grid">
                {([
                  ['ckk', 'CKK / Identyfikator', 'text'],
                  ['invoice_nip', 'NIP', 'text'],
                  ['billing_email', 'Email bilingowy', 'email'],
                  ['phone', 'Telefon', 'text'],
                  ['segment', 'Segment', 'text'],
                  ['industry', 'Branża', 'text'],
                  ['employee_count', 'Liczba pracowników', 'number'],
                  ['payment_period_days', 'Termin płatności (dni)', 'number'],
                ] as [string, string, string][]).map(([field, label, type]) => (
                  <div key={field} className="cp-form-group">
                    <label className="cp-form-label">{label}</label>
                    <input
                      className="cp-form-input"
                      type={type}
                      value={form[field] ?? ''}
                      onChange={e => { setForm({ ...form, [field]: e.target.value }); setFormErrors(prev => ({ ...prev, [field]: undefined })) }}
                      style={formErrors[field] ? { borderColor: '#e53e3e' } : undefined}
                    />
                    {formErrors[field] && <span style={{ fontSize: 11, color: '#c94f02', marginTop: 2 }}>{formErrors[field]}</span>}
                  </div>
                ))}
                <div className="cp-form-group">
                  <label className="cp-form-label">Status</label>
                  <select className="cp-form-input" value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
                    <option value="active">Aktywny</option>
                    <option value="needs_attention">Wymaga uwagi</option>
                    <option value="churn_risk">Ryzyko utraty</option>
                    <option value="inactive">Nieaktywny</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="cp-modal-footer">
              <button className="cp-btn-cancel" onClick={() => setModalOpen(false)}>Anuluj</button>
              <button className="cp-btn-save" onClick={saveCustomer} disabled={createCustomer.isPending || updateCustomer.isPending}>
                {(createCustomer.isPending || updateCustomer.isPending) ? 'Zapisywanie…' : 'Zapisz klienta'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
