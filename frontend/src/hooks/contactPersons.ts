import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { apiClient } from '@/lib/axios'
import type {
  ContactPerson,
  ContactPersonCreate,
  ContactPersonUpdate,
} from '@/types/models'

const BASE = '/api/v1'

export function useContactPersons(customerId: string | undefined) {
  return useQuery({
    queryKey: ['contact-persons', customerId],
    queryFn: async () => {
      const { data } = await apiClient.get<ContactPerson[]>(
        `${BASE}/customers/${customerId}/contacts`,
      )
      return data
    },
    enabled: !!customerId,
  })
}

export function useCreateContactPerson() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      customerId,
      payload,
    }: {
      customerId: string
      payload: ContactPersonCreate
    }) => {
      const { data } = await apiClient.post<ContactPerson>(
        `${BASE}/customers/${customerId}/contacts`,
        payload,
      )
      return data
    },
    onSuccess: (_, { customerId }) => {
      qc.invalidateQueries({ queryKey: ['contact-persons', customerId] })
    },
  })
}

export function useUpdateContactPerson() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      customerId,
      contactId,
      payload,
    }: {
      customerId: string
      contactId: string
      payload: ContactPersonUpdate
    }) => {
      const { data } = await apiClient.patch<ContactPerson>(
        `${BASE}/customers/${customerId}/contacts/${contactId}`,
        payload,
      )
      return data
    },
    onSuccess: (_, { customerId }) => {
      qc.invalidateQueries({ queryKey: ['contact-persons', customerId] })
    },
  })
}

export function useDeleteContactPerson() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      customerId,
      contactId,
    }: {
      customerId: string
      contactId: string
    }) => {
      await apiClient.delete(
        `${BASE}/customers/${customerId}/contacts/${contactId}`,
      )
    },
    onSuccess: (_, { customerId }) => {
      qc.invalidateQueries({ queryKey: ['contact-persons', customerId] })
    },
  })
}
