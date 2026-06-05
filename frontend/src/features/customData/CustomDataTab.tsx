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

interface Props {
  customerId: string
}

export function CustomDataTab({ customerId }: Props) {
  const [section, setSection] = useState<'fields' | 'tables'>('fields')

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <button
          className={`cp-tab${section === 'fields' ? ' active' : ''}`}
          onClick={() => setSection('fields')}
        >
          Pola własne
        </button>
        <button
          className={`cp-tab${section === 'tables' ? ' active' : ''}`}
          onClick={() => setSection('tables')}
        >
          Tabele własne
        </button>
      </div>

      {section === 'fields' && <CustomFieldsSection customerId={customerId} />}
      {section === 'tables' && <CustomTablesSection customerId={customerId} />}
    </div>
  )
}

// ── Custom Fields Section ─────────────────────────────────────────────────────

function CustomFieldsSection({ customerId }: { customerId: string }) {
  const { data: definitions = [], isLoading: defsLoading } = useCustomFieldDefinitions(customerId)
  const { data: valuesData } = useCustomFieldValues(customerId)
  const createDef = useCreateCustomFieldDefinition(customerId)
  const deleteDef = useDeleteCustomFieldDefinition(customerId)
  const updateValues = useUpdateCustomFieldValues(customerId)

  const [showAddForm, setShowAddForm] = useState(false)
  const [newField, setNewField] = useState({ field_name: '', display_name: '', field_type: 'TEXT' })
  const [editValues, setEditValues] = useState<Record<string, string>>({})
  const [editing, setEditing] = useState(false)

  const values = valuesData?.values ?? {}

  function startEditing() {
    const initial: Record<string, string> = {}
    for (const def of definitions) {
      initial[def.field_name] = String(values[def.field_name] ?? '')
    }
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
    if (!newField.field_name || !newField.display_name) return
    createDef.mutate(newField, {
      onSuccess: () => {
        setNewField({ field_name: '', display_name: '', field_type: 'TEXT' })
        setShowAddForm(false)
      },
    })
  }

  if (defsLoading) return <p style={{ color: '#6b7280' }}>Ładowanie...</p>

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h4 style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>Pola własne ({definitions.length}/20)</h4>
        <div style={{ display: 'flex', gap: 8 }}>
          {definitions.length > 0 && !editing && (
            <button className="cp-btn-sm" onClick={startEditing}>Edytuj wartości</button>
          )}
          <button className="cp-btn-sm" onClick={() => setShowAddForm(!showAddForm)}>+ Dodaj pole</button>
        </div>
      </div>

      {showAddForm && (
        <div style={{ padding: 12, background: '#f9fafb', borderRadius: 8, marginBottom: 12, display: 'flex', gap: 8, alignItems: 'end', flexWrap: 'wrap' }}>
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, display: 'block' }}>Nazwa (slug)</label>
            <input
              style={{ padding: '4px 8px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 13 }}
              value={newField.field_name}
              onChange={(e) => setNewField({ ...newField, field_name: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '') })}
              placeholder="np. numer_krs"
            />
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, display: 'block' }}>Nazwa wyświetlana</label>
            <input
              style={{ padding: '4px 8px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 13 }}
              value={newField.display_name}
              onChange={(e) => setNewField({ ...newField, display_name: e.target.value })}
              placeholder="np. Numer KRS"
            />
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, display: 'block' }}>Typ</label>
            <select
              style={{ padding: '4px 8px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 13 }}
              value={newField.field_type}
              onChange={(e) => setNewField({ ...newField, field_type: e.target.value })}
            >
              {FIELD_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <button className="cp-btn-sm" onClick={handleAddField} disabled={createDef.isPending}>
            {createDef.isPending ? '...' : 'Zapisz'}
          </button>
        </div>
      )}

      {definitions.length === 0 ? (
        <p style={{ color: '#9ca3af', fontSize: 13 }}>Brak zdefiniowanych pól własnych.</p>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {definitions.map((def) => (
            <div key={def.id} style={{ padding: '8px 12px', background: '#f9fafb', borderRadius: 8, border: '1px solid #e5e7eb' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>{def.display_name}</span>
                <button
                  onClick={() => { if (confirm(`Usunąć pole "${def.display_name}"?`)) deleteDef.mutate(def.id) }}
                  style={{ fontSize: 11, color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer' }}
                >
                  ✕
                </button>
              </div>
              {editing ? (
                <input
                  style={{ width: '100%', marginTop: 4, padding: '3px 6px', border: '1px solid #d1d5db', borderRadius: 4, fontSize: 13 }}
                  value={editValues[def.field_name] ?? ''}
                  onChange={(e) => setEditValues({ ...editValues, [def.field_name]: e.target.value })}
                  type={def.field_type === 'INTEGER' || def.field_type === 'FLOAT' ? 'number' : def.field_type === 'DATE' ? 'date' : 'text'}
                />
              ) : (
                <div style={{ fontSize: 13, color: '#6b7280', marginTop: 2 }}>
                  {values[def.field_name] != null ? String(values[def.field_name]) : <em>—</em>}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {editing && (
        <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
          <button className="cp-btn-sm" onClick={saveValues} disabled={updateValues.isPending}>
            {updateValues.isPending ? 'Zapisywanie...' : 'Zapisz wartości'}
          </button>
          <button className="cp-btn-sm" onClick={() => setEditing(false)} style={{ background: '#f3f4f6', color: '#374151' }}>
            Anuluj
          </button>
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
  const [newTable, setNewTable] = useState({ table_slug: '', display_name: '', columns: [{ column_name: '', column_type: 'TEXT', display_name: '' }] })
  const [expandedTableId, setExpandedTableId] = useState<string | null>(null)

  function addColumn() {
    setNewTable({ ...newTable, columns: [...newTable.columns, { column_name: '', column_type: 'TEXT', display_name: '' }] })
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
    if (!newTable.table_slug || !newTable.display_name || newTable.columns.some((c) => !c.column_name || !c.display_name)) return
    createTable.mutate(newTable, {
      onSuccess: () => {
        setNewTable({ table_slug: '', display_name: '', columns: [{ column_name: '', column_type: 'TEXT', display_name: '' }] })
        setShowAddForm(false)
      },
    })
  }

  if (isLoading) return <p style={{ color: '#6b7280' }}>Ładowanie...</p>

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h4 style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>Tabele własne ({tables.length}/10)</h4>
        <button className="cp-btn-sm" onClick={() => setShowAddForm(!showAddForm)}>+ Nowa tabela</button>
      </div>

      {showAddForm && (
        <div style={{ padding: 12, background: '#f9fafb', borderRadius: 8, marginBottom: 12, border: '1px solid #e5e7eb' }}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, display: 'block' }}>Slug</label>
              <input
                style={{ padding: '4px 8px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 13 }}
                value={newTable.table_slug}
                onChange={(e) => setNewTable({ ...newTable, table_slug: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '') })}
                placeholder="np. pracownicy"
              />
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, display: 'block' }}>Nazwa wyświetlana</label>
              <input
                style={{ padding: '4px 8px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 13 }}
                value={newTable.display_name}
                onChange={(e) => setNewTable({ ...newTable, display_name: e.target.value })}
                placeholder="np. Pracownicy"
              />
            </div>
          </div>
          <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Kolumny:</div>
          {newTable.columns.map((col, idx) => (
            <div key={idx} style={{ display: 'flex', gap: 6, marginBottom: 4, alignItems: 'center' }}>
              <input
                style={{ padding: '3px 6px', border: '1px solid #d1d5db', borderRadius: 4, fontSize: 12, width: 100 }}
                value={col.column_name}
                onChange={(e) => updateColumn(idx, 'column_name', e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                placeholder="slug"
              />
              <input
                style={{ padding: '3px 6px', border: '1px solid #d1d5db', borderRadius: 4, fontSize: 12, width: 120 }}
                value={col.display_name}
                onChange={(e) => updateColumn(idx, 'display_name', e.target.value)}
                placeholder="Nazwa"
              />
              <select
                style={{ padding: '3px 6px', border: '1px solid #d1d5db', borderRadius: 4, fontSize: 12 }}
                value={col.column_type}
                onChange={(e) => updateColumn(idx, 'column_type', e.target.value)}
              >
                {FIELD_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
              <button onClick={() => removeColumn(idx)} style={{ fontSize: 11, color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer' }}>✕</button>
            </div>
          ))}
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button className="cp-btn-sm" onClick={addColumn} style={{ background: '#f3f4f6', color: '#374151' }}>+ Kolumna</button>
            <button className="cp-btn-sm" onClick={handleCreateTable} disabled={createTable.isPending}>
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
            <div key={table.id} style={{ border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden' }}>
              <div
                style={{ padding: '10px 12px', background: '#f9fafb', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
                onClick={() => setExpandedTableId(expandedTableId === table.id ? null : table.id)}
              >
                <span style={{ fontSize: 13, fontWeight: 600 }}>
                  {table.display_name}
                  <span style={{ fontSize: 11, color: '#9ca3af', marginLeft: 6 }}>
                    ({table.columns.length} kol.)
                  </span>
                </span>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <button
                    onClick={(e) => { e.stopPropagation(); if (confirm(`Usunąć tabelę "${table.display_name}"?`)) deleteTable.mutate(table.id) }}
                    style={{ fontSize: 11, color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer' }}
                  >
                    Usuń
                  </button>
                  <span style={{ fontSize: 12 }}>{expandedTableId === table.id ? '▲' : '▼'}</span>
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
    insertRow.mutate(payload, { onSuccess: () => setNewRow({}) })
  }

  if (isLoading) return <div style={{ padding: 12, fontSize: 13, color: '#6b7280' }}>Ładowanie wierszy...</div>

  return (
    <div style={{ padding: 12 }}>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr>
              <th style={{ padding: '4px 8px', textAlign: 'left', borderBottom: '1px solid #e5e7eb', fontWeight: 600 }}>#</th>
              {table.columns.map((col) => (
                <th key={col.id} style={{ padding: '4px 8px', textAlign: 'left', borderBottom: '1px solid #e5e7eb', fontWeight: 600 }}>
                  {col.display_name}
                </th>
              ))}
              <th style={{ padding: '4px 8px', borderBottom: '1px solid #e5e7eb' }}></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => (
              <tr key={row.id != null ? String(row.id) : idx}>
                <td style={{ padding: '4px 8px', borderBottom: '1px solid #f3f4f6', color: '#9ca3af' }}>{idx + 1}</td>
                {table.columns.map((col) => (
                  <td key={col.id} style={{ padding: '4px 8px', borderBottom: '1px solid #f3f4f6' }}>
                    {row[col.column_name] != null ? String(row[col.column_name]) : '—'}
                  </td>
                ))}
                <td style={{ padding: '4px 8px', borderBottom: '1px solid #f3f4f6' }}>
                  <button
                    onClick={() => { if (row.id != null && confirm('Usunąć wiersz?')) deleteRow.mutate(Number(row.id)) }}
                    style={{ fontSize: 11, color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer' }}
                  >
                    ✕
                  </button>
                </td>
              </tr>
            ))}
            {/* New row input */}
            <tr>
              <td style={{ padding: '4px 8px', color: '#9ca3af' }}>+</td>
              {table.columns.map((col) => (
                <td key={col.id} style={{ padding: '4px 8px' }}>
                  <input
                    style={{ width: '100%', padding: '2px 4px', border: '1px solid #d1d5db', borderRadius: 4, fontSize: 12 }}
                    value={newRow[col.column_name] ?? ''}
                    onChange={(e) => setNewRow({ ...newRow, [col.column_name]: e.target.value })}
                    placeholder={col.display_name}
                    type={col.column_type === 'INTEGER' || col.column_type === 'FLOAT' ? 'number' : col.column_type === 'DATE' ? 'date' : 'text'}
                  />
                </td>
              ))}
              <td style={{ padding: '4px 8px' }}>
                <button className="cp-btn-sm" onClick={handleInsert} disabled={insertRow.isPending} style={{ fontSize: 11 }}>
                  {insertRow.isPending ? '...' : '+'}
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      {rows.length === 0 && <p style={{ color: '#9ca3af', fontSize: 12, marginTop: 8 }}>Brak wierszy.</p>}
    </div>
  )
}
