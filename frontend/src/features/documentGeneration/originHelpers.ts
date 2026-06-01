import type { Contract, DocumentRead } from '@/types/models'

export type ContractTree = {
  parent: Contract
  amendments: Contract[]
  related: Contract[]
}

export type Origin =
  | { kind: 'client' }
  | { kind: 'contract'; contract: Contract }
  | { kind: 'child'; parent: Contract; child: Contract }

export function groupContractsByParent(contracts: Contract[]): ContractTree[] {
  const childrenByParent = new Map<string, Contract[]>()
  const roots: Contract[] = []
  const idSet = new Set(contracts.map((c) => c.id))

  for (const c of contracts) {
    const isOrphan = c.parent_contract_id && !idSet.has(c.parent_contract_id)
    if (!c.parent_contract_id || isOrphan) {
      roots.push(c)
    } else {
      const arr = childrenByParent.get(c.parent_contract_id) ?? []
      arr.push(c)
      childrenByParent.set(c.parent_contract_id, arr)
    }
  }

  return roots
    .sort((a, b) => (b.start_date ?? '').localeCompare(a.start_date ?? ''))
    .map((parent) => {
      const children = (childrenByParent.get(parent.id) ?? []).sort((a, b) =>
        (a.start_date ?? '').localeCompare(b.start_date ?? ''),
      )
      return {
        parent,
        amendments: children.filter((c) => c.contract_type === 'aneks'),
        related: children.filter((c) => c.contract_type !== 'aneks'),
      }
    })
}

export function buildOrigin(doc: DocumentRead, contracts: Contract[]): Origin {
  if (!doc.contract_id) return { kind: 'client' }
  const child = contracts.find((c) => c.id === doc.contract_id)
  if (!child) return { kind: 'client' }
  if (!child.parent_contract_id) return { kind: 'contract', contract: child }
  const parent = contracts.find((c) => c.id === child.parent_contract_id)
  if (!parent) return { kind: 'contract', contract: child }
  return { kind: 'child', parent, child }
}
