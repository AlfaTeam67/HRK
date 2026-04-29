// Convenience re-exports from the auto-generated api.ts (npm run types:sync).
// Import from this file instead of api.ts directly — keeps hook imports stable
// when the generated file is regenerated.

import type { components } from '@/types/api'

type S = components['schemas']

// ── Entities ─────────────────────────────────────────────────────────────────

export type Company            = S['CompanyRead']
export type CompanyCreate      = S['CompanyCreate']
export type CompanyUpdate      = S['CompanyUpdate']

export type Customer           = S['CustomerRead']
export type CustomerCreate     = S['CustomerCreate']
export type CustomerUpdate     = S['CustomerUpdate']

export type Contract           = S['ContractRead']
export type ContractCreate     = S['ContractCreate']
export type ContractUpdate     = S['ContractUpdate']

export type Valorization       = S['ValorizationRead']
export type ValorizationCreate = S['ValorizationCreate']
export type ValorizationUpdate = S['ValorizationUpdate']

export type Service            = S['ServiceRead']
export type ServiceCreate      = S['ServiceCreate']
export type ServiceUpdate      = S['ServiceUpdate']

export type ServiceGroup       = S['ServiceGroupRead']
export type ServiceGroupCreate = S['ServiceGroupCreate']
export type ServiceGroupUpdate = S['ServiceGroupUpdate']

export type CustomerRate       = S['CustomerRateRead']
export type CustomerRateCreate = S['CustomerRateCreate']
export type CustomerRateUpdate = S['CustomerRateUpdate']

export type User               = S['UserRead']
export type UserCreate         = S['UserCreate']
export type UserUpdate         = S['UserUpdate']

export type PaginatedCompanies = S['PaginatedResponse_CompanyRead_']

// ── Enums (string literal types from backend) ────────────────────────────────

export type CustomerStatus    = S['CustomerStatus']
export type ContractType      = S['ContractType']
export type ContractStatus    = S['ContractStatus']
export type BillingCycle      = S['BillingCycle']
export type BillingUnit       = S['BillingUnit']
export type BillingFrequency  = S['BillingFrequency']
export type ValorizationStatus = S['ValorizationStatus']
export type IndexType         = S['IndexType']

// ── Pagination helper (generic) ───────────────────────────────────────────────

export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  page_size: number
  pages: number
}
