import { useEffect, useMemo, useState } from 'react'

import { Modal } from '@/components/ui/modal'
import {
  type GenerationRequest,
  type IndexType,
  type PreviewResponse,
  type DocumentTone,
  useDocumentTemplates,
  useFinalizeGeneration,
  usePreviewGeneration,
} from '@/hooks/documentGenerations'
import { useAppSelector } from '@/hooks/store'
import type { Contract, Customer } from '@/types/models'

import { SimulationPanel } from './SimulationPanel'
import { INDEX_TYPE_LABELS, QUICK_HINTS, TONE_DESCRIPTIONS, TONE_LABELS } from './types'
import { colors } from './wizardStyles'

interface Props {
  isOpen: boolean
  customer: Customer
  contracts: Contract[]
  onClose: () => void
  onFinalized: (generationId: string) => void
}

type StepKey = 1 | 2 | 3 | 4

const TONE_VALUES: DocumentTone[] = ['formal', 'neutral', 'warm', 'assertive']
const INDEX_VALUES: IndexType[] = ['GUS_CPI', 'fixed_pct', 'custom']

export function DocumentWizard({ isOpen, customer, contracts, onClose, onFinalized }: Props) {
  const user = useAppSelector((s) => s.auth.user)
  const { data: templates = [] } = useDocumentTemplates()
  const previewMut = usePreviewGeneration()
  const finalizeMut = useFinalizeGeneration()

  const [step, setStep] = useState<StepKey>(1)
  const [templateKey, setTemplateKey] = useState<string>('amendment_valorization')
  const [contractId, setContractId] = useState<string>('')

  const [year, setYear] = useState<number>(new Date().getFullYear() + 1)
  const [indexType, setIndexType] = useState<IndexType>('GUS_CPI')
  const [indexValue, setIndexValue] = useState<string>('4.60')
  const [effectiveDate, setEffectiveDate] = useState<string>(
    `${new Date().getFullYear() + 1}-01-01`
  )

  const [tone, setTone] = useState<DocumentTone>('neutral')
  const [includeCoverLetter, setIncludeCoverLetter] = useState<boolean>(true)
  const [includeRationale, setIncludeRationale] = useState<boolean>(true)
  const [userInstructions, setUserInstructions] = useState<string>('')

  const [preview, setPreview] = useState<PreviewResponse | null>(null)
  const [previewError, setPreviewError] = useState<string | null>(null)

  const eligibleContracts = useMemo(() => {
    const filtered = contracts.filter(
      (c) =>
        c.customer_id === customer.id &&
        (c.status === 'active' || c.status === 'signed' || c.status === 'expiring')
    )
    // Valorisation amendments target the framework contract, not the SLA.
    // Sort so that contract_type='ramowa' comes first; the wizard auto-selects
    // the head of this list, which makes the default match real workflow.
    const typeRank = (type: string) =>
      type === 'ramowa' ? 0 : type === 'aneks' ? 1 : 2
    return [...filtered].sort(
      (a, b) => typeRank(a.contract_type) - typeRank(b.contract_type)
    )
  }, [contracts, customer.id])

  useEffect(() => {
    if (!isOpen) return
    setStep(1)
    setTemplateKey('amendment_valorization')
    setContractId(eligibleContracts[0]?.id ?? '')
    setPreview(null)
    setPreviewError(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, customer.id])

  // Fill in contract once contracts arrive (avoids race with first render).
  useEffect(() => {
    if (!isOpen) return
    if (contractId) return
    const fallback = eligibleContracts[0]?.id
    if (fallback) setContractId(fallback)
  }, [isOpen, contractId, eligibleContracts])

  const buildRequest = (): GenerationRequest => ({
    template_key: templateKey,
    customer_id: customer.id,
    contract_id: contractId,
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
  })

  // Auto-fetch preview when entering step 3 or whenever core params change.
  // Tone, AI checkboxes and instructions are irrelevant for the preview render
  // (they only affect finalize), so we leave them out of dependencies.
  useEffect(() => {
    if (!isOpen || step < 3 || !contractId) return
    setPreviewError(null)
    const controller = setTimeout(() => {
      previewMut.mutate(buildRequest(), {
        onSuccess: (data) => setPreview(data),
        onError: () => setPreviewError('Nie udało się wygenerować podglądu.'),
      })
    }, 600)
    return () => clearTimeout(controller)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, isOpen, contractId, year, indexType, indexValue, effectiveDate])

  async function handleFinalize() {
    if (!user?.id) {
      alert('Brak zalogowanego użytkownika.')
      return
    }
    try {
      const created = await finalizeMut.mutateAsync({
        request: buildRequest(),
        generated_by: user.id,
      })
      onFinalized(created.id)
      onClose()
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Nieznany błąd'
      alert(`Nie udało się sfinalizować dokumentu.\n\n${msg}`)
    }
  }

  const canGoNext = (): boolean => {
    if (step === 1) return !!templateKey
    if (step === 2) return !!contractId
    if (step === 3) return !!preview && !previewMut.isPending
    return true
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="✦ Generator dokumentów" maxWidth={920}>
      <Stepper current={step} />

      <div style={{ minHeight: 360, marginTop: 18 }}>
        {step === 1 && (
          <Step1 templates={templates} value={templateKey} onChange={setTemplateKey} />
        )}

        {step === 2 && (
          <Step2
            contracts={eligibleContracts}
            value={contractId}
            onChange={setContractId}
            customer={customer}
          />
        )}

        {step === 3 && (
          <Step3
            year={year}
            onYear={setYear}
            indexType={indexType}
            onIndexType={setIndexType}
            indexValue={indexValue}
            onIndexValue={setIndexValue}
            effectiveDate={effectiveDate}
            onEffectiveDate={setEffectiveDate}
            tone={tone}
            onTone={setTone}
            includeCoverLetter={includeCoverLetter}
            onIncludeCoverLetter={setIncludeCoverLetter}
            includeRationale={includeRationale}
            onIncludeRationale={setIncludeRationale}
            userInstructions={userInstructions}
            onUserInstructions={setUserInstructions}
            preview={preview}
            isPreviewing={previewMut.isPending}
            previewError={previewError}
          />
        )}

        {step === 4 && (
          <Step4 preview={preview} customerName={customer.company_name || customer.ckk} />
        )}
      </div>

      <Footer
        step={step}
        onClose={onClose}
        onBack={() => setStep((s) => (s > 1 ? ((s - 1) as StepKey) : s))}
        onNext={() => setStep((s) => (s < 4 ? ((s + 1) as StepKey) : s))}
        onFinalize={handleFinalize}
        canGoNext={canGoNext()}
        isFinalizing={finalizeMut.isPending}
      />
    </Modal>
  )
}

// ── Stepper ──────────────────────────────────────────────────────────────────

function Stepper({ current }: { current: StepKey }) {
  const steps: Array<{ n: StepKey; label: string }> = [
    { n: 1, label: 'Co generujemy?' },
    { n: 2, label: 'Z jakiej umowy?' },
    { n: 3, label: 'Parametry i symulacja' },
    { n: 4, label: 'Akceptacja' },
  ]
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      {steps.map((s, i) => {
        const active = current === s.n
        const done = current > s.n
        return (
          <div key={s.n} style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
            <div
              style={{
                width: 26,
                height: 26,
                borderRadius: '50%',
                background: done || active ? colors.orange : '#f0eeeb',
                color: done || active ? 'white' : colors.textMuted,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 12,
                fontWeight: 800,
                flexShrink: 0,
              }}
            >
              {done ? '✓' : s.n}
            </div>
            <span
              style={{
                fontSize: 12,
                fontWeight: active ? 700 : 500,
                marginLeft: 8,
                color: active ? colors.textPrimary : colors.textMuted,
                whiteSpace: 'nowrap',
              }}
            >
              {s.label}
            </span>
            {i < steps.length - 1 && (
              <div
                style={{
                  flex: 1,
                  height: 1.5,
                  background: done ? colors.orange : colors.border,
                  margin: '0 10px',
                }}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── Step 1: pick template ────────────────────────────────────────────────────

interface Step1Props {
  templates: ReturnType<typeof useDocumentTemplates>['data']
  value: string
  onChange: (v: string) => void
}

function Step1({ templates, value, onChange }: Step1Props) {
  const list = templates ?? []
  if (list.length === 0)
    return <p style={{ fontSize: 13, color: colors.textMuted }}>Ładowanie szablonów…</p>

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
      {list.map((t) => {
        const sel = value === t.key
        return (
          <button
            key={t.key}
            onClick={() => onChange(t.key)}
            style={{
              textAlign: 'left',
              border: `1.5px solid ${sel ? colors.orange : colors.border}`,
              background: sel ? colors.orangeLight : 'white',
              borderRadius: 12,
              padding: 16,
              cursor: 'pointer',
              fontFamily: 'inherit',
              transition: 'all 0.15s',
            }}
          >
            <div
              style={{
                fontSize: 14,
                fontWeight: 800,
                color: colors.textPrimary,
                marginBottom: 6,
              }}
            >
              {t.title}
            </div>
            <div style={{ fontSize: 12, color: colors.textSubtle, lineHeight: 1.5 }}>
              {t.description}
            </div>
            <div style={{ marginTop: 10, display: 'flex', gap: 8 }}>
              <Tag>v{t.version}</Tag>
              {t.creates_amendment && <Tag>tworzy aneks</Tag>}
            </div>
          </button>
        )
      })}
    </div>
  )
}

// ── Step 2: pick contract ────────────────────────────────────────────────────

function Step2({
  contracts,
  value,
  onChange,
  customer,
}: {
  contracts: Contract[]
  value: string
  onChange: (v: string) => void
  customer: Customer
}) {
  if (contracts.length === 0) {
    return (
      <div
        style={{
          padding: 24,
          background: colors.cardBg,
          borderRadius: 10,
          textAlign: 'center',
          color: colors.textMuted,
          fontSize: 13,
        }}
      >
        Klient {customer.company_name ?? customer.ckk} nie ma żadnych aktywnych umów.
        <br />
        Dodaj umowę, aby wygenerować aneks.
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {contracts.map((c) => {
        const sel = value === c.id
        return (
          <button
            key={c.id}
            onClick={() => onChange(c.id)}
            style={{
              textAlign: 'left',
              border: `1.5px solid ${sel ? colors.orange : colors.border}`,
              background: sel ? colors.orangeLight : 'white',
              borderRadius: 10,
              padding: '12px 16px',
              cursor: 'pointer',
              fontFamily: 'inherit',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: colors.textPrimary }}>
                {c.contract_number}
              </div>
              <div style={{ fontSize: 11.5, color: colors.textMuted, marginTop: 2 }}>
                {c.contract_type} · od {c.start_date} {c.end_date ? `do ${c.end_date}` : ''}
              </div>
            </div>
            <Tag>{c.status}</Tag>
          </button>
        )
      })}
    </div>
  )
}

// ── Step 3: parameters + live simulation ─────────────────────────────────────

interface Step3Props {
  year: number
  onYear: (v: number) => void
  indexType: IndexType
  onIndexType: (v: IndexType) => void
  indexValue: string
  onIndexValue: (v: string) => void
  effectiveDate: string
  onEffectiveDate: (v: string) => void
  tone: DocumentTone
  onTone: (v: DocumentTone) => void
  includeCoverLetter: boolean
  onIncludeCoverLetter: (v: boolean) => void
  includeRationale: boolean
  onIncludeRationale: (v: boolean) => void
  userInstructions: string
  onUserInstructions: (v: string) => void
  preview: PreviewResponse | null
  isPreviewing: boolean
  previewError: string | null
}

function Step3(p: Step3Props) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 16 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Field label="Rok waloryzacji">
          <input
            type="number"
            value={p.year}
            onChange={(e) => p.onYear(Number(e.target.value))}
            style={inputStyle}
          />
        </Field>

        <Field label="Typ indeksacji">
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {INDEX_VALUES.map((it) => {
              const sel = p.indexType === it
              return (
                <button
                  key={it}
                  onClick={() => p.onIndexType(it)}
                  style={chipStyle(sel)}
                >
                  {INDEX_TYPE_LABELS[it]}
                </button>
              )
            })}
          </div>
        </Field>

        <Field label="Wartość indeksacji (%)" hint="np. CPI 4,6 = 4.60">
          <input
            type="number"
            step="0.01"
            value={p.indexValue}
            onChange={(e) => p.onIndexValue(e.target.value)}
            style={inputStyle}
          />
        </Field>

        <Field label="Data wejścia w życie">
          <input
            type="date"
            value={p.effectiveDate}
            onChange={(e) => p.onEffectiveDate(e.target.value)}
            style={inputStyle}
          />
        </Field>

        <Field label="Tonacja">
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {TONE_VALUES.map((t) => {
              const sel = p.tone === t
              return (
                <button key={t} onClick={() => p.onTone(t)} style={chipStyle(sel)}>
                  {TONE_LABELS[t]}
                </button>
              )
            })}
          </div>
          <div style={{ fontSize: 11, color: colors.textMuted, marginTop: 6, lineHeight: 1.5 }}>
            {TONE_DESCRIPTIONS[p.tone]}
          </div>
        </Field>

        <Field label="Dodatki AI" hint="Generowane przy finalizacji (krok 4), nie podczas podglądu.">
          <label style={checkboxLabelStyle}>
            <input
              type="checkbox"
              checked={p.includeRationale}
              onChange={(e) => p.onIncludeRationale(e.target.checked)}
            />
            Uzasadnienie biznesowe
          </label>
          <label style={checkboxLabelStyle}>
            <input
              type="checkbox"
              checked={p.includeCoverLetter}
              onChange={(e) => p.onIncludeCoverLetter(e.target.checked)}
            />
            Pismo przewodnie
          </label>
        </Field>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <Field label="Dodatkowe wytyczne (opcjonalne)" hint="LLM użyje tego do narracji. Nie wpływa na liczby ani klauzule.">
          <textarea
            value={p.userInstructions}
            onChange={(e) => p.onUserInstructions(e.target.value)}
            maxLength={2000}
            placeholder="np. Podkreśl wieloletnią współpracę i wspomnij o nowych usługach z 2025."
            style={{ ...inputStyle, height: 76, resize: 'vertical', fontFamily: 'inherit' }}
          />
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
            {QUICK_HINTS.map((h) => (
              <button
                key={h.label}
                onClick={() =>
                  p.onUserInstructions(
                    p.userInstructions
                      ? `${p.userInstructions}\n${h.text}`
                      : h.text
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

        <div>
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: colors.textMuted,
              textTransform: 'uppercase',
              letterSpacing: 0.4,
              marginBottom: 6,
            }}
          >
            Symulacja finansowa (live)
          </div>
          {p.isPreviewing && !p.preview && (
            <div
              style={{
                padding: 18,
                background: colors.cardBg,
                borderRadius: 10,
                fontSize: 12.5,
                color: colors.textMuted,
              }}
            >
              Liczę…
            </div>
          )}
          {p.previewError && (
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
              {p.previewError}
            </div>
          )}
          {p.preview && <SimulationPanel simulation={p.preview.simulation} />}
        </div>
      </div>
    </div>
  )
}

// ── Step 4: review + accept ──────────────────────────────────────────────────

function Step4({ preview, customerName }: { preview: PreviewResponse | null; customerName: string }) {
  if (!preview) {
    return (
      <p style={{ fontSize: 13, color: colors.textMuted }}>
        Brak podglądu — wróć do kroku 3, aby wygenerować symulację.
      </p>
    )
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
      <div>
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: colors.textMuted,
            textTransform: 'uppercase',
            letterSpacing: 0.4,
            marginBottom: 6,
          }}
        >
          Podgląd dokumentu
        </div>
        <iframe
          title="Podgląd aneksu"
          srcDoc={preview.rendered_html}
          style={{
            width: '100%',
            height: 460,
            border: `1px solid ${colors.border}`,
            borderRadius: 10,
            background: 'white',
          }}
        />
        <div style={{ fontSize: 11, color: colors.textMuted, marginTop: 6 }}>
          Szablon {preview.template_key} v{preview.template_version} · oznaczony jako{' '}
          <strong style={{ color: colors.draftText }}>DRAFT</strong> do akceptacji.
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {preview.rationale_bullets.length > 0 && (
          <div
            style={{
              background: '#faf5ff',
              border: '1px solid #e9d8fd',
              borderRadius: 10,
              padding: 14,
            }}
          >
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: '#553c9a',
                textTransform: 'uppercase',
                marginBottom: 6,
              }}
            >
              ✦ Uzasadnienie biznesowe (AI)
            </div>
            <ul style={{ margin: 0, paddingLeft: 16, fontSize: 12.5, lineHeight: 1.6 }}>
              {preview.rationale_bullets.map((b, i) => (
                <li key={i} style={{ marginBottom: 4, color: '#3b2f6e' }}>
                  {b}
                </li>
              ))}
            </ul>
          </div>
        )}

        {preview.cover_letter_text && (
          <div
            style={{
              background: '#fff8f4',
              border: `1px solid ${colors.draftBorder}`,
              borderRadius: 10,
              padding: 14,
            }}
          >
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: colors.draftText,
                textTransform: 'uppercase',
                marginBottom: 6,
              }}
            >
              ✦ Pismo przewodnie (AI)
            </div>
            <div
              style={{
                fontSize: 12.5,
                lineHeight: 1.65,
                whiteSpace: 'pre-wrap',
                color: '#5b3a1d',
              }}
            >
              {preview.cover_letter_text}
            </div>
          </div>
        )}

        <div
          style={{
            background: colors.cardBg,
            border: `1px solid ${colors.border}`,
            borderRadius: 10,
            padding: 14,
          }}
        >
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: colors.textMuted,
              textTransform: 'uppercase',
              marginBottom: 6,
            }}
          >
            Podsumowanie
          </div>
          <div style={{ fontSize: 12.5, lineHeight: 1.6, color: colors.textSubtle }}>
            Klient: <strong>{customerName}</strong>
            <br />
            Po finalizacji powstanie PDF z naniesionym znakiem wodnym DRAFT. Dopiero{' '}
            <strong>akceptacja w zakładce Dokumenty</strong> usunie znak wodny i zwolni
            dokument do dalszej dystrybucji.
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Footer ───────────────────────────────────────────────────────────────────

function Footer({
  step,
  onClose,
  onBack,
  onNext,
  onFinalize,
  canGoNext,
  isFinalizing,
}: {
  step: StepKey
  onClose: () => void
  onBack: () => void
  onNext: () => void
  onFinalize: () => void
  canGoNext: boolean
  isFinalizing: boolean
}) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'flex-end',
        gap: 10,
        marginTop: 18,
        paddingTop: 14,
        borderTop: `1px solid ${colors.borderSoft}`,
      }}
    >
      <button onClick={onClose} style={btnSecondary}>
        Anuluj
      </button>
      {step > 1 && (
        <button onClick={onBack} style={btnSecondary}>
          Wstecz
        </button>
      )}
      {step < 4 ? (
        <button
          onClick={onNext}
          disabled={!canGoNext}
          style={{ ...btnPrimary, opacity: canGoNext ? 1 : 0.5 }}
        >
          Dalej
        </button>
      ) : (
        <button
          onClick={onFinalize}
          disabled={isFinalizing || !canGoNext}
          style={{ ...btnPrimary, opacity: isFinalizing ? 0.6 : 1 }}
        >
          {isFinalizing ? 'Generowanie PDF…' : 'Wygeneruj DRAFT'}
        </button>
      )}
    </div>
  )
}

// ── Small primitives ─────────────────────────────────────────────────────────

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

function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span
      style={{
        background: colors.cardBg,
        color: colors.textSubtle,
        fontSize: 10,
        padding: '2px 7px',
        borderRadius: 999,
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: 0.3,
        border: `1px solid ${colors.border}`,
      }}
    >
      {children}
    </span>
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

const checkboxLabelStyle: React.CSSProperties = {
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
