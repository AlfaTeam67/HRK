import { useMemo, useState } from 'react'

import type { Contract, DocumentRead } from '@/types/models'
import { groupContractsByParent, type ContractTree } from '@/features/documentGeneration/originHelpers'

interface Props {
  contracts: Contract[]
  attachments: DocumentRead[]
  onContractClick: (contractId: string) => void
}

const STATUS_COLORS: Record<string, { bg: string; fg: string }> = {
  active: { bg: '#f0fff4', fg: '#276749' },
  signed: { bg: '#f0fff4', fg: '#276749' },
  draft: { bg: '#fff8f4', fg: '#c94f02' },
  expiring: { bg: '#fffbeb', fg: '#92400e' },
  terminated: { bg: '#f3f4f6', fg: '#718096' },
}

function fmtDate(v?: string | null) {
  return v ? new Date(v).toLocaleDateString('pl-PL') : '—'
}

function fileCount(attachments: DocumentRead[], contractId: string) {
  return attachments.filter((a) => a.contract_id === contractId).length
}

export function ContractTreeList({ contracts, attachments, onContractClick }: Props) {
  const trees = useMemo(() => groupContractsByParent(contracts), [contracts])
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())

  if (contracts.length === 0) {
    return <p style={{ color: '#9e9389', fontSize: 13 }}>Brak umów dla tego klienta.</p>
  }

  function toggle(id: string) {
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {trees.map((tree) => (
        <TreeNode
          key={tree.parent.id}
          tree={tree}
          attachments={attachments}
          collapsed={collapsed.has(tree.parent.id)}
          onToggle={() => toggle(tree.parent.id)}
          onContractClick={onContractClick}
        />
      ))}
    </div>
  )
}

function TreeNode({
  tree,
  attachments,
  collapsed,
  onToggle,
  onContractClick,
}: {
  tree: ContractTree
  attachments: DocumentRead[]
  collapsed: boolean
  onToggle: () => void
  onContractClick: (id: string) => void
}) {
  const { parent, amendments, related } = tree
  const hasChildren = amendments.length > 0 || related.length > 0
  const sc = STATUS_COLORS[parent.status] ?? STATUS_COLORS.draft
  const files = fileCount(attachments, parent.id)

  return (
    <div>
      {/* Parent row */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '10px 14px',
          background: 'white',
          border: '1px solid #e3e0db',
          borderRadius: 10,
          cursor: 'pointer',
        }}
        onClick={() => onContractClick(parent.id)}
      >
        {hasChildren && (
          <button
            onClick={(e) => { e.stopPropagation(); onToggle() }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, padding: 0, color: '#9e9389' }}
            aria-label={collapsed ? 'Rozwiń' : 'Zwiń'}
          >
            {collapsed ? '▸' : '▾'}
          </button>
        )}
        {!hasChildren && <span style={{ width: 12 }} />}
        <span style={{ fontSize: 13, fontWeight: 700, color: '#1a1714' }}>
          📄 {parent.contract_number}
        </span>
        <span style={{ fontSize: 12, color: '#7a6f67' }}>{parent.contract_type}</span>
        <span
          style={{
            fontSize: 10,
            fontWeight: 700,
            padding: '2px 8px',
            borderRadius: 4,
            background: sc.bg,
            color: sc.fg,
            border: `1px solid ${sc.fg}30`,
          }}
        >
          {parent.status}
        </span>
        <span style={{ fontSize: 11, color: '#9e9389', marginLeft: 'auto' }}>
          {fmtDate(parent.start_date)} → {fmtDate(parent.end_date)}
        </span>
        {files > 0 && (
          <span style={{ fontSize: 10.5, color: '#7a6f67', background: '#f2f0ed', borderRadius: 4, padding: '2px 6px' }}>
            {files} {files === 1 ? 'plik' : 'pliki'}
          </span>
        )}
      </div>

      {/* Children */}
      {!collapsed && hasChildren && (
        <div style={{ marginLeft: 28, borderLeft: '2px solid #e3e0db', paddingLeft: 12, marginTop: 4 }}>
          {amendments.length > 0 && (
            <ChildGroup label="Aneksy" items={amendments} attachments={attachments} onContractClick={onContractClick} icon="📎" />
          )}
          {related.length > 0 && (
            <ChildGroup label="Powiązane" items={related} attachments={attachments} onContractClick={onContractClick} icon="🔗" />
          )}
        </div>
      )}
    </div>
  )
}

function ChildGroup({
  label,
  items,
  attachments,
  onContractClick,
  icon,
}: {
  label: string
  items: Contract[]
  attachments: DocumentRead[]
  onContractClick: (id: string) => void
  icon: string
}) {
  return (
    <div style={{ marginBottom: 6 }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: '#9e9389', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>
        {label} ({items.length})
      </div>
      {items.map((c) => {
        const sc = STATUS_COLORS[c.status] ?? STATUS_COLORS.draft
        const files = fileCount(attachments, c.id)
        return (
          <div
            key={c.id}
            onClick={() => onContractClick(c.id)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '7px 12px',
              background: '#fafaf9',
              border: '1px solid #f2f0ed',
              borderRadius: 8,
              cursor: 'pointer',
              marginBottom: 4,
            }}
          >
            <span style={{ fontSize: 12 }}>{icon}</span>
            <span style={{ fontSize: 12.5, fontWeight: 600, color: '#1a1714' }}>{c.contract_number}</span>
            <span style={{ fontSize: 11, color: '#7a6f67' }}>{c.contract_type}</span>
            <span style={{ fontSize: 9.5, fontWeight: 700, padding: '1px 6px', borderRadius: 4, background: sc.bg, color: sc.fg }}>{c.status}</span>
            {files > 0 && (
              <span style={{ fontSize: 10, color: '#7a6f67', marginLeft: 'auto' }}>{files} plik.</span>
            )}
          </div>
        )
      })}
    </div>
  )
}
