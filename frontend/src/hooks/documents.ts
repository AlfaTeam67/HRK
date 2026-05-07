import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/lib/axios'
import type { DocumentRead } from '@/types/models'

const BASE = '/api/v1/documents'

export interface DocumentUploadParams {
  file: File
  document_type?: string
  company_id?: string
  customer_id?: string
  contract_id?: string
  uploaded_by: string
}

export function useUploadDocument() {
  const qc = useQueryClient()
  
  return useMutation({
    mutationFn: async (params: DocumentUploadParams) => {
      const formData = new FormData()
      formData.append('file', params.file)
      if (params.document_type) formData.append('document_type', params.document_type)
      if (params.company_id) formData.append('company_id', params.company_id)
      if (params.customer_id) formData.append('customer_id', params.customer_id)
      if (params.contract_id) formData.append('contract_id', params.contract_id)
      formData.append('uploaded_by', params.uploaded_by)

      const { data } = await apiClient.post<DocumentRead>(`${BASE}/`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      })
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['documents'] })
      qc.invalidateQueries({ queryKey: ['contracts'] })
    },
  })
}

export function useDocumentsQuery(params?: { customer_id?: string; contract_id?: string }) {
  return useQuery({
    queryKey: ['documents', params],
    queryFn: async () => {
      const { data } = await apiClient.get<DocumentRead[]>(`${BASE}/`, { params })
      return data
    },
  })
}

export function useDocumentDownloadUrl() {
  return useMutation({
    mutationFn: async ({ id, userId }: { id: string; userId: string }) => {
      const { data } = await apiClient.get<{ url: string; expires_in: number }>(
        `${BASE}/${id}/download-url`,
        { params: { requester_user_id: userId } }
      )
      return data
    },
  })
}
