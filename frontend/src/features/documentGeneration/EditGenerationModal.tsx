/**
 * EditGenerationModal
 *
 * Allows editing the parameters of a draft/preview DocumentGeneration.
 * The old generation is marked as "superseded" on the backend and a new one
 * is created with the updated parameters and a fresh DRAFT PDF.
 *
 * Design mirrors the existing DocumentWizard step-3 form for full consistency.
 */

import { useEffect, useState } from 'react'

import { Modal } from '@/components/ui/modal'
import {
  type DocumentTone,
  type GenerationRecord,
  type GenerationRequest,
  type IndexType,
  type PreviewResponse,
  usePreviewGeneration,
  useRegenerateGeneration,
} from '@/hooks/documentGenerations'
import { useAppSelector } from '@/hooks/store'

import { SimulationPanel } from './SimulationPanel'
import { INDEX_TYPE_LABELS, QUICK_HINTS, TONE_DESCRIPTIONS, TONE_LABELS } from './types'
import { colors } from './wizardStyles'

interface Props {
  generation: GenerationRecord
  isOpen: boolean
  onClose: () => void
  /** Called with the new GenerationRecord ID after successful regeneration. */
  onRegenerated?: (newGenId: string) => void
}

const TONE_VALUES: DocumentTone[] = ['formal', 'neutral', 'warm', 'assertive']
const INDEX_VALUES: IndexType[] = ['GUS_CPI', 'fixed_pct', 'custom']

function extractParams(gen: GenerationRecord) {
  const req = gen.payload?.request as GenerationRequest | undefined
  return {
    year: req?.params?.year ?? new Date().getFullYear() + 1,
    indexType: (req?.params?.index_type ?? 'GUS_CPI') as IndexType,
    indexValue: String(req?.params?.index_value ?? '4.60'),
    effectiveDate: req?.params?.effective_date ?? `${new Date().getFullYear() + 1}-01-01`,
    tone: (req?.tone ?? 'neutral') as DocumentTone,
    includeCoverLetter: req?.include_cover_letter ?? true,
    includeRationale: req?.include_ai_rationale ?? true,
    userInstructions: req?.user_instructions ?? '',
    templateKey: req?.template_key ?? gen.template_key,
    customerId: req?.customer_id ?? gen.customer_id,
    contractId: req?.contract_id ?? gen.contract_id ?? null,
  }
}

export function EditGenerationModal({ generation, isOpen, onClose, onRegenerated }: Props) {
  const user = useAppSelector((s) => s.auth.user)

  const previewMut = usePreviewGeneration()
  const regenerateMut = useRegenerateGeneration()

  // ── Form state — seeded from existing generation payload ─────────────────
  const initial = extractParams(generation)

  const [year, setYear] = useState(initial.year)
  const [indexType, setIndexType] = useState<IndexType>(initial.indexType)
  const [indexValue, setIndexValue] = useState(initial.indexValue)
  const [effectiveDate, setEffectiveDate] = useState(initial.effectiveDate)
  const [tone, setTone] = useState<DocumentTone>(initial.tone)
  const [includeCoverLetter, setIncludeCoverLetter] = useState(initial.includeCoverLetter)
  const [includeRationale, setIncludeRationale] = useState(initial.includeRationale)
  const [userInstructions, setUserInstructions] = useState(initial.userInstructions ?? '')

  const [preview, setPreview] = useState<PreviewResponse | null>(null)
  const [previewError, setPreviewError] = useState<string | null>(null)
  const [showPreview, setShowPreview] = useState(false)

  // Reset state when modal opens with (potentially) a different generation.
  useEffect(() => {
    if (!isOpen) return
    const p = extractParams(generation)
    setYear(p.year)
    setIndexType(p.indexType)
    setIndexValue(p.indexValue)
    setEffectiveDate(p.effectiveDate)
    setTone(p.tone)
    setIncludeCoverLetter(p.includeCoverLetter)
    setIncludeRationale(p.includeRationale)
    setUserInstructions(p.userInstructions ?? '')
    setPreview(null)
    setPreviewError(null)
    setShowPreview(false)
  }, [isOpen, generation.id]) // eslint-disable-line react-hooks/exhaustive-deps

  function buildRequest(): GenerationRequest {
    return {
      template_key: initial.templateKey,
      customer_id: initial.customerId,
      contract_id: initial.contractId,
      params: {
        year,
        index_type: indexType,
        index_value: Number(indexValue),
        effective_date: effectiveDate,
        services: [],
      },
      user_instructions: userInstructions.trim() || null,
      tone,
      include_cover_letter: includeCoverLetter,
      include_ai_rationale: includeRationale,
    }
  }

  async function handlePreview() {
    setPreviewError(null)
    setShowPreview(true)
    previewMut.mutate(buildRequest(), {
      onSuccess: (data) => setPreview(data),
      onError: () => setPreviewError('Nie udało się wygenerować podglądu. Sprawdź parametry.'),
    })
  }

  async function handleSave() {
    if (!user?.id) {
      alert('Brak zalogowanego użytkownika.')
      return
    }
    try {
      const newGen = await regenerateMut.mutateAsync({
        id: generation.id,
        request: buildRequest(),
        regenerated_by: user.id,
      })
      onRegenerated?.(newGen.id)
      onClose()
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Nieznany błąd'
      alert(`Nie udało się zapisać zmian.\n\n${msg}`)
    }
  }

  const isSaving = regenerateMut.isPending

  // ── Helpers ───────────────────────────────────────────────────────────────
  const amendmentNumber =
    (generation.payload?.amendment_number as string | undefined) ?? '—'

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Edytuj parametry aneksu" maxWidth={860}>
      {/* Info strip */}
      <div
        style={{
          background: '#fff8f4',
          border: `1px solid ${colors.draftBorder}`,
          borderRadius: 8,
          padding: '10px 14px',
          fontSize: 12.5,
          color: '#7a4820',
          marginBottom: 18,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}
      >
        <span style={{ fontSize: 16 }}>✏️</span>
        <span>
          Edytujesz draft aneksu <strong>{amendmentNumber}</strong>. Po zapisaniu stary draft
          zostanie zastąpiony nowym — numer aneksu pozostaje bez zmian.
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: 18 }}>
        {/* ── Left: parameters ─────────────────────────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Field label="Rok waloryzacji">
            <input
              type="number"
              value={year}
              onChange={(e) => { setYear(Number(e.target.value)); setPreview(null) }}
              style={inputStyle}
            />
          </Field>

          <Field label="Typ indeksacji">
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {INDEX_VALUES.map((it) => (
                <button
                  key={it}
                  onClick={() => { setIndexType(it); setPreview(null) }}
                  style={chipStyle(indexType === it)}
                >
                  {INDEX_TYPE_LABELS[it]}
                </button>
              ))}
            </div>
          </Field>

          <Field label="Wartość indeksacji (%)" hint="np. CPI 4,6 = 4.60">
            <input
              type="number"
              step="0.01"
              value={indexValue}
              onChange={(e) => { setIndexValue(e.target.value); setPreview(null) }}
              style={inputStyle}
            />
          </Field>

          <Field label="Data wejścia w życie">
            <input
              type="date"
              value={effectiveDate}
              onChange={(e) => { setEffectiveDate(e.target.value); setPreview(null) }}
              style={inputStyle}
            />
          </Field>

          <Field label="Tonacja">
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {TONE_VALUES.map((t) => (
                <button key={t} onClick={() => setTone(t)} style={chipStyle(tone === t)}>
                  {TONE_LABELS[t]}
                </button>
              ))}
            </div>
            <div style={{ fontSize: 11, color: colors.textMuted, marginTop: 4, lineHeight: 1.5 }}>
              {TONE_DESCRIPTIONS[tone]}
            </div>
          </Field>

          <Field label="Dodatki AI">
            <label style={checkboxStyle}>
              <input
                type="checkbox"
                checked={includeRationale}
                onChange={(e) => setIncludeRationale(e.target.checked)}
              />
              Uzasadnienie biznesowe
            </label>
            <label style={checkboxStyle}>
              <input
                type="checkbox"
                checked={includeCoverLetter}
                onChange={(e) => setIncludeCoverLetter(e.target.checked)}
              />
              Pismo przewodnie
            </label>
          </Field>
        </div>

        {/* ── Right: instructions + simulation ─────────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Field
            label="Dodatkowe wytyczne (opcjonalne)"
            hint="Tylko narracja AI — nie wpływa na liczby ani klauzule."
          >
            <textarea
              value={userInstructions}
              onChange={(e) => setUserInstructions(e.target.value)}
              maxLength={2000}
              placeholder="np. Podkreśl wieloletnią współpracę i wspomnij o nowych usługach."
              style={{ ...inputStyle, height: 72, resize: 'vertical', fontFamily: 'inherit' }}
            />
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
              {QUICK_HINTS.map((h) => (
                <button
                  key={h.label}
                  onClick={() =>
                    setUserInstructions((prev) =>
                      prev ? `${prev}\n${h.text}` : h.text,
                    )
                  }
                  style={{
                    ...chipStyle(false),
                    background: colors.cardBg,
                    fontSize: 10.5,
                    padding: '3px 9px',
                  }}
                >
                  + {h.label}
                </button>
              ))}
            </div>
          </Field>

          {/* Simulation panel */}
          <div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 8,
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: colors.textMuted,
                  textTransform: 'uppercase',
                  letterSpacing: 0.4,
                }}
              >
                Symulacja finansowa
              </div>
              <button
                onClick={handlePreview}
                disabled={previewMut.isPending}
                style={{
                  ...chipStyle(false),
                  fontSize: 11.5,
                  padding: '4px 12px',
                  opacity: previewMut.isPending ? 0.6 : 1,
                }}
              >
                {previewMut.isPending ? 'Liczę…' : '↻ Przelicz'}
              </button>
            </div>

            {!showPreview && (
              <div
                style={{
                  background: colors.cardBg,
                  border: `1px solid ${colors.border}`,
                  borderRadius: 10,
                  padding: '20px 16px',
                  textAlign: 'center',
                  color: colors.textMuted,
                  fontSize: 12.5,
                }}
              >
                Kliknij „↻ Przelicz" aby zobaczyć symulację z nowymi parametrami.
              </div>
            )}

            {showPreview && previewMut.isPending && !preview && (
              <div
                style={{
                  background: colors.cardBg,
                  border: `1px solid ${colors.border}`,
                  borderRadius: 10,
                  padding: 18,
                  fontSize: 12.5,
                  color: colors.textMuted,
                  textAlign: 'center',
                }}
              >
                Generuję symulację…
              </div>
            )}

            {previewError && (
              <div
                style={{
                  padding: 12,
                  background: '#fff5f5',
                  border: '1px solid #feb2b2',
                  color: colors.negative,
                  fontSize: 12,
                  borderRadius: 8,
                }}
              >
                {previewError}
              </div>
            )}

            {preview && <SimulationPanel simulation={preview.simulation} />}
          </div>
        </div>
      </div>

      {/* ── Footer ────────────────────────────────────────────────────── */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'flex-end',
          gap: 10,
          marginTop: 20,
          paddingTop: 14,
          borderTop: `1px solid ${colors.borderSoft}`,
        }}
      >
        <button onClick={onClose} style={btnSecondary} disabled={isSaving}>
          Anuluj
        </button>
        <button
          onClick={handleSave}
          disabled={isSaving}
          style={{ ...btnPrimary, opacity: isSaving ? 0.6 : 1 }}
        >
          {isSaving ? 'Zapisuję…' : 'Zapisz i regeneruj draft'}
        </button>
      </div>
    </Modal>
  )
}

/* ── Small primitives ──────────────────────────────────────────────────────── */

function Field({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div>
      <div
        style={{
          fontSize: 11,
          fontWeight: 700,
          color: colors.textMuted,
          textTransform: 'uppercase',
          letterSpacing: 0.4,
          marginBottom: 5,
        }}
      >
        {label}
      </div>
      {children}
      {hint && (
        <div style={{ fontSize: 11, color: colors.textMuted, marginTop: 4, lineHeight: 1.5 }}>
          {hint}
        </div>
      )}
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  border: `1px solid ${colors.border}`,
  borderRadius: 8,
  padding: '8px 10px',
  fontSize: 13,
  outline: 'none',
  fontFamily: 'inherit',
  boxSizing: 'border-box',
}

function chipStyle(selected: boolean): React.CSSProperties {
  return {
    border: `1px solid ${selected ? colors.orange : colors.border}`,
    background: selected ? colors.orange : 'white',
    color: selected ? 'white' : colors.textPrimary,
    fontSize: 11.5,
    padding: '4px 11px',
    borderRadius: 999,
    cursor: 'pointer',
    fontFamily: 'inherit',
    fontWeight: 600,
  }
}

const checkboxStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  fontSize: 13,
  color: colors.textPrimary,
  fontFamily: 'inherit',
  marginBottom: 6,
  cursor: 'pointer',
}

const btnPrimary: React.CSSProperties = {
  background: colors.orange,
  color: 'white',
  border: 'none',
  borderRadius: 8,
  padding: '9px 20px',
  fontSize: 13,
  fontWeight: 700,
  cursor: 'pointer',
  fontFamily: 'inherit',
}

const btnSecondary: React.CSSProperties = {
  background: 'white',
  color: colors.textPrimary,
  border: `1px solid ${colors.border}`,
  borderRadius: 8,
  padding: '9px 16px',
  fontSize: 13,
  fontWeight: 600,
  cursor: 'pointer',
  fontFamily: 'inherit',
}
