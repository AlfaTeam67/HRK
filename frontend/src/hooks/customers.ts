import { useCallback, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { apiClient } from '@/lib/axios'
import { env } from '@/lib/env'
import { useAppSelector } from '@/hooks/store'
import type { Customer, CustomerCreate, CustomerStatus, CustomerUpdate } from '@/types/models'

const BASE = '/api/v1'

export interface CustomersFilters {
  q?: string
  company_id?: string
  manager_id?: string
  statuses?: CustomerStatus[]
  created_from?: string
  created_to?: string
}

export function useCustomers(filters?: CustomersFilters) {
  return useQuery({
    queryKey: ['customers', filters],
    queryFn: async () => {
      const { data } = await apiClient.get<Customer[]>(`${BASE}/customers`, { params: filters })
      return data
    },
  })
}

export function useCustomer(id: string | undefined) {
  return useQuery({
    queryKey: ['customers', id],
    queryFn: async () => {
      const { data } = await apiClient.get<Customer>(`${BASE}/customers/${id}`)
      return data
    },
    enabled: !!id,
  })
}

export function useCreateCustomer() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: CustomerCreate) => {
      const { data } = await apiClient.post<Customer>(`${BASE}/customers`, payload)
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['customers'] })
    },
  })
}

export function useUpdateCustomer() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: CustomerUpdate }) => {
      const { data } = await apiClient.patch<Customer>(`${BASE}/customers/${id}`, payload)
      return data
    },
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: ['customers'] })
      qc.invalidateQueries({ queryKey: ['customers', id] })
    },
  })
}

export function useDeleteCustomer() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`${BASE}/customers/${id}`)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['customers'] })
    },
  })
}

export interface AiSummaryResponse {
  summary: string
  generated_at: string
}

export function useCustomerAiSummaryStream() {
  const [text, setText] = useState('')
  const [isPending, setIsPending] = useState(false)
  const [isError, setIsError] = useState(false)
  const token = useAppSelector((s) => s.auth.token)
  const abortRef = useRef<AbortController | null>(null)

  const reset = useCallback(() => {
    abortRef.current?.abort()
    setText('')
    setIsPending(false)
    setIsError(false)
  }, [])

  const trigger = useCallback(
    (customerId: string) => {
      abortRef.current?.abort()
      const controller = new AbortController()
      abortRef.current = controller

      setText('')
      setIsPending(true)
      setIsError(false)

      const headers: Record<string, string> = {}
      if (token) headers['Authorization'] = `Bearer ${token}`

      ;(async () => {
        try {
          const response = await fetch(
            `${env.apiUrl}/api/v1/customers/${customerId}/ai-summary/stream`,
            { signal: controller.signal, headers }
          )
          if (!response.ok || !response.body) throw new Error('Request failed')

          const reader = response.body.getReader()
          const decoder = new TextDecoder()
          let buffer = ''

          while (true) {
            const { done, value } = await reader.read()
            if (done) break
            buffer += decoder.decode(value, { stream: true })
            const parts = buffer.split('\n\n')
            buffer = parts.pop() ?? ''
            for (const part of parts) {
              if (!part.startsWith('data: ')) continue
              try {
                const msg = JSON.parse(part.slice(6))
                if (msg.error) { setIsError(true); setIsPending(false); return }
                if (msg.token) setText((prev) => prev + msg.token)
                if (msg.done) setIsPending(false)
              } catch {
                // ignore malformed SSE chunks
              }
            }
          }
          setIsPending(false)
        } catch (err) {
          if ((err as Error).name === 'AbortError') return
          setIsError(true)
          setIsPending(false)
        }
      })()
    },
    [token]
  )

  return { text, isPending, isError, trigger, reset }
}
