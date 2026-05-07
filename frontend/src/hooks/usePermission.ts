import { useAppSelector } from '@/hooks/store'
import type { UserRole } from '@/types/models'

const ROLE_RANK: Record<string, number> = {
  viewer: 1,
  consultant: 2,
  manager: 3,
  account_manager: 3,
  admin: 4,
}

// POLICY_MATRIX mirrors backend AuthorizationService.POLICY_MATRIX
const POLICY_MATRIX: Record<string, Record<string, UserRole>> = {
  company:         { read: 'viewer', list: 'viewer', create: 'admin',      update: 'manager',    delete: 'manager'    },
  customer:        { read: 'viewer', list: 'viewer', create: 'consultant',  update: 'manager',    delete: 'manager'    },
  contract:        { read: 'viewer', list: 'viewer', create: 'consultant',  update: 'manager',    delete: 'manager'    },
  document:        { read: 'viewer', upload: 'consultant', delete: 'manager' },
  note:            { read: 'viewer', list: 'viewer', create: 'consultant',  update: 'consultant', delete: 'manager'    },
  contact_person:  { read: 'viewer', list: 'viewer', create: 'consultant',  update: 'consultant', delete: 'manager'    },
  activity:        { read: 'viewer', list: 'viewer', create: 'consultant' },
  valorization:    { read: 'viewer', list: 'viewer', create: 'manager',     update: 'manager',    delete: 'manager'    },
  service:         { read: 'viewer', list: 'viewer', create: 'manager',     update: 'manager',    delete: 'manager'    },
  rate:            { read: 'viewer', list: 'viewer', create: 'consultant',  update: 'manager',    delete: 'manager'    },
  rag:             { query: 'viewer' },
  access:          { manage: 'admin' },
  user:            { manage: 'admin' },
}

function maxRank(roles: string[]): number {
  return Math.max(...roles.map((r) => ROLE_RANK[r] ?? 0), 0)
}

export function useUserRoles(): string[] {
  return useAppSelector((s) => s.auth.user?.roles ?? [])
}

export function useIsAdmin(): boolean {
  const roles = useUserRoles()
  return roles.includes('admin')
}

export function useHasMinRole(minRole: UserRole): boolean {
  const roles = useUserRoles()
  return maxRank(roles) >= (ROLE_RANK[minRole] ?? 99)
}

export function useCan(resource: string, action: string): boolean {
  const roles = useUserRoles()
  const minRole = POLICY_MATRIX[resource]?.[action]
  if (!minRole) return false
  return maxRank(roles) >= (ROLE_RANK[minRole] ?? 99)
}
