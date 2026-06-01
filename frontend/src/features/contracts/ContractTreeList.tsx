import { useMemo, useState } from 'react'

import type { Contract, DocumentRead } from '@/types/models'
import { groupContractsByParent, type ContractTree } from '@/features/documentGeneration/originHelpers'

interface Props {
  contracts: Contract[]
  attachments: DocumentRead[]
  onContractClick: (contractId: string) => void
}

const STATUS_COLORS: Record<string, { bg: string; fg: string; border: string }> = {
  active: { bg: 'bg-green-50', fg: 'text-green-800', border: 'border-green-800/20' },
  signed: { bg: 'bg-green-50', fg: 'text-green-800', border: 'border-green-800/20' },
  draft: { bg: 'bg-orange-50', fg: 'text-orange-700', border: 'border-orange-700/20' },
  expiring: { bg: 'bg-amber-50', fg: 'text-amber-800', border: 'border-amber-800/20' },
  terminated: { bg: 'bg-gray-100', fg: 'text-gray-500', border: 'border-gray-500/20' },
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
    return <p className="text-[13px] text-stone-400">Brak umów dla tego klienta.</p>
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
    <div className="flex flex-col gap-1.5">
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
        className="flex items-center gap-2.5 px-3.5 py-2.5 bg-white border border-stone-200 rounded-[10px] cursor-pointer"
        onClick={() => onContractClick(parent.id)}
      >
        {hasChildren && (
          <button
            onClick={(e) => { e.stopPropagation(); onToggle() }}
            className="bg-transparent border-none cursor-pointer text-xs p-0 text-stone-400"
            aria-label={collapsed ? 'Rozwiń' : 'Zwiń'}
          >
            {collapsed ? '▸' : '▾'}
          </button>
        )}
        {!hasChildren && <span className="w-3" />}
        <span className="text-[13px] font-bold text-stone-900">
          📄 {parent.contract_number}
        </span>
        <span className="text-xs text-stone-500">{parent.contract_type}</span>
        <span
          className={`text-[10px] font-bold px-2 py-0.5 rounded ${sc.bg} ${sc.fg} border ${sc.border}`}
        >
          {parent.status}
        </span>
        <span className="text-[11px] text-stone-400 ml-auto">
          {fmtDate(parent.start_date)} → {fmtDate(parent.end_date)}
        </span>
        {files > 0 && (
          <span className="text-[10.5px] text-stone-500 bg-stone-100 rounded px-1.5 py-0.5">
            {files} {files === 1 ? 'plik' : 'pliki'}
          </span>
        )}
      </div>

      {/* Children */}
      {!collapsed && hasChildren && (
        <div className="ml-7 border-l-2 border-stone-200 pl-3 mt-1">
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
    <div className="mb-1.5">
      <div className="text-[10px] font-bold text-stone-400 uppercase tracking-wide mb-1">
        {label} ({items.length})
      </div>
      {items.map((c) => {
        const sc = STATUS_COLORS[c.status] ?? STATUS_COLORS.draft
        const files = fileCount(attachments, c.id)
        return (
          <div
            key={c.id}
            onClick={() => onContractClick(c.id)}
            className="flex items-center gap-2 px-3 py-1.5 bg-stone-50 border border-stone-100 rounded-lg cursor-pointer mb-1"
          >
            <span className="text-xs">{icon}</span>
            <span className="text-[12.5px] font-semibold text-stone-900">{c.contract_number}</span>
            <span className="text-[11px] text-stone-500">{c.contract_type}</span>
            <span className={`text-[9.5px] font-bold px-1.5 py-0.5 rounded ${sc.bg} ${sc.fg}`}>{c.status}</span>
            {files > 0 && (
              <span className="text-[10px] text-stone-500 ml-auto">{files} plik.</span>
            )}
          </div>
        )
      })}
    </div>
  )
}
