import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { apiClient } from '@/lib/axios'

const BASE = '/api/v1/document-generations'

// ── Types — manually mirrored until next `npm run types:sync` ────────────────

export type DocumentTone = 'formal' | 'neutral' | 'warm' | 'assertive'

export type IndexType = 'GUS_CPI' | 'fixed_pct' | 'custom'

export type GenerationStatus =
  | 'draft'
  | 'preview'
  | 'finalized'
  | 'accepted'
  | 'sent'
  | 'superseded'
  | 'rejected'

export interface DocumentTemplate {
  key: string
  version: string
  title: string
  description: string
  output_document_type: string
  creates_amendment: boolean
  params_schema: Record<string, unknown>
}

export interface ValorizationServiceInput {
  contract_service_id: string
  include?: boolean
  custom_index_pct?: number | null
}

export interface ValorizationParams {
  year: number
  index_type: IndexType
  index_value: number
  effective_date: string
  services?: ValorizationServiceInput[]
}

export interface GenerationRequest {
  template_key: string
  customer_id: string
  contract_id?: string | null
  params: ValorizationParams
  user_instructions?: string | null
  tone?: DocumentTone
  include_cover_letter?: boolean
  include_ai_rationale?: boolean
}

export interface ServiceSimulation {
  contract_service_id: string
  service_name: string
  current_base_price: string
  discount_pct: string
  current_effective_price: string
  applied_index_pct: string
  proposed_base_price: string
  proposed_effective_price: string
  delta_per_period: string
  delta_yearly: string
  billing_cycle: string | null
  billing_unit: string | null
}

export interface SimulationSummary {
  services: ServiceSimulation[]
  current_annual_revenue: string
  proposed_annual_revenue: string
  delta_annual_revenue: string
  delta_annual_revenue_pct: string
  weighted_avg_index_pct: string
}

export interface PreviewResponse {
  simulation: SimulationSummary
  rendered_html: string
  cover_letter_text: string | null
  rationale_bullets: string[]
  template_key: string
  template_version: string
}

export interface GenerationRecord {
  id: string
  customer_id: string
  contract_id: string | null
  amendment_id: string | null
  attachment_pdf_id: string | null
  cover_letter_attachment_id: string | null
  template_key: string
  template_version: string
  status: GenerationStatus
  payload: Record<string, unknown>
  simulation: Record<string, unknown>
  ai_artifacts: Record<string, unknown>
  pdf_sha256: string | null
  generated_by: string | null
  accepted_by: string | null
  created_at: string
  updated_at: string
}

// ── Hooks ────────────────────────────────────────────────────────────────────

export function useDocumentTemplates() {
  return useQuery({
    queryKey: ['document-generations', 'templates'],
    queryFn: async () => {
      const { data } = await apiClient.get<DocumentTemplate[]>(`${BASE}/templates`)
      return data
    },
    staleTime: 5 * 60 * 1000,
  })
}

export function useDocumentGenerations(customerId?: string) {
  return useQuery({
    queryKey: ['document-generations', 'list', customerId],
    queryFn: async () => {
      const { data } = await apiClient.get<GenerationRecord[]>(`${BASE}/`, {
        params: { customer_id: customerId },
      })
      return data
    },
    enabled: !!customerId,
  })
}

export function usePreviewGeneration() {
  return useMutation({
    mutationFn: async (request: GenerationRequest) => {
      const { data } = await apiClient.post<PreviewResponse>(`${BASE}/preview`, request)
      return data
    },
  })
}

export function useFinalizeGeneration() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      request,
      generated_by,
    }: {
      request: GenerationRequest
      generated_by: string
    }) => {
      const { data } = await apiClient.post<GenerationRecord>(`${BASE}/`, request, {
        params: { generated_by },
      })
      return data
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['document-generations', 'list', vars.request.customer_id] })
      qc.invalidateQueries({ queryKey: ['timeline', vars.request.customer_id] })
    },
  })
}

export function useAcceptGeneration() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, accepted_by }: { id: string; accepted_by: string }) => {
      const { data } = await apiClient.post<GenerationRecord>(`${BASE}/${id}/accept`, {
        accepted_by,
      })
      return data
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['document-generations', 'list', data.customer_id] })
      qc.invalidateQueries({ queryKey: ['timeline', data.customer_id] })
    },
  })
}

export function useRejectGeneration() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      id,
      rejected_by,
      customer_id,
    }: {
      id: string
      rejected_by: string
      customer_id: string
    }) => {
      await apiClient.post(`${BASE}/${id}/reject`, null, { params: { rejected_by } })
      return { customer_id }
    },
    onSuccess: ({ customer_id }) => {
      qc.invalidateQueries({ queryKey: ['document-generations', 'list', customer_id] })
    },
  })
}
