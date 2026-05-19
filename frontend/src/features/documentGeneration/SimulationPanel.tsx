import type { SimulationSummary } from '@/hooks/documentGenerations'
import { colors, fmtMoneyPL, fmtPctPL } from './wizardStyles'

interface Props {
  simulation: SimulationSummary
}

/** Read-only financial impact panel — read by both step 3 (live) and step 4 (final). */
export function SimulationPanel({ simulation }: Props) {
  const delta = Number(simulation.delta_annual_revenue ?? 0)
  const positive = delta >= 0

  return (
    <div
      style={{
        background: 'white',
        border: `1px solid ${colors.border}`,
        borderRadius: 12,
        padding: 16,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14, gap: 12 }}>
        <KpiCard
          label="Przychód obecny (rok)"
          value={fmtMoneyPL(simulation.current_annual_revenue)}
          color="#2d2620"
          bg="#faf5ef"
        />
        <KpiCard
          label="Przychód po waloryzacji"
          value={fmtMoneyPL(simulation.proposed_annual_revenue)}
          color={colors.positive}
          bg="#f0fff4"
        />
        <KpiCard
          label={positive ? 'Wzrost roczny' : 'Spadek roczny'}
          value={
            (positive ? '+' : '') +
            fmtMoneyPL(simulation.delta_annual_revenue) +
            ' · ' +
            fmtPctPL(simulation.delta_annual_revenue_pct)
          }
          color={positive ? colors.positive : colors.negative}
          bg={positive ? '#f0fff4' : '#fff5f5'}
        />
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
          <thead>
            <tr style={{ background: '#faf5ef', color: '#2d2620', textAlign: 'right' }}>
              <th style={th()}>Usługa</th>
              <th style={th()}>Cena obecna</th>
              <th style={th()}>Indeks</th>
              <th style={th()}>Cena nowa</th>
              <th style={th()}>Δ / okres</th>
              <th style={th()}>Δ / rok</th>
            </tr>
          </thead>
          <tbody>
            {simulation.services.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ ...td(), textAlign: 'center', color: colors.textMuted }}>
                  Brak usług w zakresie waloryzacji.
                </td>
              </tr>
            ) : (
              simulation.services.map((row) => {
                const dPeriod = Number(row.delta_per_period)
                const dYear = Number(row.delta_yearly)
                return (
                  <tr key={row.contract_service_id}>
                    <td style={{ ...td(), textAlign: 'left', fontWeight: 600 }}>
                      {row.service_name}
                    </td>
                    <td style={td()}>{fmtMoneyPL(row.current_effective_price)}</td>
                    <td style={td()}>{fmtPctPL(row.applied_index_pct)}</td>
                    <td style={td()}>{fmtMoneyPL(row.proposed_effective_price)}</td>
                    <td style={{ ...td(), color: deltaColor(dPeriod), fontWeight: 600 }}>
                      {(dPeriod > 0 ? '+' : '') + fmtMoneyPL(row.delta_per_period)}
                    </td>
                    <td style={{ ...td(), color: deltaColor(dYear), fontWeight: 600 }}>
                      {(dYear > 0 ? '+' : '') + fmtMoneyPL(row.delta_yearly)}
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function KpiCard({
  label,
  value,
  color,
  bg,
}: {
  label: string
  value: string
  color: string
  bg: string
}) {
  return (
    <div
      style={{
        flex: 1,
        background: bg,
        borderRadius: 10,
        padding: '10px 14px',
        borderTop: `2px solid ${color}`,
      }}
    >
      <div
        style={{
          fontSize: 9.5,
          color: color,
          fontWeight: 700,
          letterSpacing: 0.4,
          textTransform: 'uppercase',
          marginBottom: 4,
        }}
      >
        {label}
      </div>
      <div style={{ fontSize: 15, fontWeight: 800, color: colors.textPrimary }}>{value}</div>
    </div>
  )
}

function th(): React.CSSProperties {
  return {
    padding: '8px 10px',
    fontWeight: 600,
    borderBottom: `1px solid ${colors.border}`,
    fontSize: 11.5,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  }
}

function td(): React.CSSProperties {
  return {
    padding: '8px 10px',
    borderBottom: `1px solid ${colors.borderSoft}`,
    textAlign: 'right',
    fontVariantNumeric: 'tabular-nums',
  }
}

function deltaColor(value: number): string {
  if (value > 0) return colors.positive
  if (value < 0) return colors.negative
  return colors.textPrimary
}
