/**
 * PriceListPage — zarządzanie bazowym cennikiem usług.
 *
 * Wyświetla wszystkie wpisy PriceListTemplate, pozwala dodawać,
 * edytować cenę/opis/label oraz dezaktywować wpisy.
 */

import { useState } from 'react'
import { cardStyle } from '@/lib/styles'
import { HelpTooltip } from '@/components/ui/HelpTooltip'
import {
  usePriceList,
  useCreatePriceListEntry,
  useUpdatePriceListEntry,
  useDeletePriceListEntry,
  type PriceListEntry,
} from '@/hooks/priceList'

/* ─── Helpers ───────────────────────────────────────────────── */

function fmt(price: string | number) {
  return Number(price).toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('pl-PL')
}

/* ─── Add / Edit form ────────────────────────────────────────── */

interface EntryFormProps {
  initial?: Partial<PriceListEntry>
  onSave: (data: { service_id?: string; list_price: number; description: string; label: string; is_active: boolean }) => void
  onCancel: () => void
  isSaving: boolean
  mode: 'add' | 'edit'
}

function EntryForm({ initial, onSave, onCancel, isSaving, mode }: EntryFormProps) {
  const [serviceId, setServiceId] = useState(initial?.service_id ?? '')
  const [price, setPrice] = useState(initial?.list_price ? String(initial.list_price) : '')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [label, setLabel] = useState(initial?.label ?? '')
  const [isActive, setIsActive] = useState(initial?.is_active ?? true)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const parsed = parseFloat(price.replace(',', '.'))
    if (isNaN(parsed) || parsed <= 0) {
      alert('Cena musi być liczbą dodatnią.')
      return
    }
    onSave({
      ...(mode === 'add' ? { service_id: serviceId.trim() } : {}),
      list_price: parsed,
      description: description.trim(),
      label: label.trim(),
      is_active: isActive,
    })
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '7px 10px', fontSize: 13,
    border: '1px solid #d4cfc9', borderRadius: 6,
    background: '#faf9f7', color: '#1a1714', outline: 'none',
    boxSizing: 'border-box',
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {mode === 'add' && (
        <div>
          <label style={{ fontSize: 12, fontWeight: 700, color: '#4a4340', display: 'flex', alignItems: 'center', gap: 5, marginBottom: 4 }}>
            ID usługi (service_id)
            <HelpTooltip text="UUID usługi z katalogu usług. Znajdziesz go w zakładce Administracja → Usługi lub przez API GET /api/v1/services." />
          </label>
          <input
            required
            style={inputStyle}
            placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
            value={serviceId}
            onChange={e => setServiceId(e.target.value)}
            pattern="[0-9a-fA-F\-]{36}"
            title="Podaj UUID w formacie xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
          />
        </div>
      )}

      <div>
        <label style={{ fontSize: 12, fontWeight: 700, color: '#4a4340', display: 'flex', alignItems: 'center', gap: 5, marginBottom: 4 }}>
          Cena katalogowa (PLN netto)
          <HelpTooltip text="Bazowa stawka używana jako punkt startowy przy tworzeniu stawek indywidualnych dla klientów. Bez VAT." />
        </label>
        <input
          required
          style={inputStyle}
          placeholder="np. 45.00"
          value={price}
          onChange={e => setPrice(e.target.value)}
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <div>
          <label style={{ fontSize: 12, fontWeight: 700, color: '#4a4340', marginBottom: 4, display: 'block' }}>
            Etykieta (opcjonalna)
          </label>
          <input
            style={inputStyle}
            placeholder="np. 2026, Standard"
            value={label}
            onChange={e => setLabel(e.target.value)}
            maxLength={100}
          />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingTop: 20 }}>
          <input
            type="checkbox"
            id="is_active"
            checked={isActive}
            onChange={e => setIsActive(e.target.checked)}
            style={{ accentColor: '#e85c04', cursor: 'pointer' }}
          />
          <label htmlFor="is_active" style={{ fontSize: 12, fontWeight: 600, color: '#4a4340', cursor: 'pointer' }}>
            Aktywna
          </label>
        </div>
      </div>

      <div>
        <label style={{ fontSize: 12, fontWeight: 700, color: '#4a4340', marginBottom: 4, display: 'block' }}>
          Opis (opcjonalny)
        </label>
        <textarea
          style={{ ...inputStyle, resize: 'vertical', minHeight: 56 }}
          placeholder="np. cena za osobę, min. 50 pracowników"
          value={description}
          onChange={e => setDescription(e.target.value)}
          maxLength={500}
        />
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, paddingTop: 4 }}>
        <button
          type="button"
          onClick={onCancel}
          style={{ padding: '7px 16px', fontSize: 13, border: '1px solid #d4cfc9', borderRadius: 6, background: 'white', cursor: 'pointer', color: '#4a4340' }}
        >
          Anuluj
        </button>
        <button
          type="submit"
          disabled={isSaving}
          style={{ padding: '7px 18px', fontSize: 13, border: 'none', borderRadius: 6, background: '#e85c04', color: 'white', fontWeight: 600, cursor: 'pointer', opacity: isSaving ? 0.6 : 1 }}
        >
          {isSaving ? 'Zapisywanie…' : mode === 'add' ? 'Dodaj cenę' : 'Zapisz zmiany'}
        </button>
      </div>
    </form>
  )
}

/* ─── Row ────────────────────────────────────────────────────── */

function EntryRow({
  entry,
  onEdit,
  onToggle,
  onDelete,
}: {
  entry: PriceListEntry
  onEdit: (e: PriceListEntry) => void
  onToggle: (e: PriceListEntry) => void
  onDelete: (id: string) => void
}) {
  return (
    <tr style={{ borderBottom: '1px solid #f5f3f0' }}>
      <td style={{ padding: '10px 0', maxWidth: 180 }}>
        <span style={{ fontSize: 11, color: '#9c8e84', fontFamily: 'monospace' }}>
          {entry.service_id.slice(0, 8)}…
        </span>
      </td>
      <td style={{ padding: '10px 8px' }}>
        <span style={{
          fontSize: 11, padding: '1px 8px', borderRadius: 20,
          fontWeight: 600,
          background: entry.label ? '#fef3c7' : '#f5f3f0',
          color: entry.label ? '#92400e' : '#9c8e84',
        }}>
          {entry.label || '—'}
        </span>
      </td>
      <td style={{ padding: '10px 8px', fontWeight: 700, color: '#1a1714', fontSize: 14 }}>
        {fmt(entry.list_price)} zł
      </td>
      <td style={{ padding: '10px 8px', fontSize: 12, color: '#4a4340', maxWidth: 200 }}>
        {entry.description || <span style={{ color: '#c8bfb7' }}>—</span>}
      </td>
      <td style={{ padding: '10px 8px' }}>
        <span style={{
          fontSize: 11, padding: '2px 9px', borderRadius: 20,
          fontWeight: 600,
          background: entry.is_active ? '#f0fff4' : '#f5f3f0',
          color: entry.is_active ? '#276749' : '#9c8e84',
        }}>
          {entry.is_active ? 'Aktywna' : 'Nieaktywna'}
        </span>
      </td>
      <td style={{ padding: '10px 8px', fontSize: 11, color: '#9c8e84' }}>{fmtDate(entry.updated_at)}</td>
      <td style={{ padding: '10px 0', textAlign: 'right' }}>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6 }}>
          <button
            onClick={() => onEdit(entry)}
            style={{ fontSize: 11, border: '1px solid #e3e0db', borderRadius: 5, padding: '3px 10px', background: 'white', cursor: 'pointer', color: '#4a4340' }}
          >
            Edytuj
          </button>
          <button
            onClick={() => onToggle(entry)}
            style={{
              fontSize: 11, border: '1px solid #e3e0db', borderRadius: 5,
              padding: '3px 10px', cursor: 'pointer',
              background: entry.is_active ? '#fff8f5' : 'white',
              color: entry.is_active ? '#c94f02' : '#276749',
            }}
          >
            {entry.is_active ? 'Dezaktywuj' : 'Aktywuj'}
          </button>
          <button
            onClick={() => {
              if (window.confirm('Usunąć ten wpis cennika? Operacja jest nieodwracalna.')) {
                onDelete(entry.id)
              }
            }}
            style={{ fontSize: 11, border: '1px solid #fca5a5', borderRadius: 5, padding: '3px 10px', background: '#fff5f5', cursor: 'pointer', color: '#dc2626' }}
          >
            Usuń
          </button>
        </div>
      </td>
    </tr>
  )
}

/* ─── Page ───────────────────────────────────────────────────── */

export function PriceListPage() {
  const [showAdd, setShowAdd] = useState(false)
  const [editEntry, setEditEntry] = useState<PriceListEntry | null>(null)
  const [activeOnly, setActiveOnly] = useState(false)

  const { data: entries = [], isLoading } = usePriceList(activeOnly)
  const createEntry = useCreatePriceListEntry()
  const updateEntry = useUpdatePriceListEntry()
  const deleteEntry = useDeletePriceListEntry()

  async function handleCreate(data: Parameters<typeof createEntry.mutate>[0]) {
    try {
      await createEntry.mutateAsync(data as Parameters<typeof createEntry.mutateAsync>[0])
      setShowAdd(false)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Nieznany błąd'
      alert(`Nie udało się dodać wpisu.\n\n${msg}`)
    }
  }

  async function handleUpdate(data: { list_price: number; description: string; label: string; is_active: boolean }) {
    if (!editEntry) return
    try {
      await updateEntry.mutateAsync({ id: editEntry.id, ...data })
      setEditEntry(null)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Nieznany błąd'
      alert(`Nie udało się zapisać zmian.\n\n${msg}`)
    }
  }

  async function handleToggle(entry: PriceListEntry) {
    try {
      await updateEntry.mutateAsync({ id: entry.id, is_active: !entry.is_active })
    } catch {
      alert('Nie udało się zmienić statusu wpisu.')
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteEntry.mutateAsync(id)
    } catch {
      alert('Nie udało się usunąć wpisu.')
    }
  }

  const activeCount = entries.filter(e => e.is_active).length

  return (
    <div style={{ padding: '28px 32px', width: '100%', boxSizing: 'border-box' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 22 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: '#1a1714', margin: 0, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 8 }}>
            Bazowy cennik
            <HelpTooltip
              size={16}
              text="Cennik zawiera standardowe stawki katalogowe dla każdej usługi. Są one punktem startowym przy ustalaniu stawek indywidualnych dla klientów (CustomerRate)."
            />
          </h1>
          <p style={{ color: '#7a6f67', fontSize: 13, margin: 0 }}>
            {entries.length} {entries.length === 1 ? 'usługa' : entries.length < 5 ? 'usługi' : 'usług'} w cenniku · {activeCount} aktywnych
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#5a5248', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={activeOnly}
              onChange={e => setActiveOnly(e.target.checked)}
              style={{ accentColor: '#e85c04', cursor: 'pointer' }}
            />
            Tylko aktywne
          </label>
          {!showAdd && !editEntry && (
            <button
              onClick={() => setShowAdd(true)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                background: '#e85c04', border: 'none', borderRadius: 7,
                padding: '8px 16px', color: 'white', fontSize: 13,
                fontWeight: 600, cursor: 'pointer',
              }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
              Dodaj cenę
            </button>
          )}
        </div>
      </div>

      {/* Add form */}
      {showAdd && (
        <div style={{ ...cardStyle, padding: 20, marginBottom: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#1a1714', marginBottom: 14 }}>
            Nowy wpis cennika
          </div>
          <EntryForm
            mode="add"
            onSave={d => handleCreate(d as Parameters<typeof createEntry.mutateAsync>[0])}
            onCancel={() => setShowAdd(false)}
            isSaving={createEntry.isPending}
          />
        </div>
      )}

      {/* Edit form */}
      {editEntry && (
        <div style={{ ...cardStyle, padding: 20, marginBottom: 20, borderLeft: '3px solid #e85c04' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#1a1714', marginBottom: 14 }}>
            Edycja wpisu — usługa <span style={{ fontFamily: 'monospace', color: '#e85c04' }}>{editEntry.service_id.slice(0, 8)}…</span>
          </div>
          <EntryForm
            mode="edit"
            initial={editEntry}
            onSave={handleUpdate}
            onCancel={() => setEditEntry(null)}
            isSaving={updateEntry.isPending}
          />
        </div>
      )}

      {/* Table */}
      <div style={{ ...cardStyle, overflow: 'hidden' }}>
        {isLoading ? (
          <div style={{ padding: 32, textAlign: 'center', color: '#9c8e84', fontSize: 13 }}>
            Ładowanie cennika…
          </div>
        ) : entries.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center' }}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>💰</div>
            <p style={{ color: '#7a6f67', fontSize: 13, margin: 0 }}>
              Brak wpisów w cenniku.{' '}
              <button onClick={() => setShowAdd(true)} style={{ background: 'none', border: 'none', color: '#e85c04', cursor: 'pointer', fontWeight: 600, fontSize: 13 }}>
                Dodaj pierwszy wpis
              </button>
            </p>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #ede9e4' }}>
                {['ID USŁUGI', 'ETYKIETA', 'CENA KATALOGOWA', 'OPIS', 'STATUS', 'AKTUALIZACJA', ''].map(col => (
                  <th key={col} style={{
                    textAlign: col === '' ? 'right' : 'left',
                    fontSize: 10, fontWeight: 700, color: '#7a6f67',
                    letterSpacing: '0.06em', padding: '12px 8px',
                    paddingLeft: col === 'ID USŁUGI' ? 18 : 8,
                    paddingRight: col === '' ? 18 : 8,
                  }}>
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody style={{ padding: '0 18px' }}>
              {entries.map(entry => (
                <EntryRow
                  key={entry.id}
                  entry={entry}
                  onEdit={setEditEntry}
                  onToggle={handleToggle}
                  onDelete={handleDelete}
                />
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Footer info */}
      <p style={{ fontSize: 11.5, color: '#9c8e84', marginTop: 16 }}>
        Ceny netto w PLN. Jeden wpis per usługa. Dezaktywacja ukrywa wpis w kalkulatorach stawek bez usuwania historii.
      </p>
    </div>
  )
}
