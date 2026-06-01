import { type CSSProperties, useCallback, useMemo, useState } from 'react'

import { Modal } from '@/components/ui/modal'
import { DocumentWizard } from '@/features/documentGeneration/DocumentWizard'
import { useContracts } from '@/hooks/contracts'
import { useCustomers } from '@/hooks/customers'
import { useGusCpi } from '@/hooks/gus'
import { useAppSelector } from '@/hooks/store'
import {
  type ValorizationAutoResponse,
  type ValorizationsFilters,
  useCreateValorization,
  useDeleteValorization,
  useGenerateValorizations,
  useUpdateValorization,
  useValorizations,
} from '@/hooks/valorizations'
import { cardStyle as card } from '@/lib/styles'
import type {
  Customer,
  IndexType,
  Valorization,
  ValorizationCreate,
  ValorizationStatus,
  ValorizationUpdate,
} from '@/types/models'

const STATUS_LABELS: Record<ValorizationStatus, string> = {
  pending: 'Wymaga decyzji',
  approved: 'Zaakceptowana',
  applied: 'Zastosowana',
  rejected: 'Odrzucona',
}

const STATUS_STYLES: Record<ValorizationStatus, { bg: string; color: string }> = {
  pending: { bg: '#fff5f0', color: '#c94f02' },
  approved: { bg: '#f0fff4', color: '#276749' },
  applied: { bg: '#eff6ff', color: '#1d4ed8' },
  rejected: { bg: '#fffbeb', color: '#92400e' },
}

const STATUS_COLORS: Record<ValorizationStatus, string> = {
  pending: '#e85c04',
  approved: '#38a169',
  applied: '#3182ce',
  rejected: '#d69e2e',
}

const INDEX_LABELS: Record<IndexType, string> = {
  GUS_CPI: 'CPI GUS',
  fixed_pct: 'Stały %',
  custom: 'Indywidualny',
}

const AUTO_SKIP_LABELS: Record<string, string> = {
  contract_not_found: 'Nie znaleziono umowy',
  contract_not_active: 'Umowa nieaktywna',
  missing_rule: 'Brak wybranej reguły',
  missing_index_value: 'Brak wartości indeksu',
  duplicate: 'Waloryzacja już istnieje',
  gus_unavailable: 'Brak danych GUS',
}

const inputStyle: CSSProperties = {
  padding: '8px 12px',
  borderRadius: 6,
  border: '1px solid #e3e0db',
  fontSize: 13,
  outline: 'none',
  fontFamily: 'inherit',
}

const labelStyle: CSSProperties = {
  fontSize: 12,
  fontWeight: 700,
  color: '#4a4340',
}

type FormState = {
  contract_id: string
  year: string
  index_type: IndexType
  index_value: string
  planned_date: string
  applied_date: string
  status: ValorizationStatus
  notes: string
}

type FormErrors = Partial<Record<keyof FormState, string>>

type WizardContext = {
  customer: Customer
  contractId?: string
  params?: {
    year?: number
    indexType?: IndexType
    indexValue?: number
    effectiveDate?: string
  }
}

type AutoRuleState = {
  indexType?: IndexType
  indexValue?: string
}

const formatDate = (value?: string | null) =>
  value ? new Date(`${value}T00:00:00`).toLocaleDateString('pl-PL') : '—'

const formatIndexValue = (value: string | number) => {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return '—'
  return `${parsed.toLocaleString('pl-PL', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 2,
  })}%`
}

const toInputNumber = (value: string | number) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed.toFixed(2) : ''
}

export function ValorizationPage() {
  const user = useAppSelector((s) => s.auth.user)
  const [isAlertModalOpen, setIsAlertModalOpen] = useState(false)
  const [formOpen, setFormOpen] = useState(false)
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create')
  const [editing, setEditing] = useState<Valorization | null>(null)
  const [formErrors, setFormErrors] = useState<FormErrors>({})
  const [wizardContext, setWizardContext] = useState<WizardContext | null>(null)

  const [filterStatus, setFilterStatus] = useState<ValorizationStatus | 'all'>(
    'all'
  )
  const [filterYear, setFilterYear] = useState<string>('all')
  const [filterContractId, setFilterContractId] = useState<string>('all')

  const { data: cpi, isLoading: cpiLoading } = useGusCpi()
  const { data: customers = [], isLoading: customersLoading } = useCustomers()
  const { data: contracts = [], isLoading: contractsLoading } = useContracts()

  const filters = useMemo<ValorizationsFilters | undefined>(() => {
    const next: ValorizationsFilters = {}
    if (filterContractId !== 'all') next.contract_id = filterContractId
    if (filterYear !== 'all') next.year = Number(filterYear)
    if (filterStatus !== 'all') next.status = filterStatus
    return Object.keys(next).length ? next : undefined
  }, [filterContractId, filterStatus, filterYear])

  const { data: valorizations = [], isLoading: valorizationsLoading } =
    useValorizations(filters)

  const createMutation = useCreateValorization()
  const updateMutation = useUpdateValorization()
  const deleteMutation = useDeleteValorization()
  const generateMutation = useGenerateValorizations()

  const contractsById = useMemo(
    () => new Map(contracts.map((c) => [c.id, c])),
    [contracts]
  )
  const customersById = useMemo(
    () => new Map(customers.map((c) => [c.id, c])),
    [customers]
  )

  const contractOptions = useMemo(() => {
    return contracts.map((c) => {
      const customer = customersById.get(c.customer_id)
      const customerName = customer?.company_name || customer?.ckk || '—'
      return {
        value: c.id,
        label: `${c.contract_number} · ${customerName}`,
      }
    })
  }, [contracts, customersById])

  const activeContracts = useMemo(
    () => contracts.filter((c) => c.status === 'active'),
    [contracts]
  )

  const getContractLabel = useCallback(
    (contractId: string) => {
      const contract = contractsById.get(contractId)
      if (!contract) return contractId
      const customer = customersById.get(contract.customer_id)
      const customerName = customer?.company_name || customer?.ckk || '—'
      return `${contract.contract_number} · ${customerName}`
    },
    [contractsById, customersById]
  )

  const currentYear = new Date().getFullYear()
  const defaultYear = currentYear + 1
  const defaultPlannedDate = `${defaultYear}-01-01`
  const makeEmptyForm = (): FormState => ({
    contract_id: '',
    year: String(defaultYear),
    index_type: 'GUS_CPI',
    index_value: '4.60',
    planned_date: defaultPlannedDate,
    applied_date: '',
    status: 'pending',
    notes: '',
  })

  const [form, setForm] = useState<FormState>(makeEmptyForm)
  const [autoOpen, setAutoOpen] = useState(false)
  const [autoPlannedDate, setAutoPlannedDate] = useState(defaultPlannedDate)
  const [autoSelected, setAutoSelected] = useState<Record<string, boolean>>({})
  const [autoRules, setAutoRules] = useState<Record<string, AutoRuleState>>({})
  const [autoResult, setAutoResult] = useState<ValorizationAutoResponse | null>(null)
  const [autoError, setAutoError] = useState<string | null>(null)

  const today = useMemo(() => {
    const value = new Date()
    value.setHours(0, 0, 0, 0)
    return value
  }, [])

  const isOverdue = useCallback((value?: string | null, status?: ValorizationStatus) => {
    if (!value || status !== 'pending') return false
    return new Date(`${value}T00:00:00`) < today
  }, [today])

  const statusCounts = useMemo(() => {
    return valorizations.reduce(
      (acc, v) => {
        acc[v.status] += 1
        return acc
      },
      { pending: 0, approved: 0, applied: 0, rejected: 0 }
    )
  }, [valorizations])

  const overdueCount = useMemo(
    () => valorizations.filter((v) => isOverdue(v.planned_date, v.status)).length,
    [valorizations, isOverdue]
  )
  const plannedCount = useMemo(
    () =>
      valorizations.filter(
        (v) => v.status === 'pending' && !isOverdue(v.planned_date, v.status)
      ).length,
    [valorizations, isOverdue]
  )

  const cpiDisplay = cpiLoading
    ? '…'
    : cpi
      ? `${cpi.value.toLocaleString('pl-PL', { minimumFractionDigits: 1 })}%`
      : '—'
  const cpiSub = cpi ? `CPI Q${cpi.quarter} ${cpi.year}` : 'CPI GUS'
  const cpiUpdated = cpi
    ? new Date(cpi.fetched_at).toLocaleString('pl-PL', {
        dateStyle: 'short',
        timeStyle: 'short',
      })
    : null

  const kpis = [
    {
      label: 'WALORYZACJE DO ZROBIENIA',
      value: statusCounts.pending.toString(),
      sub: 'Wymagają decyzji',
      color: STATUS_COLORS.pending,
    },
    {
      label: 'PRZETERMINOWANE',
      value: overdueCount.toString(),
      sub: 'Wymagana eskalacja',
      color: STATUS_COLORS.rejected,
    },
    {
      label: 'ZAPLANOWANE',
      value: plannedCount.toString(),
      sub: 'W harmonogramie',
      color: STATUS_COLORS.approved,
    },
    {
      label: 'AKTUALNY WSKAŹNIK GUS',
      value: cpiDisplay,
      sub: cpiSub,
      color: STATUS_COLORS.applied,
    },
  ]

  const pipeline = [
    {
      stage: 'Oczekujące',
      count: statusCounts.pending,
      value: 'waloryzacji',
      color: STATUS_COLORS.pending,
    },
    {
      stage: 'Zaakceptowane',
      count: statusCounts.approved,
      value: 'waloryzacji',
      color: STATUS_COLORS.approved,
    },
    {
      stage: 'Zastosowane',
      count: statusCounts.applied,
      value: 'waloryzacji',
      color: STATUS_COLORS.applied,
    },
    {
      stage: 'Odrzucone',
      count: statusCounts.rejected,
      value: 'waloryzacji',
      color: STATUS_COLORS.rejected,
    },
  ]

  const updateField = <K extends keyof FormState>(field: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [field]: value }))
    setFormErrors((prev) => ({ ...prev, [field]: undefined }))
  }

  const openCreateModal = () => {
    setFormMode('create')
    setEditing(null)
    setForm(makeEmptyForm())
    setFormErrors({})
    setFormOpen(true)
  }

  const openEditModal = (value: Valorization) => {
    setFormMode('edit')
    setEditing(value)
    setForm({
      contract_id: value.contract_id,
      year: String(value.year),
      index_type: value.index_type,
      index_value: toInputNumber(value.index_value),
      planned_date: value.planned_date ?? '',
      applied_date: value.applied_date ?? '',
      status: value.status,
      notes: value.notes ?? '',
    })
    setFormErrors({})
    setFormOpen(true)
  }

  const openWizardForValorization = (value: Valorization) => {
    const contract = contractsById.get(value.contract_id)
    const customer = contract ? customersById.get(contract.customer_id) : undefined
    if (!contract || !customer) return
    const parsedIndexValue = Number(value.index_value)
    setWizardContext({
      customer,
      contractId: contract.id,
      params: {
        year: value.year,
        indexType: value.index_type,
        indexValue: Number.isFinite(parsedIndexValue) ? parsedIndexValue : undefined,
        effectiveDate: value.planned_date ?? undefined,
      },
    })
  }

  const validateForm = (value: FormState): FormErrors => {
    const errors: FormErrors = {}
    if (!value.contract_id) errors.contract_id = 'Wybierz umowę.'
    if (!value.year || Number(value.year) < 2000) errors.year = 'Podaj poprawny rok.'
    if (!value.index_value || !Number.isFinite(Number(value.index_value))) {
      errors.index_value = 'Podaj wartość indeksu.'
    }
    if (!value.planned_date) errors.planned_date = 'Wskaż datę planowaną.'
    if (value.status === 'applied' && !value.applied_date) {
      errors.applied_date = 'Wskaż datę zastosowania.'
    }
    return errors
  }

  const buildCreatePayload = (value: FormState): ValorizationCreate => {
    const notes = value.notes.trim()
    const payload: ValorizationCreate = {
      contract_id: value.contract_id,
      year: Number(value.year),
      index_type: value.index_type,
      index_value: Number(value.index_value),
      planned_date: value.planned_date,
      applied_date: value.applied_date || null,
      status: value.status,
      notes: notes || null,
    }
    if ((value.status === 'approved' || value.status === 'applied') && user?.id) {
      payload.approved_by = user.id
    }
    return payload
  }

  const buildUpdatePayload = (value: FormState): ValorizationUpdate => ({
    ...buildCreatePayload(value),
  })

  const handleSubmit = async () => {
    const errors = validateForm(form)
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors)
      return
    }
    try {
      if (formMode === 'create') {
        await createMutation.mutateAsync(buildCreatePayload(form))
      } else if (editing) {
        await updateMutation.mutateAsync({ id: editing.id, payload: buildUpdatePayload(form) })
      }
      setFormOpen(false)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Nieznany błąd'
      alert(`Nie udało się zapisać waloryzacji.\n\n${msg}`)
    }
  }

  const handleStatusChange = async (
    value: Valorization,
    status: ValorizationStatus
  ) => {
    const payload: ValorizationUpdate = { status }
    if ((status === 'approved' || status === 'applied') && user?.id) {
      payload.approved_by = user.id
    }
    if (status === 'applied' && !value.applied_date) {
      payload.applied_date = new Date().toISOString().slice(0, 10)
    }
    try {
      await updateMutation.mutateAsync({ id: value.id, payload })
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Nieznany błąd'
      alert(`Nie udało się zmienić statusu.\n\n${msg}`)
    }
  }

  const handleDelete = async (value: Valorization) => {
    if (!window.confirm('Usunąć waloryzację? Tej operacji nie można cofnąć.')) return
    try {
      await deleteMutation.mutateAsync(value.id)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Nieznany błąd'
      alert(`Nie udało się usunąć waloryzacji.\n\n${msg}`)
    }
  }

  const buildDefaultAutoSelection = useCallback(() => {
    return activeContracts.reduce<Record<string, boolean>>((acc, contract) => {
      acc[contract.id] = true
      return acc
    }, {})
  }, [activeContracts])

  const openAutoModal = () => {
    setAutoOpen(true)
    setAutoPlannedDate(defaultPlannedDate)
    setAutoSelected(buildDefaultAutoSelection())
    setAutoRules((prev) => {
      const next: Record<string, AutoRuleState> = {}
      activeContracts.forEach((contract) => {
        next[contract.id] = prev[contract.id] ?? { indexType: 'GUS_CPI', indexValue: '' }
      })
      return next
    })
    setAutoResult(null)
    setAutoError(null)
  }

  const closeAutoModal = () => {
    setAutoOpen(false)
    setAutoResult(null)
    setAutoError(null)
  }

  const toggleAutoContract = (contractId: string) => {
    setAutoSelected((prev) => {
      const next = { ...prev, [contractId]: !prev[contractId] }
      return next
    })
    setAutoRules((prev) => {
      if (prev[contractId]) return prev
      return { ...prev, [contractId]: { indexType: 'GUS_CPI', indexValue: '' } }
    })
  }

  const handleAutoRuleChange = (
    contractId: string,
    patch: Partial<AutoRuleState>
  ) => {
    setAutoRules((prev) => {
      const current = prev[contractId] ?? { indexType: 'GUS_CPI', indexValue: '' }
      const next = { ...current, ...patch }
      if (patch.indexType === 'GUS_CPI') {
        next.indexValue = ''
      }
      return { ...prev, [contractId]: next }
    })
  }

  const handleAutoSubmit = async () => {
    const selectedIds = activeContracts
      .filter((contract) => autoSelected[contract.id])
      .map((contract) => contract.id)
    if (!autoPlannedDate) {
      setAutoError('Wskaż planowaną datę waloryzacji.')
      return
    }
    if (selectedIds.length === 0) {
      setAutoError('Wybierz przynajmniej jedną aktywną umowę.')
      return
    }
    const missingRule = selectedIds.find((id) => !autoRules[id]?.indexType)
    if (missingRule) {
      setAutoError('Uzupełnij regułę waloryzacji dla każdej zaznaczonej umowy.')
      return
    }
    const missingIndex = selectedIds.find((id) => {
      const rule = autoRules[id]
      if (!rule || rule.indexType === 'GUS_CPI') return false
      return !rule.indexValue || !Number.isFinite(Number(rule.indexValue))
    })
    if (missingIndex) {
      setAutoError('Uzupełnij wartość indeksu dla stałych/indywidualnych reguł.')
      return
    }
    setAutoError(null)
    try {
      const payload = {
        planned_date: autoPlannedDate,
        items: selectedIds.map((id) => {
          const rule = autoRules[id]
          return {
            contract_id: id,
            index_type: rule?.indexType ?? 'GUS_CPI',
            index_value:
              rule?.indexType && rule.indexType !== 'GUS_CPI'
                ? Number(rule.indexValue)
                : null,
          }
        }),
      }
      const response = await generateMutation.mutateAsync(payload)
      setAutoResult(response)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Nieznany błąd'
      setAutoError(`Nie udało się uruchomić automatu.\n${msg}`)
    }
  }

  const rows = useMemo(
    () => {
      const mapped = valorizations.map((value) => {
        const contract = contractsById.get(value.contract_id)
        const customer = contract ? customersById.get(contract.customer_id) : undefined
        return { value, contract, customer }
      })
      return mapped.sort((a, b) => {
        const customerA = a.customer?.company_name || a.customer?.ckk || ''
        const customerB = b.customer?.company_name || b.customer?.ckk || ''
        const cmp = customerA.localeCompare(customerB, 'pl')
        if (cmp !== 0) return cmp
        return (a.contract?.contract_number || '').localeCompare(
          b.contract?.contract_number || '',
          'pl'
        )
      })
    },
    [valorizations, contractsById, customersById]
  )

  const isBusy =
    valorizationsLoading ||
    contractsLoading ||
    customersLoading ||
    createMutation.isPending ||
    updateMutation.isPending ||
    deleteMutation.isPending ||
    generateMutation.isPending

  const yearOptions = [currentYear - 1, currentYear, currentYear + 1, currentYear + 2]

  return (
    <div style={{ width: '100%' }}>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 20,
        }}
      >
        <div>
          <h1
            style={{
              fontSize: 22,
              fontWeight: 700,
              color: '#1a1714',
              margin: 0,
              marginBottom: 2,
            }}
          >
            Waloryzacja
          </h1>
          <p style={{ fontSize: 12.5, color: '#7a6f67', margin: 0 }}>
            Reguły waloryzacji, wskaźniki GUS i pipeline odnowień umów.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            style={{
              background: 'white',
              border: '1px solid #e3e0db',
              borderRadius: 6,
              padding: '7px 14px',
              fontSize: 13,
              color: '#6b6b6b',
              cursor: 'pointer',
            }}
          >
            Eksportuj raport
          </button>
          <button
            onClick={openAutoModal}
            style={{
              background: '#f7f4ef',
              border: '1px solid #e3e0db',
              borderRadius: 6,
              padding: '7px 16px',
              color: '#6b4f3f',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Uruchom automat
          </button>
          <button
            onClick={() => setIsAlertModalOpen(true)}
            style={{
              background: '#fff5f0',
              border: '1px solid #fdd5b8',
              borderRadius: 6,
              padding: '7px 16px',
              color: '#c94f02',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
            Generuj alert
          </button>
          <button
            onClick={openCreateModal}
            style={{
              background: '#e85c04',
              border: 'none',
              borderRadius: 6,
              padding: '7px 16px',
              color: 'white',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Nowa waloryzacja
          </button>
        </div>
      </div>

      {/* Alert modal */}
      <Modal
        isOpen={isAlertModalOpen}
        onClose={() => setIsAlertModalOpen(false)}
        title="Generuj alert waloryzacyjny"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={labelStyle}>Wybierz klienta / grupę</label>
            <select style={inputStyle}>
              <option>Wszystkie wymagające decyzji ({statusCounts.pending})</option>
              <option>Empik Sp. z o.o.</option>
              <option>MediaMarkt</option>
              <option>TechNova S.A.</option>
            </select>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={labelStyle}>Priorytet alertu</label>
            <div style={{ display: 'flex', gap: 10 }}>
              {['Krytyczny', 'Wysoki', 'Normalny'].map((p) => (
                <button
                  key={p}
                  style={{
                    flex: 1,
                    padding: '8px',
                    borderRadius: 6,
                    border: '1px solid #e3e0db',
                    background: p === 'Krytyczny' ? '#fff5f0' : 'white',
                    color: p === 'Krytyczny' ? '#e85c04' : '#6b6b6b',
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={labelStyle}>Treść powiadomienia</label>
            <textarea
              style={{ ...inputStyle, minHeight: 80 }}
              defaultValue="Przypomnienie: Termin podjęcia decyzji o waloryzacji upływa za 3 dni. Wymagany akcept stawek przed wysłaniem aneksu."
            />
          </div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              background: '#fcfcfc',
              padding: '10px',
              borderRadius: 8,
              border: '1px solid #f2f0ed',
            }}
          >
            <input type="checkbox" id="send-email" defaultChecked />
            <label
              htmlFor="send-email"
              style={{ fontSize: 12, color: '#4b5563', cursor: 'pointer' }}
            >
              Wyślij powiadomienie Push oraz Email do opiekuna
            </label>
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
            <button
              onClick={() => setIsAlertModalOpen(false)}
              style={{
                flex: 1,
                padding: '10px',
                borderRadius: 6,
                border: '1px solid #e3e0db',
                background: 'white',
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Anuluj
            </button>
            <button
              onClick={() => setIsAlertModalOpen(false)}
              style={{
                flex: 1,
                padding: '10px',
                borderRadius: 6,
                border: 'none',
                background: '#e85c04',
                color: 'white',
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Rozeslij alert
            </button>
          </div>
        </div>
      </Modal>

      {/* Create/Edit modal */}
      <Modal
        isOpen={formOpen}
        onClose={() => setFormOpen(false)}
        title={formMode === 'create' ? '✦ Nowa waloryzacja' : '✦ Edytuj waloryzację'}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '12px 16px',
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={labelStyle}>Umowa</label>
              <select
                value={form.contract_id}
                onChange={(e) => updateField('contract_id', e.target.value)}
                style={{
                  ...inputStyle,
                  ...(formErrors.contract_id ? { borderColor: '#e53e3e' } : {}),
                }}
              >
                <option value="">Wybierz umowę</option>
                {contractOptions.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
              {formErrors.contract_id && (
                <span style={{ fontSize: 11, color: '#c94f02' }}>
                  {formErrors.contract_id}
                </span>
              )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={labelStyle}>Rok waloryzacji</label>
              <input
                type="number"
                value={form.year}
                onChange={(e) => updateField('year', e.target.value)}
                style={{
                  ...inputStyle,
                  ...(formErrors.year ? { borderColor: '#e53e3e' } : {}),
                }}
              />
              {formErrors.year && (
                <span style={{ fontSize: 11, color: '#c94f02' }}>
                  {formErrors.year}
                </span>
              )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={labelStyle}>Typ indeksu</label>
              <select
                value={form.index_type}
                onChange={(e) => updateField('index_type', e.target.value as IndexType)}
                style={inputStyle}
              >
                {Object.entries(INDEX_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={labelStyle}>Wartość indeksu (%)</label>
              <input
                type="number"
                step="0.1"
                value={form.index_value}
                onChange={(e) => updateField('index_value', e.target.value)}
                style={{
                  ...inputStyle,
                  ...(formErrors.index_value ? { borderColor: '#e53e3e' } : {}),
                }}
              />
              {formErrors.index_value && (
                <span style={{ fontSize: 11, color: '#c94f02' }}>
                  {formErrors.index_value}
                </span>
              )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={labelStyle}>Planowana data</label>
              <input
                type="date"
                value={form.planned_date}
                onChange={(e) => updateField('planned_date', e.target.value)}
                style={{
                  ...inputStyle,
                  ...(formErrors.planned_date ? { borderColor: '#e53e3e' } : {}),
                }}
              />
              {formErrors.planned_date && (
                <span style={{ fontSize: 11, color: '#c94f02' }}>
                  {formErrors.planned_date}
                </span>
              )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={labelStyle}>Data zastosowania</label>
              <input
                type="date"
                value={form.applied_date}
                onChange={(e) => updateField('applied_date', e.target.value)}
                style={{
                  ...inputStyle,
                  ...(formErrors.applied_date ? { borderColor: '#e53e3e' } : {}),
                }}
              />
              {formErrors.applied_date && (
                <span style={{ fontSize: 11, color: '#c94f02' }}>
                  {formErrors.applied_date}
                </span>
              )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={labelStyle}>Status</label>
              <select
                value={form.status}
                onChange={(e) => updateField('status', e.target.value as ValorizationStatus)}
                style={inputStyle}
              >
                {Object.entries(STATUS_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={labelStyle}>Notatka</label>
            <textarea
              value={form.notes}
              onChange={(e) => updateField('notes', e.target.value)}
              style={{ ...inputStyle, minHeight: 80 }}
            />
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            <button
              onClick={() => setFormOpen(false)}
              style={{
                flex: 1,
                padding: '10px',
                borderRadius: 6,
                border: '1px solid #e3e0db',
                background: 'white',
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
              }}
              disabled={createMutation.isPending || updateMutation.isPending}
            >
              Anuluj
            </button>
            <button
              onClick={handleSubmit}
              style={{
                flex: 1,
                padding: '10px',
                borderRadius: 6,
                border: 'none',
                background: '#e85c04',
                color: 'white',
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
              }}
              disabled={createMutation.isPending || updateMutation.isPending}
            >
              {createMutation.isPending || updateMutation.isPending
                ? 'Zapisywanie…'
                : 'Zapisz'}
            </button>
          </div>
        </div>
      </Modal>

      {/* KPI cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4,1fr)',
          gap: 14,
          marginBottom: 20,
        }}
      >
        {kpis.map((kpi) => (
          <div
            key={kpi.label}
            style={{ ...card, padding: '16px 18px', borderTop: `3px solid ${kpi.color}` }}
          >
            <div
              style={{
                fontSize: 10,
                fontWeight: 700,
                color: '#7a6f67',
                letterSpacing: '0.07em',
                marginBottom: 8,
              }}
            >
              {kpi.label}
            </div>
            <div
              style={{
                fontSize: 30,
                fontWeight: 800,
                color: '#1a1714',
                lineHeight: 1,
                marginBottom: 6,
              }}
            >
              {kpi.value}
            </div>
            <span
              style={{
                fontSize: 11,
                padding: '2px 8px',
                borderRadius: 4,
                fontWeight: 600,
                background: kpi.color + '18',
                color: kpi.color,
              }}
            >
              {kpi.sub}
            </span>
          </div>
        ))}
      </div>

      {/* GUS update info */}
      {cpiUpdated && (
        <div
          style={{
            marginBottom: 14,
            display: 'flex',
            alignItems: 'center',
            gap: 5,
            fontSize: 11,
            color: '#7a6f67',
          }}
        >
          <svg
            width="11"
            height="11"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
          Wskaźnik CPI ({cpiDisplay}) pobrano z GUS BDL · zaktualizowano: {cpiUpdated}
        </div>
      )}

      {/* Valorization table */}
      <div style={{ ...card, overflow: 'hidden', marginBottom: 16 }}>
        <div
          style={{
            padding: '14px 18px',
            borderBottom: '1px solid #f2f0ed',
            display: 'flex',
            justifyContent: 'space-between',
            gap: 12,
            flexWrap: 'wrap',
          }}
        >
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#1a1714' }}>
              Reguły waloryzacji
            </div>
            <div style={{ fontSize: 12, color: '#7a6f67', marginTop: 2 }}>
              Wskaźniki indeksacji i statusy dla aktywnych umów
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <select
              value={filterContractId}
              onChange={(e) => setFilterContractId(e.target.value)}
              style={{ ...inputStyle, fontSize: 12 }}
            >
              <option value="all">Wszystkie umowy</option>
              {contractOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <select
              value={filterYear}
              onChange={(e) => setFilterYear(e.target.value)}
              style={{ ...inputStyle, fontSize: 12 }}
            >
              <option value="all">Wszystkie lata</option>
              {yearOptions.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as ValorizationStatus | 'all')}
              style={{ ...inputStyle, fontSize: 12 }}
            >
              <option value="all">Wszystkie statusy</option>
              {Object.entries(STATUS_LABELS).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div style={{ padding: '0 18px 18px' }}>
          {isBusy && (
            <div
              style={{
                padding: '18px 0',
                fontSize: 12,
                color: '#7a6f67',
                textAlign: 'center',
              }}
            >
              Ładowanie danych waloryzacji…
            </div>
          )}

          {!isBusy && rows.length === 0 && (
            <div
              style={{
                padding: '18px 0',
                fontSize: 12,
                color: '#7a6f67',
                textAlign: 'center',
              }}
            >
              Brak waloryzacji do wyświetlenia.
            </div>
          )}

          {!isBusy &&
            rows.map(({ value, contract, customer }, i) => {
              const statusMeta = STATUS_STYLES[value.status]
              const contractLabel = contract?.contract_number ?? '—'
              const customerLabel = customer?.company_name || customer?.ckk || '—'
              const currentGus = value.index_type === 'GUS_CPI' ? cpiDisplay : '—'
              const canGenerate = Boolean(contract && customer)
              const rowBorder = STATUS_COLORS[value.status]
              return (
                <div
                  key={value.id}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1.7fr 1fr 0.9fr 0.9fr 0.9fr 1.4fr',
                    alignItems: 'center',
                    gap: 12,
                    padding: '14px 16px',
                    borderRadius: 8,
                    background: i % 2 === 0 ? '#fafaf9' : 'white',
                    border: '1px solid #f2f0ed',
                    borderLeft: `3px solid ${rowBorder}`,
                    marginTop: 10,
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 13, color: '#1a1714' }}>
                      {customerLabel}
                    </div>
                    <div style={{ fontSize: 11, color: '#7a6f67', marginTop: 1 }}>
                      {contractLabel}
                    </div>
                  </div>
                  <div>
                    <div
                      style={{ fontSize: 10, color: '#7a6f67', marginBottom: 2, fontWeight: 600 }}
                    >
                      INDEKS / WARTOŚĆ
                    </div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#1a1714' }}>
                      {INDEX_LABELS[value.index_type]} · {formatIndexValue(value.index_value)}
                    </div>
                    <div style={{ fontSize: 10, color: '#7a6f67', marginTop: 4 }}>
                      Obecny GUS: {currentGus}
                    </div>
                  </div>
                  <div>
                    <div
                      style={{ fontSize: 10, color: '#7a6f67', marginBottom: 2, fontWeight: 600 }}
                    >
                      ROK
                    </div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#1a1714' }}>
                      {value.year}
                    </div>
                  </div>
                  <div>
                    <div
                      style={{ fontSize: 10, color: '#7a6f67', marginBottom: 2, fontWeight: 600 }}
                    >
                      PLANOWANA OD
                    </div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#1a1714' }}>
                      {formatDate(value.planned_date)}
                    </div>
                  </div>
                  <div>
                    <div
                      style={{ fontSize: 10, color: '#7a6f67', marginBottom: 2, fontWeight: 600 }}
                    >
                      STATUS
                    </div>
                    <span
                      style={{
                        fontSize: 11,
                        padding: '4px 10px',
                        borderRadius: 20,
                        fontWeight: 600,
                        background: statusMeta.bg,
                        color: statusMeta.color,
                      }}
                    >
                      {STATUS_LABELS[value.status]}
                    </span>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'flex-end' }}>
                    <button
                      onClick={() => openWizardForValorization(value)}
                      disabled={!canGenerate}
                      style={{
                        padding: '5px 10px',
                        borderRadius: 6,
                        border: '1px solid #fdd5b8',
                        background: '#fff5f0',
                        color: '#c94f02',
                        fontSize: 11,
                        fontWeight: 600,
                        cursor: canGenerate ? 'pointer' : 'not-allowed',
                        opacity: canGenerate ? 1 : 0.6,
                      }}
                    >
                      Generuj aneks
                    </button>
                    <button
                      onClick={() => openEditModal(value)}
                      style={{
                        padding: '5px 10px',
                        borderRadius: 6,
                        border: '1px solid #e3e0db',
                        background: 'white',
                        fontSize: 11,
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      Edytuj
                    </button>
                    <button
                      onClick={() => handleStatusChange(value, 'approved')}
                      disabled={value.status !== 'pending' || updateMutation.isPending}
                      style={{
                        padding: '5px 10px',
                        borderRadius: 6,
                        border: '1px solid #d1fae5',
                        background: '#f0fff4',
                        color: '#276749',
                        fontSize: 11,
                        fontWeight: 600,
                        cursor:
                          value.status === 'pending' && !updateMutation.isPending
                            ? 'pointer'
                            : 'not-allowed',
                        opacity: value.status === 'pending' ? 1 : 0.6,
                      }}
                    >
                      Akceptuj
                    </button>
                    <button
                      onClick={() => handleStatusChange(value, 'rejected')}
                      disabled={value.status !== 'pending' || updateMutation.isPending}
                      style={{
                        padding: '5px 10px',
                        borderRadius: 6,
                        border: '1px solid #fde68a',
                        background: '#fffbeb',
                        color: '#92400e',
                        fontSize: 11,
                        fontWeight: 600,
                        cursor:
                          value.status === 'pending' && !updateMutation.isPending
                            ? 'pointer'
                            : 'not-allowed',
                        opacity: value.status === 'pending' ? 1 : 0.6,
                      }}
                    >
                      Odrzuć
                    </button>
                    <button
                      onClick={() => handleDelete(value)}
                      disabled={deleteMutation.isPending}
                      style={{
                        padding: '5px 10px',
                        borderRadius: 6,
                        border: '1px solid #fee2e2',
                        background: '#fff1f2',
                        color: '#b91c1c',
                        fontSize: 11,
                        fontWeight: 600,
                        cursor: deleteMutation.isPending ? 'not-allowed' : 'pointer',
                        opacity: deleteMutation.isPending ? 0.6 : 1,
                      }}
                    >
                      Usuń
                    </button>
                  </div>
                </div>
              )
            })}
        </div>
      </div>

      {/* Pipeline */}
      <div style={card}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid #f2f0ed' }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#1a1714' }}>
            Pipeline odnowień
          </div>
          <div style={{ fontSize: 12, color: '#7a6f67', marginTop: 2 }}>
            Etapy procesu renegocjacji i waloryzacji umów
          </div>
        </div>
        <div
          style={{
            padding: '18px',
            display: 'grid',
            gridTemplateColumns: 'repeat(4,1fr)',
            gap: 14,
          }}
        >
          {pipeline.map((stage, i) => (
            <div key={stage.stage} style={{ position: 'relative' }}>
              {i < pipeline.length - 1 && (
                <div
                  style={{
                    position: 'absolute',
                    right: -14,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: '#e3e0db',
                    fontSize: 20,
                    zIndex: 1,
                  }}
                >
                  ›
                </div>
              )}
              <div
                style={{
                  borderRadius: 8,
                  background: '#fafaf9',
                  border: '1px solid #f2f0ed',
                  borderTop: `3px solid ${stage.color}`,
                  padding: '18px 16px',
                  textAlign: 'center',
                }}
              >
                <div
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    color: '#7a6f67',
                    marginBottom: 10,
                    letterSpacing: '0.05em',
                    textTransform: 'uppercase',
                  }}
                >
                  {stage.stage}
                </div>
                <div
                  style={{
                    fontSize: 34,
                    fontWeight: 800,
                    color: '#1a1714',
                    lineHeight: 1,
                    marginBottom: 4,
                  }}
                >
                  {stage.count}
                </div>
                <div style={{ fontSize: 11, color: '#7a6f67', marginBottom: 10 }}>
                  {stage.value}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Auto-generation modal */}
      <Modal
        isOpen={autoOpen}
        onClose={closeAutoModal}
        title="✦ Uruchom automat waloryzacji"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {autoResult ? (
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#1a1714', marginBottom: 12 }}>
                Wynik waloryzacji
              </div>
              <div
                style={{
                  padding: 12,
                  borderRadius: 6,
                  background: '#f0fff4',
                  border: '1px solid #d1fae5',
                  marginBottom: 12,
                }}
              >
                <div style={{ fontSize: 12, color: '#276749' }}>
                  <strong>Utworzono:</strong> {autoResult.created.length} waloryzacji na rok{' '}
                  {autoResult.year}
                </div>
                {autoResult.gus_value !== null && autoResult.gus_value !== undefined && (
                  <div style={{ fontSize: 12, color: '#276749', marginTop: 4 }}>
                    <strong>CPI GUS:</strong> {autoResult.gus_value}%
                  </div>
                )}
              </div>

              {autoResult.skipped.length > 0 && (
                <div
                  style={{
                    padding: 12,
                    borderRadius: 6,
                    background: '#fef3c7',
                    border: '1px solid #fde68a',
                    marginBottom: 12,
                  }}
                >
                  <div style={{ fontSize: 12, color: '#92400e', fontWeight: 600, marginBottom: 6 }}>
                    Pominięte ({autoResult.skipped.length}):
                  </div>
                  <div style={{ fontSize: 11, color: '#92400e', display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {autoResult.skipped.map((skip) => (
                      <div key={skip.contract_id}>
                        • {getContractLabel(skip.contract_id)}: {AUTO_SKIP_LABELS[skip.reason] || skip.reason}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  onClick={closeAutoModal}
                  style={{
                    flex: 1,
                    padding: '10px',
                    borderRadius: 6,
                    border: '1px solid #e3e0db',
                    background: 'white',
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Zamknij
                </button>
              </div>
            </div>
          ) : (
            <div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 16 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <label style={labelStyle}>Planowana data waloryzacji</label>
                  <input
                    type="date"
                    value={autoPlannedDate}
                    onChange={(e) => setAutoPlannedDate(e.target.value)}
                    style={inputStyle}
                  />
                </div>
              </div>

              <div style={{ fontSize: 13, fontWeight: 700, color: '#1a1714', marginBottom: 10 }}>
                Aktywne umowy ({activeContracts.length})
              </div>

              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10,
                  maxHeight: 300,
                  overflowY: 'auto',
                  marginBottom: 12,
                }}
              >
                {activeContracts.length === 0 ? (
                  <div style={{ fontSize: 12, color: '#7a6f67' }}>Brak aktywnych umów.</div>
                ) : (
                  activeContracts.map((contract) => (
                    <div
                      key={contract.id}
                      style={{
                        padding: 12,
                        borderRadius: 6,
                        border: '1px solid #e3e0db',
                        background: autoSelected[contract.id] ? '#f0f9ff' : '#fafaf9',
                      }}
                    >
                      <div style={{ display: 'flex', gap: 10, marginBottom: 8 }}>
                        <input
                          type="checkbox"
                          checked={autoSelected[contract.id] ?? false}
                          onChange={() => toggleAutoContract(contract.id)}
                          style={{ cursor: 'pointer' }}
                        />
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 12, fontWeight: 600, color: '#1a1714' }}>
                            {getContractLabel(contract.id)}
                          </div>
                        </div>
                      </div>

                      {autoSelected[contract.id] && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingLeft: 28 }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                            <label style={{ ...labelStyle, fontSize: 11 }}>Typ indeksu</label>
                            <select
                              value={autoRules[contract.id]?.indexType ?? 'GUS_CPI'}
                              onChange={(e) =>
                                handleAutoRuleChange(contract.id, {
                                  indexType: e.target.value as IndexType,
                                })
                              }
                              style={{ ...inputStyle, fontSize: 11 }}
                            >
                              {Object.entries(INDEX_LABELS).map(([key, label]) => (
                                <option key={key} value={key}>
                                  {label}
                                </option>
                              ))}
                            </select>
                          </div>

                          {autoRules[contract.id]?.indexType &&
                            autoRules[contract.id]?.indexType !== 'GUS_CPI' && (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                <label style={{ ...labelStyle, fontSize: 11 }}>Wartość (%)</label>
                                <input
                                  type="number"
                                  step="0.1"
                                  value={autoRules[contract.id]?.indexValue ?? ''}
                                  onChange={(e) =>
                                    handleAutoRuleChange(contract.id, { indexValue: e.target.value })
                                  }
                                  style={{ ...inputStyle, fontSize: 11 }}
                                  placeholder="np. 4.60"
                                />
                              </div>
                            )}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>

              {autoError && (
                <div
                  style={{
                    padding: 12,
                    borderRadius: 6,
                    background: '#fff1f2',
                    border: '1px solid #fee2e2',
                    color: '#b91c1c',
                    fontSize: 12,
                    marginBottom: 12,
                  }}
                >
                  {autoError}
                </div>
              )}

              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  onClick={closeAutoModal}
                  disabled={generateMutation.isPending}
                  style={{
                    flex: 1,
                    padding: '10px',
                    borderRadius: 6,
                    border: '1px solid #e3e0db',
                    background: 'white',
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: generateMutation.isPending ? 'not-allowed' : 'pointer',
                    opacity: generateMutation.isPending ? 0.6 : 1,
                  }}
                >
                  Anuluj
                </button>
                <button
                  onClick={handleAutoSubmit}
                  disabled={generateMutation.isPending}
                  style={{
                    flex: 1,
                    padding: '10px',
                    borderRadius: 6,
                    border: 'none',
                    background: '#e85c04',
                    color: 'white',
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: generateMutation.isPending ? 'not-allowed' : 'pointer',
                    opacity: generateMutation.isPending ? 0.6 : 1,
                  }}
                >
                  {generateMutation.isPending ? 'Generuję…' : 'Uruchom'}
                </button>
              </div>
            </div>
          )}
        </div>
      </Modal>

      {wizardContext && (
        <DocumentWizard
          isOpen={!!wizardContext}
          customer={wizardContext.customer}
          contracts={contracts}
          initialContractId={wizardContext.contractId}
          initialYear={wizardContext.params?.year}
          initialIndexType={wizardContext.params?.indexType}
          initialIndexValue={wizardContext.params?.indexValue}
          initialEffectiveDate={wizardContext.params?.effectiveDate}
          onClose={() => setWizardContext(null)}
          onFinalized={() => setWizardContext(null)}
        />
      )}
    </div>
  )
}
