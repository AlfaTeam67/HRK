import { useState } from 'react'
import {
  useCustomFieldDefinitions,
  useCreateCustomFieldDefinition,
  useDeleteCustomFieldDefinition,
  useCustomFieldValues,
  useUpdateCustomFieldValues,
  useCustomTables,
  useCreateCustomTable,
  useDeleteCustomTable,
  useTableRows,
  useInsertRow,
  useDeleteRow,
  type CustomTableDefinition,
} from '@/hooks/customData'

const FIELD_TYPES = ['TEXT', 'INTEGER', 'BOOLEAN', 'DATE', 'FLOAT'] as const

function toSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 40)
}

interface Props {
  customerId: string
}

export function CustomDataTab({ customerId }: Props) {
  const [section, setSection] = useState<'fields' | 'tables'>('fields')

  return (
    <div>
      <div className="cp-tabs" style={{ marginBottom: 16 }}>
        <button className={`cp-tab${section === 'fields' ? ' active' : ''}`} onClick={() => setSection('fields')}>
          Dodatkowe pola
        </button>
        <button className={`cp-tab${section === 'tables' ? ' active' : ''}`} onClick={() => setSection('tables')}>
          Dodatkowe tabele
        </button>
      </div>
      {section === 'fields' && <CustomFieldsSection customerId={customerId} />}
      {section === 'tables' && <CustomTablesSection customerId={customerId} />}
    </div>
  )
}

// ── Custom Fields Section ─────────────────────────────────────────────────────

function CustomFieldsSection({ customerId }: { customerId: string }) {
  const { data: definitions = [], isLoading } = useCustomFieldDefinitions(customerId)
  const { data: valuesData } = useCustomFieldValues(customerId)
  const createDef = useCreateCustomFieldDefinition(customerId)
  const deleteDef = useDeleteCustomFieldDefinition(customerId)
  const updateValues = useUpdateCustomFieldValues(customerId)

  const [showAddForm, setShowAddForm] = useState(false)
  const [newField, setNewField] = useState({ display_name: '', field_type: 'TEXT' })
  const [editValues, setEditValues] = useState<Record<string, string>>({})
  const [editing, setEditing] = useState(false)

  const values = valuesData?.values ?? {}

  function startEditing() {
    const initial: Record<string, string> = {}
    for (const def of definitions) initial[def.field_name] = String(values[def.field_name] ?? '')
    setEditValues(initial)
    setEditing(true)
  }

  function saveValues() {
    const payload: Record<string, unknown> = {}
    for (const def of definitions) {
      const raw = editValues[def.field_name] ?? ''
      if (def.field_type === 'INTEGER') payload[def.field_name] = raw ? Number(raw) : null
      else if (def.field_type === 'FLOAT') payload[def.field_name] = raw ? parseFloat(raw) : null
      else if (def.field_type === 'BOOLEAN') payload[def.field_name] = raw === 'true'
      else payload[def.field_name] = raw || null
    }
    updateValues.mutate(payload, { onSuccess: () => setEditing(false) })
  }

  function handleAddField() {
    if (!newField.display_name.trim()) return
    const field_name = toSlug(newField.display_name)
    if (!field_name) return
    createDef.mutate({ field_name, display_name: newField.display_name, field_type: newField.field_type }, {
      onSuccess: () => { setNewField({ display_name: '', field_type: 'TEXT' }); setShowAddForm(false) },
    })
  }

  if (isLoading) return <p style={{ color: '#7a6f67', fontSize: 13 }}>Ładowanie...</p>

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: '#1a1714' }}>Pola własne ({definitions.length}/20)</span>
        <div style={{ display: 'flex', gap: 8 }}>
          {definitions.length > 0 && !editing && (
            <button className="cp-btn-sm" onClick={startEditing}>Edytuj wartości</button>
          )}
          <button className="cp-btn-sm primary" onClick={() => setShowAddForm(!showAddForm)}>+ Dodaj pole</button>
        </div>
      </div>

      {showAddForm && (
        <div style={{ padding: 12, background: '#f9f7f5', borderRadius: 8, marginBottom: 12, border: '1px solid #e3e0db' }}>
          <div className="cp-form-grid" style={{ gridTemplateColumns: '1fr auto auto', alignItems: 'end', gap: 8 }}>
            <div className="cp-form-group">
              <label className="cp-form-label">Nazwa pola</label>
              <input
                className="cp-form-input"
                value={newField.display_name}
                onChange={(e) => setNewField({ ...newField, display_name: e.target.value })}
                placeholder="np. Numer KRS"
                onKeyDown={(e) => e.key === 'Enter' && handleAddField()}
              />
            </div>
            <div className="cp-form-group">
              <label className="cp-form-label">Typ</label>
              <select className="cp-form-input" value={newField.field_type} onChange={(e) => setNewField({ ...newField, field_type: e.target.value })}>
                {FIELD_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <button className="cp-btn-sm primary" onClick={handleAddField} disabled={createDef.isPending} style={{ marginBottom: 2 }}>
              {createDef.isPending ? '...' : 'Dodaj'}
            </button>
          </div>
        </div>
      )}

      {definitions.length === 0 ? (
        <p style={{ color: '#9ca3af', fontSize: 13 }}>Brak zdefiniowanych pól własnych.</p>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {definitions.map((def) => (
            <div key={def.id} className="cp-info-card" style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#1a1714' }}>{def.display_name}</span>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                {editing ? (
                  <input
                    className="cp-form-input"
                    style={{ flex: 1 }}
                    value={editValues[def.field_name] ?? ''}
                    onChange={(e) => setEditValues({ ...editValues, [def.field_name]: e.target.value })}
                    type={def.field_type === 'INTEGER' || def.field_type === 'FLOAT' ? 'number' : def.field_type === 'DATE' ? 'date' : 'text'}
                  />
                ) : (
                  <span style={{ fontSize: 13, color: '#374151', flex: 1 }}>
                    {values[def.field_name] != null ? String(values[def.field_name]) : <em style={{ color: '#9ca3af' }}>—</em>}
                  </span>
                )}
                <button
                  className="cp-btn-sm danger"
                  style={{ padding: '2px 6px', fontSize: 11, flexShrink: 0, marginLeft: 'auto' }}
                  title={`Usuń pole "${def.display_name}"`}
                  onClick={() => { if (confirm(`Usunąć pole "${def.display_name}"?`)) deleteDef.mutate(def.id) }}
                >
                  ✕
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
          <button className="cp-btn-sm primary" onClick={saveValues} disabled={updateValues.isPending}>
            {updateValues.isPending ? 'Zapisywanie...' : 'Zapisz wartości'}
          </button>
          <button className="cp-btn-sm" onClick={() => setEditing(false)}>Anuluj</button>
        </div>
      )}
    </div>
  )
}

// ── Custom Tables Section ─────────────────────────────────────────────────────

function CustomTablesSection({ customerId }: { customerId: string }) {
  const { data: tables = [], isLoading } = useCustomTables(customerId)
  const createTable = useCreateCustomTable(customerId)
  const deleteTable = useDeleteCustomTable(customerId)

  const [showAddForm, setShowAddForm] = useState(false)
  const [newTable, setNewTable] = useState({
    display_name: '',
    columns: [{ display_name: '', column_type: 'TEXT' }],
  })
  const [expandedTableId, setExpandedTableId] = useState<string | null>(null)

  function addColumn() {
    setNewTable({ ...newTable, columns: [...newTable.columns, { display_name: '', column_type: 'TEXT' }] })
  }

  function updateColumn(idx: number, field: string, value: string) {
    const cols = [...newTable.columns]
    cols[idx] = { ...cols[idx], [field]: value }
    setNewTable({ ...newTable, columns: cols })
  }

  function removeColumn(idx: number) {
    if (newTable.columns.length <= 1) return
    setNewTable({ ...newTable, columns: newTable.columns.filter((_, i) => i !== idx) })
  }

  function handleCreateTable() {
    if (!newTable.display_name.trim() || newTable.columns.some((c) => !c.display_name.trim())) return
    const payload = {
      table_slug: toSlug(newTable.display_name),
      display_name: newTable.display_name,
      columns: newTable.columns.map((c) => ({
        column_name: toSlug(c.display_name),
        column_type: c.column_type,
        display_name: c.display_name,
      })),
    }
    createTable.mutate(payload, {
      onSuccess: () => {
        setNewTable({ display_name: '', columns: [{ display_name: '', column_type: 'TEXT' }] })
        setShowAddForm(false)
      },
    })
  }

  if (isLoading) return <p style={{ color: '#7a6f67', fontSize: 13 }}>Ładowanie...</p>

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: '#1a1714' }}>Tabele własne ({tables.length}/10)</span>
        <button className="cp-btn-sm primary" onClick={() => setShowAddForm(!showAddForm)}>+ Nowa tabela</button>
      </div>

      {showAddForm && (
        <div style={{ padding: 12, background: '#f9f7f5', borderRadius: 8, marginBottom: 12, border: '1px solid #e3e0db' }}>
          <div className="cp-form-group" style={{ marginBottom: 10 }}>
            <label className="cp-form-label">Nazwa tabeli</label>
            <input
              className="cp-form-input"
              value={newTable.display_name}
              onChange={(e) => setNewTable({ ...newTable, display_name: e.target.value })}
              placeholder="np. Pracownicy"
            />
          </div>

          <div style={{ fontSize: 12, fontWeight: 600, color: '#1a1714', marginBottom: 6 }}>Kolumny:</div>
          {newTable.columns.map((col, idx) => (
            <div key={idx} style={{ display: 'flex', gap: 6, marginBottom: 6, alignItems: 'center' }}>
              <input
                className="cp-form-input"
                style={{ flex: 1 }}
                value={col.display_name}
                onChange={(e) => updateColumn(idx, 'display_name', e.target.value)}
                placeholder="Nazwa kolumny"
              />
              <select
                className="cp-form-input"
                style={{ width: 90 }}
                value={col.column_type}
                onChange={(e) => updateColumn(idx, 'column_type', e.target.value)}
              >
                {FIELD_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
              <button
                className="cp-btn-sm danger"
                style={{ padding: '4px 8px' }}
                onClick={() => removeColumn(idx)}
                disabled={newTable.columns.length <= 1}
              >
                ✕
              </button>
            </div>
          ))}

          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button className="cp-btn-sm" onClick={addColumn}>+ Kolumna</button>
            <button className="cp-btn-sm primary" onClick={handleCreateTable} disabled={createTable.isPending}>
              {createTable.isPending ? '...' : 'Utwórz tabelę'}
            </button>
          </div>
        </div>
      )}

      {tables.length === 0 ? (
        <p style={{ color: '#9ca3af', fontSize: 13 }}>Brak tabel własnych.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {tables.map((table) => (
            <div key={table.id} style={{ border: '1px solid #e3e0db', borderRadius: 8, overflow: 'hidden' }}>
              <div
                style={{ padding: '10px 14px', background: '#f9f7f5', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
                onClick={() => setExpandedTableId(expandedTableId === table.id ? null : table.id)}
              >
                <span style={{ fontSize: 13, fontWeight: 600, color: '#1a1714' }}>
                  {table.display_name}
                  <span style={{ fontSize: 11, color: '#7a6f67', marginLeft: 6 }}>({table.columns.length} kol.)</span>
                </span>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <button
                    className="cp-btn-sm danger"
                    onClick={(e) => { e.stopPropagation(); if (confirm(`Usunąć tabelę "${table.display_name}"?`)) deleteTable.mutate(table.id) }}
                  >
                    Usuń
                  </button>
                  <span style={{ fontSize: 11, color: '#7a6f67' }}>{expandedTableId === table.id ? '▲' : '▼'}</span>
                </div>
              </div>
              {expandedTableId === table.id && (
                <TableRowsView customerId={customerId} table={table} />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Table Rows View ───────────────────────────────────────────────────────────

function TableRowsView({ customerId, table }: { customerId: string; table: CustomTableDefinition }) {
  const { data, isLoading } = useTableRows(customerId, table.id)
  const insertRow = useInsertRow(customerId, table.id)
  const deleteRow = useDeleteRow(customerId, table.id)
  const [newRow, setNewRow] = useState<Record<string, string>>({})
  const [showNewRow, setShowNewRow] = useState(false)

  const rows = data?.items ?? []

  function handleInsert() {
    if (table.columns.every((c) => !newRow[c.column_name])) return
    const payload: Record<string, unknown> = {}
    for (const col of table.columns) {
      const raw = newRow[col.column_name] ?? ''
      if (col.column_type === 'INTEGER') payload[col.column_name] = raw ? Number(raw) : null
      else if (col.column_type === 'FLOAT') payload[col.column_name] = raw ? parseFloat(raw) : null
      else if (col.column_type === 'BOOLEAN') payload[col.column_name] = raw === 'true'
      else payload[col.column_name] = raw || null
    }
    insertRow.mutate(payload, { onSuccess: () => { setNewRow({}); setShowNewRow(false) } })
  }

  if (isLoading) return <div style={{ padding: 12, fontSize: 13, color: '#7a6f67' }}>Ładowanie wierszy...</div>

  return (
    <div style={{ padding: 12 }}>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #e3e0db' }}>
              <th style={{ padding: '6px 8px', textAlign: 'left', fontWeight: 600, color: '#7a6f67', fontSize: 11 }}>#</th>
              {table.columns.map((col) => (
                <th key={col.id} style={{ padding: '6px 8px', textAlign: 'left', fontWeight: 600, color: '#7a6f67', fontSize: 11 }}>
                  {col.display_name}
                </th>
              ))}
              <th style={{ padding: '6px 8px', width: 32 }} />
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => (
              <tr key={row.id != null ? String(row.id) : idx} style={{ borderBottom: '1px solid #f2f0ed' }}>
                <td style={{ padding: '6px 8px', color: '#9ca3af' }}>{idx + 1}</td>
                {table.columns.map((col) => (
                  <td key={col.id} style={{ padding: '6px 8px', color: '#1a1714' }}>
                    {row[col.column_name] != null ? String(row[col.column_name]) : <span style={{ color: '#9ca3af' }}>—</span>}
                  </td>
                ))}
                <td style={{ padding: '6px 8px' }}>
                  <button
                    className="cp-btn-sm danger"
                    style={{ padding: '2px 6px', fontSize: 11 }}
                    onClick={() => { if (row.id != null && confirm('Usunąć wiersz?')) deleteRow.mutate(Number(row.id)) }}
                  >
                    ✕
                  </button>
                </td>
              </tr>
            ))}

            {showNewRow && (
              <tr style={{ borderTop: '1px solid #e3e0db', background: '#faf9f8' }}>
                <td style={{ padding: '5px 8px', color: '#9ca3af', fontSize: 11 }}>nowy</td>
                {table.columns.map((col) => (
                  <td key={col.id} style={{ padding: '4px 6px' }}>
                    <input
                      className="cp-form-input"
                      style={{ padding: '3px 6px', fontSize: 12 }}
                      value={newRow[col.column_name] ?? ''}
                      onChange={(e) => setNewRow({ ...newRow, [col.column_name]: e.target.value })}
                      placeholder={col.display_name}
                      type={col.column_type === 'INTEGER' || col.column_type === 'FLOAT' ? 'number' : col.column_type === 'DATE' ? 'date' : 'text'}
                    />
                  </td>
                ))}
                <td style={{ padding: '4px 6px', whiteSpace: 'nowrap' }}>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button className="cp-btn-sm primary" style={{ padding: '3px 8px' }} onClick={handleInsert} disabled={insertRow.isPending}>
                      {insertRow.isPending ? '…' : 'Zapisz'}
                    </button>
                    <button className="cp-btn-sm" style={{ padding: '3px 6px' }} onClick={() => { setShowNewRow(false); setNewRow({}) }}>✕</button>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {!showNewRow && (
        <button className="cp-btn-sm" style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 5 }} onClick={() => setShowNewRow(true)}>
          <span style={{ fontSize: 14, lineHeight: 1 }}>+</span> Dodaj wiersz
        </button>
      )}
      {rows.length === 0 && !showNewRow && <p style={{ color: '#9ca3af', fontSize: 12, marginTop: 4 }}>Brak wierszy.</p>}
    </div>
  )
}
