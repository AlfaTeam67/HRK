export interface MockService {
  id: string
  name: string
  basePrice: number
}

export const MOCK_SERVICES: MockService[] = [
  { id: 'svc_1', name: 'Outsourcing płac', basePrice: 2500 },
  { id: 'svc_2', name: 'Kadry i place', basePrice: 1800 },
  { id: 'svc_3', name: 'Doradztwo HR', basePrice: 1400 },
  { id: 'svc_4', name: 'Rekrutacja stała', basePrice: 3200 },
  { id: 'svc_5', name: 'Rekrutacja tymczasowa', basePrice: 1200 },
  { id: 'svc_6', name: 'Szkolenia B2B', basePrice: 900 },
]

export const CONTRACT_TYPE_LABELS: Record<string, string> = {
  ramowa: 'Umowa ramowa',
  SLA: 'Umowa SLA',
  DPA: 'Umowa DPA',
  PPK: 'Umowa PPK',
  inne: 'Inna umowa',
}

export const CONTRACT_TYPE_DESCRIPTIONS: Record<string, string> = {
  ramowa: 'Ramowa umowa o świadczenie usług – główny kontrakt określający współpracę.',
  SLA: 'Umowa poziomu usług – szczegółowe parametry jakości i dostępności.',
  DPA: 'Umowa powierzenia danych osobowych – zgodność z RODO.',
  PPK: 'Umowa obsługi Pracowniczych Planów Kapitałowych.',
  inne: 'Inny typ umowy – pole niestandardowe.',
}

export const CONTRACT_TYPE_ICONS: Record<string, string> = {
  ramowa: '📋',
  SLA: '📊',
  DPA: '🔒',
  PPK: '💰',
  inne: '📄',
}

export const BILLING_LABELS: Record<string, string> = {
  monthly: 'Miesięczny',
  quarterly: 'Kwartalny',
  annual: 'Roczny',
  one_time: 'Jednorazowy',
}

export function generateContractNumber(clientCkk: string, year: number): string {
  const seq = Math.floor(Math.random() * 900 + 100)
  return `HRK/${clientCkk}/${year}/${seq}`
}

export function generateMockPreamble(
  type: string,
  clientName: string,
  clientNip: string | null,
  services: { name: string; price: number }[],
  startDate: string,
  billingCycle: string,
): string {
  const typeLabel = CONTRACT_TYPE_LABELS[type] ?? 'Umowa'
  const cycleLabel = BILLING_LABELS[billingCycle] ?? 'miesięczny'
  const total = services.reduce((s, svc) => s + svc.price, 0)
  const servicesText = services
    .map((svc) => `  • ${svc.name} – ${svc.price.toLocaleString('pl-PL')} PLN netto / mc`)
    .join('\n')

  return `UMOWA ${typeLabel.toUpperCase()}

zawarta w dniu ${new Date().toLocaleDateString('pl-PL')} pomiędzy:

HRK Payroll Consulting Sp. z o.o.
ul. Przykładowa 1, 00-001 Warszawa
NIP: 123-45-67-890

a

${clientName}
${clientNip ? `NIP: ${clientNip}` : ''}

§1
PRZEDMIOT UMOWY

1. Na podstawie niniejszej umowy HRK zobowiązuje się do świadczenia na rzecz Klienta usług wymienionych w §2.
2. Umowa obowiązuje od dnia ${new Date(startDate).toLocaleDateString('pl-PL')}.

§2
ZAKRES USŁUG I WYNAGRODZENIE

1. Miesięczne wynagrodzenie netto z tytułu realizacji usług wynosi:

${servicesText}

2. Łączna wartość miesięczna: ${total.toLocaleString('pl-PL')} PLN netto.
3. Cykl rozliczeniowy: ${cycleLabel}.
4. Faktura VAT wystawiana jest z dołu, z terminem płatności 14 dni.

§3
POSTANOWIENIA KOŃCOWE

1. Wszelkie zmiany umowy wymagają formy pisemnej pod rygorem nieważności.
2. Umowę zawarto na czas określony, z możliwością przedłużenia.
3. W sprawach nieuregulowanych zastosowanie mają przepisy Kodeksu cywilnego.`
}
