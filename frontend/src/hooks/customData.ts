import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/lib/axios'

const BASE = '/api/v1/customers'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface CustomFieldDefinition {
  id: string
  customer_id: string
  field_name: string
  field_type: string
  display_name: string
  sort_order: number
  created_at: string
  created_by: string | null
}

export interface CustomFieldDefinitionCreate {
  field_name: string
  field_type: string
  display_name: string
  sort_order?: number
}

export interface CustomFieldValues {
  values: Record<string, unknown>
}

export interface CustomTableDefinition {
  id: string
  customer_id: string
  table_slug: string
  display_name: string
  db_table_name: string
  sort_order: number
  created_at: string
  created_by: string | null
  columns: CustomColumnDefinition[]
}

export interface CustomColumnDefinition {
  id: string
  column_name: string
  column_type: string
  display_name: string
  sort_order: number
}

export interface CustomTableCreate {
  table_slug: string
  display_name: string
  columns: { column_name: string; column_type: string; display_name: string; sort_order?: number }[]
}

export interface RowsListResponse {
  items: Record<string, unknown>[]
  count: number
}

// ── Custom Fields ─────────────────────────────────────────────────────────────

export function useCustomFieldDefinitions(customerId: string | undefined) {
  return useQuery({
    queryKey: ['custom-fields-defs', customerId],
    queryFn: async () => {
      const { data } = await apiClient.get<CustomFieldDefinition[]>(
        `${BASE}/${customerId}/custom-fields/definitions`
      )
      return data
    },
    enabled: !!customerId,
  })
}

export function useCreateCustomFieldDefinition(customerId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: CustomFieldDefinitionCreate) => {
      const { data } = await apiClient.post<CustomFieldDefinition>(
        `${BASE}/${customerId}/custom-fields/definitions`,
        payload
      )
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['custom-fields-defs', customerId] })
    },
  })
}

export function useDeleteCustomFieldDefinition(customerId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (fieldId: string) => {
      await apiClient.delete(`${BASE}/${customerId}/custom-fields/definitions/${fieldId}`)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['custom-fields-defs', customerId] })
      qc.invalidateQueries({ queryKey: ['custom-fields-values', customerId] })
    },
  })
}

export function useCustomFieldValues(customerId: string | undefined) {
  return useQuery({
    queryKey: ['custom-fields-values', customerId],
    queryFn: async () => {
      const { data } = await apiClient.get<CustomFieldValues>(
        `${BASE}/${customerId}/custom-fields`
      )
      return data
    },
    enabled: !!customerId,
  })
}

export function useUpdateCustomFieldValues(customerId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (values: Record<string, unknown>) => {
      const { data } = await apiClient.patch<CustomFieldValues>(
        `${BASE}/${customerId}/custom-fields`,
        { values }
      )
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['custom-fields-values', customerId] })
    },
  })
}

// ── Custom Tables ─────────────────────────────────────────────────────────────

export function useCustomTables(customerId: string | undefined) {
  return useQuery({
    queryKey: ['custom-tables', customerId],
    queryFn: async () => {
      const { data } = await apiClient.get<CustomTableDefinition[]>(
        `${BASE}/${customerId}/custom-tables`
      )
      return data
    },
    enabled: !!customerId,
  })
}

export function useCreateCustomTable(customerId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: CustomTableCreate) => {
      const { data } = await apiClient.post<CustomTableDefinition>(
        `${BASE}/${customerId}/custom-tables`,
        payload
      )
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['custom-tables', customerId] })
    },
  })
}

export function useDeleteCustomTable(customerId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (tableId: string) => {
      await apiClient.delete(`${BASE}/${customerId}/custom-tables/${tableId}`)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['custom-tables', customerId] })
    },
  })
}

export function useTableRows(customerId: string | undefined, tableId: string | undefined) {
  return useQuery({
    queryKey: ['custom-table-rows', customerId, tableId],
    queryFn: async () => {
      const { data } = await apiClient.get<RowsListResponse>(
        `${BASE}/${customerId}/custom-tables/${tableId}/rows`
      )
      return data
    },
    enabled: !!customerId && !!tableId,
  })
}

export function useInsertRow(customerId: string, tableId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (rowData: Record<string, unknown>) => {
      const { data } = await apiClient.post(
        `${BASE}/${customerId}/custom-tables/${tableId}/rows`,
        { data: rowData }
      )
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['custom-table-rows', customerId, tableId] })
    },
  })
}

export function useUpdateRow(customerId: string, tableId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ rowId, rowData }: { rowId: number; rowData: Record<string, unknown> }) => {
      const { data } = await apiClient.patch(
        `${BASE}/${customerId}/custom-tables/${tableId}/rows/${rowId}`,
        { data: rowData }
      )
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['custom-table-rows', customerId, tableId] })
    },
  })
}

export function useDeleteRow(customerId: string, tableId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (rowId: number) => {
      await apiClient.delete(
        `${BASE}/${customerId}/custom-tables/${tableId}/rows/${rowId}`
      )
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['custom-table-rows', customerId, tableId] })
    },
  })
}
