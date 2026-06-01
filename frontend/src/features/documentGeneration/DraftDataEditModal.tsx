/**
 * DraftDataEditModal — ALF-93
 *
 * Allows an operator to edit the AI-generated narrative content of a
 * PREVIEW/DRAFT generation before accepting the document.
 *
 * What CAN be edited here:
 *   • Cover letter text (pismo przewodnie)
 *   • Rationale bullets (uzasadnienie biznesowe)
 *   • Operator note (notatka wewnętrzna, widoczna w payloadzie)
 *
 * What CANNOT be edited:
 *   • Financial figures / simulation data
 *   • Legal clauses
 *   • Amendment number / dates
 *
 * Design rule: zero additional AI calls — the user edits the already-generated
 * text by hand. This keeps the flow deterministic and fast.
 */

import { useEffect, useState } from 'react'

import { Modal } from '@/components/ui/modal'
import { type DraftDataUpdate, type GenerationRecord, useUpdateDraftData } from '@/hooks/documentGenerations'
import { useAppSelector } from '@/hooks/store'

import { colors } from './wizardStyles'

interface Props {
  gen: GenerationRecord
  isOpen: boolean
  onClose: () => void
  onSaved: () => void
}

export function DraftDataEditModal({ gen, isOpen, onClose, onSaved }: Props) {
  const user = useAppSelector((s) => s.auth.user)
  const updateMut = useUpdateDraftData()

  // Derive initial values from the record's ai_artifacts
  const artifacts = gen.ai_artifacts as Record<string, unknown>
  const initialCoverLetter = (artifacts.cover_letter_text as string | null | undefined) ?? ''
  const initialBullets: string[] = Array.isArray(artifacts.rationale_bullets)
    ? (artifacts.rationale_bullets as string[])
    : []
  const initialNote =
    (gen.payload as Record<string, unknown>)?.operator_note as string | undefined ?? ''

  const [coverLetter, setCoverLetter] = useState(initialCoverLetter)
  const [bullets, setBullets] = useState<string[]>(initialBullets)
  const [note, setNote] = useState(initialNote)
  const [error, setError] = useState<string | null>(null)

  // Sync state when the modal re-opens for the same/different record
  useEffect(() => {
    if (!isOpen) return
    const arts = gen.ai_artifacts as Record<string, unknown>
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCoverLetter((arts.cover_letter_text as string | null | undefined) ?? '')
    setBullets(
      Array.isArray(arts.rationale_bullets) ? (arts.rationale_bullets as string[]) : []
    )
    setNote(
      ((gen.payload as Record<string, unknown>)?.operator_note as string | undefined) ?? ''
    )
    setError(null)
  }, [isOpen, gen.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const hasCoverLetter = initialCoverLetter.length > 0
  const hasRationale = initialBullets.length > 0
  const hasContent = hasCoverLetter || hasRationale

  async function handleSave() {
    if (!user?.id) return
    setError(null)

    const patch: DraftDataUpdate = {}
    if (hasCoverLetter) patch.cover_letter_text = coverLetter.trim() || null
    if (hasRationale) patch.rationale_bullets = bullets.filter((b) => b.trim().length > 0)
    if (note.trim()) patch.user_note = note.trim()
    else patch.user_note = null

    try {
      await updateMut.mutateAsync({ id: gen.id, updated_by: user.id, data: patch })
      onSaved()
      onClose()
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Nieznany błąd'
      setError(`Nie udało się zapisać zmian.\n\n${msg}`)
    }
  }

  function updateBullet(index: number, value: string) {
    setBullets((prev) => prev.map((b, i) => (i === index ? value : b)))
  }

  function removeBullet(index: number) {
    setBullets((prev) => prev.filter((_, i) => i !== index))
  }

  function addBullet() {
    if (bullets.length >= 10) return
    setBullets((prev) => [...prev, ''])
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="✎ Edycja danych roboczych aneksu"
      maxWidth={740}
    >
      <div style={{ fontSize: 12.5, color: colors.textMuted, marginBottom: 16, lineHeight: 1.6 }}>
        Możesz skorygować treści wygenerowane przez AI przed zatwierdzeniem dokumentu.
        Dane finansowe i klauzule prawne pozostają niezmienione.
      </div>

      {!hasContent && (
        <div
          style={{
            padding: 16,
            background: '#fafaf9',
            border: `1px solid ${colors.border}`,
            borderRadius: 10,
            color: colors.textMuted,
            fontSize: 13,
            marginBottom: 16,
          }}
        >
          Ten dokument nie zawiera treści AI (pisma przewodniego ani uzasadnienia).
          Możesz dodać wyłącznie notatkę wewnętrzną poniżej.
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* ── Cover letter ──────────────────────────────────────────────── */}
        {hasCoverLetter && (
          <section>
            <SectionLabel>Pismo przewodnie (AI)</SectionLabel>
            <div
              style={{
                fontSize: 11,
                color: colors.textMuted,
                marginBottom: 6,
                lineHeight: 1.5,
              }}
            >
              Edytuj treść pisma. Elementy szablonu (nagłówek, podpis) są dodawane
              automatycznie przy generowaniu PDF — nie musisz ich tutaj wpisywać.
            </div>
            <textarea
              value={coverLetter}
              onChange={(e) => setCoverLetter(e.target.value)}
              maxLength={10000}
              rows={10}
              style={textareaStyle}
            />
            <div style={{ fontSize: 11, color: colors.textMuted, marginTop: 4, textAlign: 'right' }}>
              {coverLetter.length} / 10 000 znaków
            </div>
          </section>
        )}

        {/* ── Rationale bullets ─────────────────────────────────────────── */}
        {hasRationale && (
          <section>
            <SectionLabel>Uzasadnienie biznesowe (AI) — punkty</SectionLabel>
            <div
              style={{
                fontSize: 11,
                color: colors.textMuted,
                marginBottom: 8,
                lineHeight: 1.5,
              }}
            >
              Maks. 10 punktów. Każdy w jednym zdaniu. Puste punkty są ignorowane.
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {bullets.map((bullet, i) => (
                <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'flex-start' }}>
                  <span
                    style={{
                      minWidth: 20,
                      height: 20,
                      marginTop: 9,
                      borderRadius: '50%',
                      background: colors.cardBg,
                      border: `1px solid ${colors.border}`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 10,
                      fontWeight: 700,
                      color: colors.textMuted,
                      flexShrink: 0,
                    }}
                  >
                    {i + 1}
                  </span>
                  <input
                    type="text"
                    value={bullet}
                    onChange={(e) => updateBullet(i, e.target.value)}
                    maxLength={400}
                    style={{ ...inputStyle, flex: 1 }}
                    placeholder="Treść punktu uzasadnienia…"
                  />
                  <button
                    onClick={() => removeBullet(i)}
                    title="Usuń punkt"
                    style={{
                      background: 'none',
                      border: `1px solid ${colors.border}`,
                      borderRadius: 6,
                      padding: '6px 8px',
                      cursor: 'pointer',
                      color: colors.textMuted,
                      fontSize: 12,
                      marginTop: 2,
                      lineHeight: 1,
                    }}
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
            {bullets.length < 10 && (
              <button onClick={addBullet} style={addBulletBtnStyle}>
                + Dodaj punkt
              </button>
            )}
          </section>
        )}

        {/* ── Operator note ─────────────────────────────────────────────── */}
        <section>
          <SectionLabel>Notatka pracownika (opcjonalna, wewnętrzna)</SectionLabel>
          <div
            style={{
              fontSize: 11,
              color: colors.textMuted,
              marginBottom: 6,
              lineHeight: 1.5,
            }}
          >
            Notatka nie jest widoczna w dokumencie PDF. Służy wyłącznie do wewnętrznego
            opisu powodów korekty.
          </div>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={2000}
            rows={3}
            placeholder="np. Skróciłem pismo ze względu na prośbę opiekuna klienta…"
            style={textareaStyle}
          />
        </section>
      </div>

      {/* ── Error ──────────────────────────────────────────────────────── */}
      {error && (
        <div
          style={{
            marginTop: 12,
            padding: 10,
            background: '#fff5f5',
            border: `1px solid ${colors.rejectedBorder}`,
            borderRadius: 8,
            fontSize: 12,
            color: colors.negative,
            whiteSpace: 'pre-wrap',
          }}
        >
          {error}
        </div>
      )}

      {/* ── Footer ─────────────────────────────────────────────────────── */}
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
        <button onClick={onClose} style={btnSecondary} disabled={updateMut.isPending}>
          Anuluj
        </button>
        <button
          onClick={handleSave}
          disabled={updateMut.isPending || !user?.id}
          style={{
            ...btnPrimary,
            opacity: updateMut.isPending ? 0.6 : 1,
          }}
        >
          {updateMut.isPending ? 'Zapisuję…' : 'Zapisz zmiany'}
        </button>
      </div>
    </Modal>
  )
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontSize: 11,
        fontWeight: 700,
        color: colors.textMuted,
        textTransform: 'uppercase' as const,
        letterSpacing: 0.4,
        marginBottom: 6,
      }}
    >
      {children}
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  border: `1px solid ${colors.border}`,
  borderRadius: 8,
  padding: '7px 10px',
  fontSize: 13,
  outline: 'none',
  fontFamily: 'inherit',
  boxSizing: 'border-box',
}

const textareaStyle: React.CSSProperties = {
  ...inputStyle,
  resize: 'vertical',
  lineHeight: 1.6,
  fontFamily: 'inherit',
}

const addBulletBtnStyle: React.CSSProperties = {
  marginTop: 8,
  background: colors.cardBg,
  border: `1px dashed ${colors.border}`,
  borderRadius: 8,
  padding: '6px 14px',
  fontSize: 12,
  color: colors.textMuted,
  cursor: 'pointer',
  fontFamily: 'inherit',
  width: '100%',
}

const btnPrimary: React.CSSProperties = {
  background: colors.orange,
  color: 'white',
  border: 'none',
  borderRadius: 8,
  padding: '8px 18px',
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
  padding: '8px 16px',
  fontSize: 13,
  fontWeight: 600,
  cursor: 'pointer',
  fontFamily: 'inherit',
}
