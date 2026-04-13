import Decimal from 'decimal.js'

export function formatMoney(value: string, currency: string): string {
  const normalized = new Decimal(value).toDecimalPlaces(2).toString()

  return `${currency} ${normalized}`
}
