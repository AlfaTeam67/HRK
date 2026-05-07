import { useMutation } from '@tanstack/react-query'
import { apiClient } from '@/lib/axios'

const BASE = '/api/v1/rag'

export interface RagSearchRequest {
  customer_id: string
  query: string
  ai_mode: boolean
  top_k?: number
}

export interface ChunkResult {
  chunk_id: string
  attachment_id: string
  content: string
  highlight: string | null
  page_number: number | null
  bbox: Record<string, unknown> | null
  section_title: string | null
  score: number
}

export interface RagSearchResponse {
  chunks: ChunkResult[]
  ai_answer: string | null
}

export function useRagSearch() {
  return useMutation({
    mutationFn: async (req: RagSearchRequest) => {
      const { data } = await apiClient.post<RagSearchResponse>(`${BASE}/search`, req)
      return data
    },
  })
}
