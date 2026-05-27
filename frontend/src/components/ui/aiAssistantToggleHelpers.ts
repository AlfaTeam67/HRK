/**
 * Helpers for the AI assistant toggle UI.
 *
 * IMPORTANT: ``_PROCESSABLE_MIMES`` must stay in sync with the backend
 * ``_PROCESSABLE`` set in ``app/service/document_processing.py``.
 */

import type { OcrStatus } from '@/components/ui/OcrStatusBadge'

export type AiToggleState = 'on' | 'off' | 'indexing' | 'failed' | 'unsupported'

const _PROCESSABLE_MIMES = new Set([
  'application/pdf',
  'text/plain',
  'image/jpeg',
  'image/png',
  'image/tiff',
  'image/bmp',
  'image/webp',
])

export function deriveAiToggleState({
  enabled,
  ocrStatus,
  mimeType,
}: {
  enabled: boolean
  ocrStatus: OcrStatus
  mimeType: string | null | undefined
}): AiToggleState {
  if (mimeType && !_PROCESSABLE_MIMES.has(mimeType)) return 'unsupported'
  if (enabled && (ocrStatus === 'pending' || ocrStatus === 'processing' || !ocrStatus))
    return 'indexing'
  if (enabled && ocrStatus === 'failed') return 'failed'
  if (enabled) return 'on'
  return 'off'
}
