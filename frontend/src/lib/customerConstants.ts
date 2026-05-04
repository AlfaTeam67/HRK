/** Centralne mapowania, typy i walidatory dla encji Customer. */

export const CUSTOMER_STATUS_PL = {
  active: 'Aktywny',
  needs_attention: 'Wymaga uwagi',
  churn_risk: 'Ryzyko utraty',
  inactive: 'Nieaktywny',
} as const

export type CustomerStatus = keyof typeof CUSTOMER_STATUS_PL

export const NOTE_TYPE_LABELS = {
  meeting: 'Spotkanie',
  call: 'Telefon',
  internal: 'Wewnętrzna',
  client_request: 'Prośba klienta',
  other: 'Inne',
} as const

export type NoteType = keyof typeof NOTE_TYPE_LABELS

export type CustomerForm = {
  ckk: string
  status: CustomerStatus
  segment: string
  industry: string
  employee_count: string
  payment_period_days: string
  invoice_nip: string
  billing_email: string
  phone: string
  account_manager_id: string
}

/* ─── Validators ──────────────────────────────────────────────── */

/** NIP: 10 cyfr, opcjonalne myślniki/spacje. Zwraca true gdy poprawny. */
export function isValidNip(value: string): boolean {
  const digits = value.replace(/[\s-]/g, '')
  if (!/^\d{10}$/.test(digits)) return false

  const weights = [6, 5, 7, 2, 3, 4, 5, 6, 7]
  const sum = weights.reduce((acc, w, i) => acc + w * parseInt(digits[i], 10), 0)

  return sum % 11 === parseInt(digits[9], 10)
}

/** Email: podstawowy format RFC. */
export function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

/** Liczba całkowita >= 0. */
export function isPositiveInt(value: string | number): boolean {
  const n = Number(value)
  return Number.isInteger(n) && n >= 0
}

/** Dni płatności: liczba całkowita 1–365. */
export function isValidPaymentDays(value: string | number): boolean {
  const n = Number(value)
  return Number.isInteger(n) && n >= 1 && n <= 365
}

export type ValidationErrors = Partial<Record<keyof CustomerForm, string>>

export function validateCustomerForm(form: CustomerForm): ValidationErrors {
  const errors: ValidationErrors = {}

  if (!form.ckk.trim()) {
    errors.ckk = 'CKK jest wymagane.'
  }

  if (form.invoice_nip && !isValidNip(form.invoice_nip)) {
    errors.invoice_nip = 'Nieprawidłowy NIP (10 cyfr, suma kontrolna).'
  }

  if (form.billing_email && !isValidEmail(form.billing_email)) {
    errors.billing_email = 'Nieprawidłowy format e-mail.'
  }

  if (form.employee_count !== '' && !isPositiveInt(form.employee_count)) {
    errors.employee_count = 'Liczba pracowników musi być liczbą ≥ 0.'
  }

  if (form.payment_period_days !== '' && !isValidPaymentDays(form.payment_period_days)) {
    errors.payment_period_days = 'Termin płatności musi być liczbą 1–365.'
  }

  return errors
}
