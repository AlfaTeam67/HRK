import { useState } from 'react'
import type { CSSProperties } from 'react'

import { useActiveDirectory } from '@/features/auth/hooks/useActiveDirectory'
import { cardStyle } from '@/lib/styles'

/* ─── Mock data (inline) ─────────────────────────────────────── */
const STATIC_KPIS = [
  { label: 'UŻYTKOWNICY',    value: '5',  sub: '4 aktywnych',                       color: '#3182ce' },
  { label: 'ROLE SYSTEMOWE', value: '4',  sub: 'Admin, Standard, ReadOnly, Limited', color: '#6b3fa0' },
  { label: 'MFA',            value: 'ON', sub: '5/5 użytkowników',                  color: '#e85c04' },
]

const users = [
  { id: 1, name: 'Małgorzata Janowska', email: 'm.janowska@hrk.pl',  role: 'Opiekun klienta',    level: 'Standard', clients: 'Empik, Rossmann',        status: 'Aktywny',    lastLogin: '2026-04-13 08:45', avatar: 'MJ', ac: 'linear-gradient(135deg,#e85c04,#c94f02)' },
  { id: 2, name: 'Adam Kowalski',       email: 'a.kowalski@hrk.pl',  role: 'Opiekun klienta',    level: 'Standard', clients: 'Biedronka, Empik',        status: 'Aktywny',    lastLogin: '2026-04-12 16:30', avatar: 'AK', ac: 'linear-gradient(135deg,#3182ce,#2b6cb0)' },
  { id: 3, name: 'Karolina Lis',        email: 'k.lis@hrk.pl',       role: 'Analityk',            level: 'ReadOnly', clients: 'Lidl Polska, MediaMarkt', status: 'Aktywny',    lastLogin: '2026-04-11 12:10', avatar: 'KL', ac: 'linear-gradient(135deg,#38a169,#276749)' },
  { id: 4, name: 'Marek Nowak',         email: 'm.nowak@hrk.pl',     role: 'Dyrektor sprzedaży', level: 'Admin',    clients: 'Wszystkie',               status: 'Aktywny',    lastLogin: '2026-04-13 09:02', avatar: 'MN', ac: 'linear-gradient(135deg,#6b3fa0,#553c9a)' },
  { id: 5, name: 'Anna Wiśniewska',     email: 'a.wisniewska@hrk.pl',role: 'Prawnik',             level: 'Limited',  clients: 'Empik, TechNova',         status: 'Nieaktywny', lastLogin: '2026-03-28 14:22', avatar: 'AW', ac: 'linear-gradient(135deg,#6b6b6b,#4a4a4a)' },
]

const roles = [
  { name: 'Dyrektor sprzedaży', level: 'Admin',    color: '#6b3fa0', permissions: ['Wszystkie klienty','Wszystkie umowy','Raporty','Zarządzanie użytkownikami','Zatwierdzanie waloryzacji'] },
  { name: 'Opiekun klienta',    level: 'Standard', color: '#2b6cb0', permissions: ['Przypisani klienci','Edycja notatek','Podgląd umów','Inicjowanie waloryzacji'] },
  { name: 'Analityk',           level: 'ReadOnly', color: '#276749', permissions: ['Wszystkie klienty – odczyt','Raporty','Eksport danych','Historia waloryzacji'] },
  { name: 'Prawnik',            level: 'Limited',  color: '#92400e', permissions: ['Przypisane umowy – dokumenty','Aneksy','Akceptacje prawne'] },
]

const LEVEL_COLOR: Record<string, string> = {
  Admin: '#6b3fa0', Standard: '#2b6cb0', ReadOnly: '#276749', Limited: '#92400e',
}

/* ─── Component ──────────────────────────────────────────────── */
export function SettingsPage() {
  const [activeTab, setActiveTab] = useState<'users' | 'roles'>('users')
  const ad = useActiveDirectory()
  const card: CSSProperties = cardStyle

  const kpis = [
    ...STATIC_KPIS,
    { label: 'SSO / AD', value: ad.isConfigured ? 'ON' : 'OFF', sub: `${ad.provider} · ${ad.domain}`, color: ad.isConfigured ? '#38a169' : '#e85c04' },
  ]

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#1a1714', margin: 0, marginBottom: 2 }}>Ustawienia</h1>
          <p style={{ fontSize: 12.5, color: '#9e9389', margin: 0 }}>Zarządzanie użytkownikami, rolami i uprawnieniami systemu CRM.</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button style={{ background: 'white', border: '1px solid #e3e0db', borderRadius: 6, padding: '7px 14px', fontSize: 13, color: '#6b6b6b', cursor: 'pointer' }}>
            Synch. z AD
          </button>
          <button style={{ background: '#e85c04', border: 'none', borderRadius: 6, padding: '7px 16px', color: 'white', fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Dodaj użytkownika
          </button>
        </div>
      </div>

      {/* KPI cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 20 }}>
        {kpis.map((kpi) => (
          <div key={kpi.label} style={{ ...card, padding: '16px 18px', borderTop: `3px solid ${kpi.color}` }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#9e9389', letterSpacing: '0.07em', marginBottom: 8 }}>{kpi.label}</div>
            <div style={{ fontSize: 28, fontWeight: 800, color: '#1a1714', lineHeight: 1, marginBottom: 6 }}>{kpi.value}</div>
            <div style={{ fontSize: 11, color: '#9e9389' }}>{kpi.sub}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ ...card, overflow: 'hidden' }}>
        <div style={{ display: 'flex', borderBottom: '1px solid #f2f0ed', padding: '0 18px' }}>
          {(['users', 'roles'] as const).map((tab) => {
            const labels = { users: 'Użytkownicy', roles: 'Role i uprawnienia' }
            return (
              <button key={tab} onClick={() => setActiveTab(tab)} style={{ padding: '12px 16px', fontSize: 13, fontWeight: 600, border: 'none', background: 'none', cursor: 'pointer', color: activeTab === tab ? '#e85c04' : '#9e9389', borderBottom: activeTab === tab ? '2px solid #e85c04' : '2px solid transparent' }}>
                {labels[tab]}
              </button>
            )
          })}
        </div>

        <div style={{ padding: '16px 18px' }}>
          {activeTab === 'users' && (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr>{['UŻYTKOWNIK','ROLA','KLIENCI','STATUS','OSTATNIE LOGOWANIE',''].map(col => (
                  <th key={col} style={{ textAlign: 'left', fontSize: 10, fontWeight: 700, color: '#9e9389', letterSpacing: '0.06em', paddingBottom: 10, borderBottom: '1px solid #f2f0ed' }}>{col}</th>
                ))}</tr>
              </thead>
              <tbody>
                {users.map((u, i) => (
                  <tr key={u.id} style={{ borderBottom: i < users.length - 1 ? '1px solid #f9f8f6' : 'none' }}>
                    <td style={{ padding: '11px 0' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 32, height: 32, borderRadius: '50%', background: u.ac, color: 'white', fontSize: 11, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{u.avatar}</div>
                        <div>
                          <div style={{ fontWeight: 700, color: '#1a1714' }}>{u.name}</div>
                          <div style={{ fontSize: 11, color: '#9e9389' }}>{u.email}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '11px 8px' }}>
                      <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 20, fontWeight: 600, background: (LEVEL_COLOR[u.level] ?? '#6b6b6b') + '18', color: LEVEL_COLOR[u.level] ?? '#6b6b6b' }}>{u.role}</span>
                    </td>
                    <td style={{ padding: '11px 8px', color: '#4b5563', fontSize: 12 }}>{u.clients}</td>
                    <td style={{ padding: '11px 8px' }}>
                      <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, fontWeight: 600, background: u.status === 'Aktywny' ? '#f0fff4' : '#f9f8f6', color: u.status === 'Aktywny' ? '#276749' : '#6b6b6b' }}>{u.status}</span>
                    </td>
                    <td style={{ padding: '11px 8px', color: '#9e9389', fontSize: 12 }}>{u.lastLogin}</td>
                    <td style={{ padding: '11px 0' }}>
                      <button style={{ fontSize: 11, border: '1px solid #e3e0db', borderRadius: 6, padding: '3px 10px', background: 'white', color: '#4b5563', cursor: 'pointer' }}>Edytuj</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {activeTab === 'roles' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 14 }}>
              {roles.map((role) => (
                <div key={role.name} style={{ borderRadius: 8, border: '1px solid #f2f0ed', background: '#fafaf9', borderTop: `3px solid ${role.color}`, padding: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                    <div style={{ fontSize: 15, fontWeight: 800, color: '#1a1714' }}>{role.name}</div>
                    <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: role.color + '18', color: role.color }}>{role.level}</span>
                  </div>
                  <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {role.permissions.map((perm) => (
                      <li key={perm} style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12, color: '#374151' }}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={role.color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                        {perm}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
