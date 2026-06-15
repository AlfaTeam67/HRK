import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/lib/axios'
import type { components } from '@/types/api'

type S = components['schemas']

// Extend generated types with deadline/resolved fields until types:sync regenerates api.ts
export type Note = S['NoteRead'] & {
  deadline_at?: string | null
  is_resolved: boolean
}
export type NoteCreate = S['NoteCreate'] & {
  deadline_at?: string | null
}
export type NoteUpdate = S['NoteUpdate'] & {
  deadline_at?: string | null
  is_resolved?: boolean
}

const BASE = '/api/v1/notes'

export interface NotesFilters {
  customer_id?: string
  contract_id?: string
  skip?: number
  limit?: number
}

export function useNotes(filters: NotesFilters) {
  return useQuery({
    queryKey: ['notes', filters],
    queryFn: async () => {
      const { data } = await apiClient.get<Note[]>(BASE, { params: filters })
      return data
    },
    enabled: !!(filters.customer_id || filters.contract_id),
  })
}

export function useNote(id: string) {
  return useQuery({
    queryKey: ['note', id],
    queryFn: async () => {
      const { data } = await apiClient.get<Note>(`${BASE}/${id}`)
      return data
    },
    enabled: !!id,
  })
}

export function useCreateNote() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (payload: NoteCreate) => {
      const { data } = await apiClient.post<Note>(BASE, payload)
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notes'] })
    },
  })
}

export function useUpdateNote() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...payload }: { id: string } & NoteUpdate) => {
      const { data } = await apiClient.patch<Note>(`${BASE}/${id}`, payload)
      return data
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['notes'] })
      queryClient.invalidateQueries({ queryKey: ['note', variables.id] })
    },
  })
}

export function useDeleteNote() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`${BASE}/${id}`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notes'] })
    },
  })
}
