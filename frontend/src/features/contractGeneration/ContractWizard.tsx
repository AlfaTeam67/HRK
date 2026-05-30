import { useEffect, useMemo, useRef, useState } from 'react'

import { Modal } from '@/components/ui/modal'
import { useCustomers } from '@/hooks/customers'
import type { BillingCycle, Customer } from '@/types/models'

import {
  BILLING_LABELS,
  CONTRACT_TYPE_DESCRIPTIONS,
  CONTRACT_TYPE_ICONS,
  CONTRACT_TYPE_LABELS,
  MOCK_SERVICES,
  generateContractNumber,
  generateMockPreamble,
} from './types'

interface ContractWizardResult {
  customer_id: string
  contract_number: string
  contract_type: string
  start_date: string
  end_date: string | null
  billing_cycle: string | null
}

interface Props {
  isOpen: boolean
  onClose: () => void
  onGenerated?: (result: ContractWizardResult) => void
}

type StepKey = 1 | 2 | 3 | 4

const CONTRACT_TYPES = ['ramowa', 'SLA', 'DPA', 'PPK', 'inne'] as const

interface ServiceEntry {
  id: string
  name: string
  included: boolean
  price: number
}

export function ContractWizard({ isOpen, onClose, onGenerated }: Props) {
  const { data: customers = [] } = useCustomers()

  const [step, setStep] = useState<StepKey>(1)
  const [type, setType] = useState<string>('ramowa')
  const [clientId, setClientId] = useState<string>('')
  const [contractNumber, setContractNumber] = useState<string>('')
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0])
  const [endDate, setEndDate] = useState('')
  const [billingCycle, setBillingCycle] = useState<BillingCycle>('monthly')
  const [services, setServices] = useState<ServiceEntry[]>(
    MOCK_SERVICES.map((s) => ({ id: s.id, name: s.name, included: true, price: s.basePrice })),
  )
  const [preamble, setPreamble] = useState('')
  const [notes, setNotes] = useState('')
  const [generated, setGenerated] = useState(false)

  const selectedClient = useMemo(
    () => customers.find((c) => c.id === clientId) ?? null,
    [customers, clientId],
  )

  const hasInited = useRef(false)

  useEffect(() => {
    if (!isOpen) {
      hasInited.current = false
      return
    }
    if (hasInited.current || customers.length === 0) return
    hasInited.current = true

    const first = customers[0]
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setStep(1)
    setType('ramowa')
    setClientId(first.id)
    setContractNumber(generateContractNumber(first.ckk, new Date().getFullYear()))
    setStartDate(new Date().toISOString().split('T')[0])
    setEndDate('')
    setBillingCycle('monthly')
    setServices(MOCK_SERVICES.map((s) => ({ id: s.id, name: s.name, included: true, price: s.basePrice })))
    setPreamble('')
    setNotes('')
    setGenerated(false)
  }, [isOpen, customers])

  function handleClientChange(id: string) {
    setClientId(id)
    const c = customers.find((c) => c.id === id)
    if (c) setContractNumber(generateContractNumber(c.ckk, new Date().getFullYear()))
  }

  function updateServicePrice(id: string, price: number) {
    setServices((prev) => prev.map((s) => (s.id === id ? { ...s, price } : s)))
  }

  function toggleService(id: string) {
    setServices((prev) => prev.map((s) => (s.id === id ? { ...s, included: !s.included } : s)))
  }

  const activeServices = useMemo(() => services.filter((s) => s.included), [services])
  const totalMonthly = useMemo(
    () => activeServices.reduce((sum, s) => sum + s.price, 0),
    [activeServices],
  )

  function handleGeneratePreamble() {
    if (!selectedClient) return
    const text = generateMockPreamble(
      type,
      selectedClient.company_name ?? selectedClient.ckk,
      selectedClient.billing_nip,
      activeServices.map((s) => ({ name: s.name, price: s.price })),
      startDate,
      billingCycle,
    )
    setPreamble(text)
  }

  function handleGenerateContract() {
    setGenerated(true)
    onGenerated?.({
      customer_id: clientId,
      contract_number: contractNumber,
      contract_type: type,
      start_date: startDate,
      end_date: endDate || null,
      billing_cycle: billingCycle,
    })
  }

  const hasClient = !!selectedClient
  const canGoNext = (): boolean => {
    if (step === 1) return !!type
    if (step === 2) return hasClient && !!contractNumber && !!startDate
    if (step === 3) return activeServices.length > 0
    return true
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="✦ Generator umów"
      maxWidth={960}
    >
      <Stepper current={step} />

      <div style={{ minHeight: 400, marginTop: 18 }}>
        {step === 1 && <Step1 value={type} onChange={setType} />}
        {step === 2 && (
          <Step2
            customers={customers}
            clientId={clientId}
            onClientChange={handleClientChange}
            contractNumber={contractNumber}
            onContractNumber={setContractNumber}
            startDate={startDate}
            onStartDate={setStartDate}
            endDate={endDate}
            onEndDate={setEndDate}
            billingCycle={billingCycle}
            onBillingCycle={setBillingCycle}
            contractType={type}
          />
        )}
        {step === 3 && (
          <Step3
            services={services}
            onToggle={toggleService}
            onPriceChange={updateServicePrice}
            totalMonthly={totalMonthly}
          />
        )}
        {step === 4 && (
          <Step4
            preamble={preamble}
            onPreamble={setPreamble}
            notes={notes}
            onNotes={setNotes}
            selectedClient={selectedClient}
            contractNumber={contractNumber}
            type={type}
            generated={generated}
          />
        )}
      </div>

      <Footer
        step={step}
        onClose={onClose}
        onBack={() => setStep((s) => (s > 1 ? ((s - 1) as StepKey) : s))}
        onNext={() => setStep((s) => (s < 4 ? ((s + 1) as StepKey) : s))}
        onFinalize={handleGenerateContract}
        canGoNext={canGoNext()}
        generated={generated}
        hasPreamble={preamble.length > 0}
        onGeneratePreamble={handleGeneratePreamble}
      />
    </Modal>
  )
}

// ── Stepper ──────────────────────────────────────────────────────────────────

function Stepper({ current }: { current: StepKey }) {
  const steps: Array<{ n: StepKey; label: string }> = [
    { n: 1, label: 'Jaki typ umowy?' },
    { n: 2, label: 'Dane umowy' },
    { n: 3, label: 'Usługi i stawki' },
    { n: 4, label: 'Podgląd' },
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
                background: done || active ? '#e85c04' : '#f0eeeb',
                color: done || active ? 'white' : '#7a6f67',
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
                color: active ? '#1a1714' : '#7a6f67',
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
                  background: done ? '#e85c04' : '#e3e0db',
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

// ── Step 1: pick contract type ───────────────────────────────────────────────

function Step1({
  value,
  onChange,
}: {
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
      {CONTRACT_TYPES.map((t) => {
        const sel = value === t
        return (
          <button
            key={t}
            onClick={() => onChange(t)}
            style={{
              textAlign: 'left',
              border: `1.5px solid ${sel ? '#e85c04' : '#e3e0db'}`,
              background: sel ? '#fff5f0' : 'white',
              borderRadius: 12,
              padding: 16,
              cursor: 'pointer',
              fontFamily: 'inherit',
              transition: 'all 0.15s',
            }}
          >
            <div style={{ fontSize: 24, marginBottom: 8 }}>
              {CONTRACT_TYPE_ICONS[t]}
            </div>
            <div
              style={{
                fontSize: 14,
                fontWeight: 800,
                color: '#1a1714',
                marginBottom: 6,
              }}
            >
              {CONTRACT_TYPE_LABELS[t]}
            </div>
            <div style={{ fontSize: 12, color: '#7a6f67', lineHeight: 1.5 }}>
              {CONTRACT_TYPE_DESCRIPTIONS[t]}
            </div>
          </button>
        )
      })}
    </div>
  )
}

// ── Step 2: basic contract info ──────────────────────────────────────────────

function Step2({
  customers,
  clientId,
  onClientChange,
  contractNumber,
  onContractNumber,
  startDate,
  onStartDate,
  endDate,
  onEndDate,
  billingCycle,
  onBillingCycle,
  contractType,
}: {
  customers: Customer[]
  clientId: string
  onClientChange: (v: string) => void
  contractNumber: string
  onContractNumber: (v: string) => void
  startDate: string
  onStartDate: (v: string) => void
  endDate: string
  onEndDate: (v: string) => void
  billingCycle: BillingCycle
  onBillingCycle: (v: BillingCycle) => void
  contractType: string
}) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
      <Field label="Klient">
        <select
          value={clientId}
          onChange={(e) => onClientChange(e.target.value)}
          style={inputStyle}
        >
          <option value="">Wybierz klienta...</option>
          {customers.map((c) => (
            <option key={c.id} value={c.id}>
              {c.company_name || c.ckk}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Numer umowy" hint="Automatyczny, możesz edytować">
        <input
          type="text"
          value={contractNumber}
          onChange={(e) => onContractNumber(e.target.value)}
          style={inputStyle}
        />
      </Field>

      <Field label="Typ umowy">
        <div
          style={{
            padding: '8px 10px',
            borderRadius: 8,
            border: '1px solid #e3e0db',
            fontSize: 13,
            background: '#fafaf9',
            color: '#1a1714',
          }}
        >
          {CONTRACT_TYPE_LABELS[contractType] ?? contractType}
        </div>
      </Field>

      <Field label="Cykl rozliczeniowy">
        <select
          value={billingCycle}
          onChange={(e) => onBillingCycle(e.target.value as BillingCycle)}
          style={inputStyle}
        >
          {Object.entries(BILLING_LABELS).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Data rozpoczęcia">
        <input
          type="date"
          value={startDate}
          onChange={(e) => onStartDate(e.target.value)}
          style={inputStyle}
        />
      </Field>

      <Field label="Data zakończenia" hint="Opcjonalna">
        <input
          type="date"
          value={endDate}
          onChange={(e) => onEndDate(e.target.value)}
          style={inputStyle}
        />
      </Field>
    </div>
  )
}

// ── Step 3: services & pricing ───────────────────────────────────────────────

function Step3({
  services,
  onToggle,
  onPriceChange,
  totalMonthly,
}: {
  services: ServiceEntry[]
  onToggle: (id: string) => void
  onPriceChange: (id: string, price: number) => void
  totalMonthly: number
}) {
  return (
    <div>
      <div
        style={{
          fontSize: 11,
          fontWeight: 700,
          color: '#7a6f67',
          textTransform: 'uppercase',
          letterSpacing: 0.4,
          marginBottom: 10,
        }}
      >
        Definiuj usługi i miesięczne stawki
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {services.map((svc) => (
          <div
            key={svc.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '10px 14px',
              borderRadius: 10,
              border: `1px solid ${svc.included ? '#e3e0db' : '#f0eeeb'}`,
              background: svc.included ? 'white' : '#fafaf9',
              opacity: svc.included ? 1 : 0.55,
              transition: 'all 0.15s',
            }}
          >
            <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={svc.included}
                onChange={() => onToggle(svc.id)}
                style={{ width: 16, height: 16, cursor: 'pointer' }}
              />
            </label>
            <div style={{ flex: 1, fontSize: 13.5, fontWeight: 700, color: '#1a1714' }}>
              {svc.name}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <input
                type="number"
                value={svc.price}
                onChange={(e) => onPriceChange(svc.id, Number(e.target.value))}
                disabled={!svc.included}
                style={{
                  width: 110,
                  border: `1px solid ${svc.included ? '#e3e0db' : '#f0eeeb'}`,
                  borderRadius: 6,
                  padding: '6px 8px',
                  fontSize: 13,
                  fontWeight: 600,
                  textAlign: 'right',
                  outline: 'none',
                  fontFamily: 'inherit',
                  background: svc.included ? 'white' : '#f5f4f2',
                }}
              />
              <span style={{ fontSize: 12, color: '#7a6f67', minWidth: 30 }}>
                PLN/mc
              </span>
            </div>
            <div
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: '#276749',
                minWidth: 100,
                textAlign: 'right',
              }}
            >
              {(svc.price * 12).toLocaleString('pl-PL')} PLN/rok
            </div>
          </div>
        ))}
      </div>

      <div
        style={{
          marginTop: 14,
          padding: '14px 18px',
          background: '#f0fff4',
          borderRadius: 10,
          border: '1px solid #c6f6d5',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#276749', textTransform: 'uppercase' }}>
            Suma miesięczna
          </div>
          <div style={{ fontSize: 11, color: '#276749', marginTop: 2 }}>
            {services.filter((s) => s.included).length} usług aktywnych
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#276749' }}>
            {totalMonthly.toLocaleString('pl-PL')} PLN
          </div>
          <div style={{ fontSize: 12, color: '#276749' }}>
            {(totalMonthly * 12).toLocaleString('pl-PL')} PLN / rok
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Step 4: preview & generate ───────────────────────────────────────────────

function Step4({
  preamble,
  onPreamble,
  notes,
  onNotes,
  selectedClient,
  contractNumber,
  type,
  generated,
}: {
  preamble: string
  onPreamble: (v: string) => void
  notes: string
  onNotes: (v: string) => void
  selectedClient: Customer | null
  contractNumber: string
  type: string
  generated: boolean
}) {
  const needsGenerate = preamble.length === 0

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
      <div>
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: '#7a6f67',
            textTransform: 'uppercase',
            letterSpacing: 0.4,
            marginBottom: 6,
          }}
        >
          Treść umowy
        </div>

        {needsGenerate && !generated && (
          <div
            style={{
              padding: 16,
              background: '#fafaf9',
              borderRadius: 10,
              border: '1px solid #e3e0db',
              marginBottom: 12,
              fontSize: 13,
              color: '#7a6f67',
              lineHeight: 1.6,
            }}
          >
            Kliknij <strong>"Generuj treść"</strong> poniżej, aby utworzyć mock treści umowy
            na podstawie wprowadzonych danych. Możesz ją potem dowolnie edytować.
          </div>
        )}

        {generated && (
          <div
            style={{
              padding: 14,
              background: '#f0fff4',
              borderRadius: 10,
              border: '1px solid #c6f6d5',
              marginBottom: 12,
              fontSize: 13,
              color: '#276749',
              fontWeight: 600,
            }}
          >
            ✓ Umowa wygenerowana pomyślnie! Możesz edytować treść poniżej.
          </div>
        )}

        <textarea
          value={preamble}
          onChange={(e) => onPreamble(e.target.value)}
          rows={12}
          style={{
            width: '100%',
            border: '1px solid #e3e0db',
            borderRadius: 8,
            padding: 12,
            fontSize: 12,
            fontFamily: 'monospace',
            lineHeight: 1.65,
            outline: 'none',
            resize: 'vertical',
            boxSizing: 'border-box',
            background: preamble ? 'white' : '#fafaf9',
          }}
          placeholder={needsGenerate ? 'Kliknij "Generuj treść", aby utworzyć mock umowy...' : ''}
        />

        <div
          style={{
            fontSize: 11,
            color: '#7a6f67',
            marginTop: 6,
            display: 'flex',
            justifyContent: 'space-between',
          }}
        >
          <span>{preamble.length} znaków</span>
          <span>Edytowalne — zmień treść przed zapisem</span>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: '#7a6f67',
            textTransform: 'uppercase',
            letterSpacing: 0.4,
            marginBottom: 2,
          }}
        >
          Notatka pracownika
        </div>
        <textarea
          value={notes}
          onChange={(e) => onNotes(e.target.value)}
          rows={4}
          placeholder="np. Umowa negocjowana przez opiekuna klienta..."
          style={{
            width: '100%',
            border: '1px solid #e3e0db',
            borderRadius: 8,
            padding: 10,
            fontSize: 13,
            fontFamily: 'inherit',
            lineHeight: 1.5,
            outline: 'none',
            resize: 'vertical',
            boxSizing: 'border-box',
          }}
        />

        {!generated && !needsGenerate && (
          <div
            style={{
              padding: 14,
              background: '#fafaf9',
              borderRadius: 10,
              border: '1px solid #e3e0db',
            }}
          >
            <div style={{ fontSize: 11, fontWeight: 700, color: '#7a6f67', textTransform: 'uppercase', marginBottom: 6 }}>
              Podsumowanie
            </div>
            <div style={{ fontSize: 12.5, lineHeight: 1.6, color: '#1a1714' }}>
              Klient: <strong>{selectedClient?.company_name || selectedClient?.ckk || '—'}</strong>
              <br />
              Umowa: <strong>{contractNumber || '—'}</strong>
              <br />
              Typ: <strong>{type}</strong>
              <br />
              Kliknij <strong>"Generuj umowę"</strong>, aby sfinalizować.
            </div>
          </div>
        )}

        {generated && (
          <div
            style={{
              padding: 14,
              background: '#f0fff4',
              borderRadius: 10,
              border: '1px solid #c6f6d5',
            }}
          >
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: '#276749',
                textTransform: 'uppercase',
                marginBottom: 6,
              }}
            >
              ✓ Umowa gotowa
            </div>
            <div style={{ fontSize: 12.5, lineHeight: 1.6, color: '#1a1714' }}>
              Umowa <strong>{contractNumber}</strong> została wygenerowana.
              <br />
              Możesz edytować treść powyżej lub zamknąć okno.
            </div>
          </div>
        )}
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
  generated,
  hasPreamble,
  onGeneratePreamble,
}: {
  step: StepKey
  onClose: () => void
  onBack: () => void
  onNext: () => void
  onFinalize: () => void
  canGoNext: boolean
  generated: boolean
  hasPreamble: boolean
  onGeneratePreamble: () => void
}) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'flex-end',
        gap: 10,
        marginTop: 18,
        paddingTop: 14,
        borderTop: '1px solid #f2f0ed',
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
      {step === 4 && !hasPreamble && !generated && (
        <button
          onClick={onGeneratePreamble}
          style={{ ...btnPrimary, background: '#6b6361' }}
        >
          Generuj treść
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
          disabled={generated || !hasPreamble}
          style={{ ...btnPrimary, opacity: generated || !hasPreamble ? 0.5 : 1 }}
        >
          {generated ? 'Wygenerowano ✓' : 'Generuj umowę'}
        </button>
      )}
    </div>
  )
}

// ── Primitives ───────────────────────────────────────────────────────────────

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
          color: '#7a6f67',
          textTransform: 'uppercase',
          letterSpacing: 0.4,
          marginBottom: 5,
        }}
      >
        {label}
      </div>
      {children}
      {hint && (
        <div style={{ fontSize: 11, color: '#7a6f67', marginTop: 4, lineHeight: 1.5 }}>
          {hint}
        </div>
      )}
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  border: '1px solid #e3e0db',
  borderRadius: 8,
  padding: '8px 10px',
  fontSize: 13,
  outline: 'none',
  fontFamily: 'inherit',
  boxSizing: 'border-box',
  background: 'white',
}

const btnPrimary: React.CSSProperties = {
  background: '#e85c04',
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
  color: '#1a1714',
  border: '1px solid #e3e0db',
  borderRadius: 8,
  padding: '8px 16px',
  fontSize: 13,
  fontWeight: 600,
  cursor: 'pointer',
  fontFamily: 'inherit',
}
