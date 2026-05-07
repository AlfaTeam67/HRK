import { useState } from 'react'
import type { CSSProperties } from 'react'

import { useActiveDirectory } from '@/features/auth/hooks/useActiveDirectory'
import {
  useBootstrapAdmin,
  useCreateUser,
  useDeleteUser,
  useUpdateUserRoles,
  useUserAccess,
  useUsers,
} from '@/hooks/access'
import { useIsAdmin } from '@/hooks/usePermission'
import { cardStyle } from '@/lib/styles'
import type { UserRole } from '@/types/models'

/* ─── Role metadata ──────────────────────────────────────────────────── */

const ALL_ROLES: { value: UserRole; label: string; color: string }[] = [
  { value: 'admin',           label: 'Administrator',     color: '#6b3fa0' },
  { value: 'manager',         label: 'Menedżer',          color: '#2b6cb0' },
  { value: 'account_manager', label: 'Opiekun klienta',   color: '#e85c04' },
  { value: 'consultant',      label: 'Konsultant',        color: '#276749' },
  { value: 'viewer',          label: 'Przeglądający',     color: '#92400e' },
]


/* ─── Inline role editor ────────────────────────────────────────────── */

function RoleEditor({
  userId,
  onClose,
}: {
  userId: string
  onClose: () => void
}) {
  const { data: access, isLoading } = useUserAccess(userId)
  const updateRoles = useUpdateUserRoles()
  const [selected, setSelected] = useState<UserRole[] | null>(null)

  const currentRoles: UserRole[] = selected ?? access?.roles ?? []

  function toggle(role: UserRole) {
    const base = selected ?? access?.roles ?? []
    setSelected(base.includes(role) ? base.filter((r) => r !== role) : [...base, role])
  }

  async function save() {
    await updateRoles.mutateAsync({ userId, roles: currentRoles })
    onClose()
  }

  const overlay: CSSProperties = {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100,
  }
  const modal: CSSProperties = {
    ...cardStyle, padding: '24px 28px', minWidth: 340, maxWidth: 420, width: '100%',
  }

  return (
    <div style={overlay} onClick={onClose}>
      <div style={modal} onClick={(e) => e.stopPropagation()}>
        <div style={{ fontSize: 15, fontWeight: 800, color: '#1a1714', marginBottom: 16 }}>
          Edytuj role użytkownika
        </div>

        {isLoading ? (
          <div style={{ color: '#9e9389', fontSize: 13 }}>Ładowanie…</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {ALL_ROLES.map((r) => {
              const checked = currentRoles.includes(r.value)
              return (
                <label
                  key={r.value}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '9px 12px', borderRadius: 8, cursor: 'pointer',
                    border: `1px solid ${checked ? r.color + '60' : '#e3e0db'}`,
                    background: checked ? r.color + '0d' : '#fafaf9',
                    transition: 'all 0.1s',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggle(r.value)}
                    style={{ accentColor: r.color, width: 15, height: 15 }}
                  />
                  <span style={{ fontSize: 13, fontWeight: checked ? 700 : 500, color: checked ? r.color : '#4b5563' }}>
                    {r.label}
                  </span>
                </label>
              )
            })}
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, marginTop: 20, justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            style={{ background: 'white', border: '1px solid #e3e0db', borderRadius: 6, padding: '7px 14px', fontSize: 13, color: '#6b6b6b', cursor: 'pointer' }}
          >
            Anuluj
          </button>
          <button
            onClick={save}
            disabled={updateRoles.isPending || isLoading}
            style={{ background: '#e85c04', border: 'none', borderRadius: 6, padding: '7px 16px', color: 'white', fontSize: 13, fontWeight: 600, cursor: 'pointer', opacity: updateRoles.isPending ? 0.7 : 1 }}
          >
            {updateRoles.isPending ? 'Zapisywanie…' : 'Zapisz'}
          </button>
        </div>

        {updateRoles.isError && (
          <div style={{ marginTop: 10, fontSize: 12, color: '#c94f02' }}>
            Błąd zapisu — sprawdź czy masz uprawnienia admina.
          </div>
        )}
      </div>
    </div>
  )
}

/* ─── Add user form ─────────────────────────────────────────────────── */

function AddUserForm({ onClose }: { onClose: () => void }) {
  const createUser = useCreateUser()
  const [login, setLogin] = useState('')
  const [email, setEmail] = useState('')

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    await createUser.mutateAsync({ login: login.trim(), email: email.trim() })
    onClose()
  }

  const overlay: CSSProperties = {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100,
  }
  const modal: CSSProperties = {
    ...cardStyle, padding: '24px 28px', minWidth: 340, maxWidth: 420, width: '100%',
  }
  const inp: CSSProperties = {
    width: '100%', padding: '8px 10px', fontSize: 13,
    border: '1px solid #e3e0db', borderRadius: 6,
    outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box',
  }

  return (
    <div style={overlay} onClick={onClose}>
      <div style={modal} onClick={(e) => e.stopPropagation()}>
        <div style={{ fontSize: 15, fontWeight: 800, color: '#1a1714', marginBottom: 16 }}>
          Dodaj użytkownika
        </div>
        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#6b6b6b', marginBottom: 5 }}>Login (AD)</div>
            <input
              style={inp}
              placeholder="np. jan.kowalski"
              value={login}
              onChange={(e) => setLogin(e.target.value)}
              required
              autoFocus
            />
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#6b6b6b', marginBottom: 5 }}>E-mail</div>
            <input
              style={inp}
              type="email"
              placeholder="jan.kowalski@hrk.pl"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          {createUser.isError && (
            <div style={{ fontSize: 12, color: '#c94f02' }}>
              Błąd — login lub e-mail już istnieje.
            </div>
          )}

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
            <button
              type="button"
              onClick={onClose}
              style={{ background: 'white', border: '1px solid #e3e0db', borderRadius: 6, padding: '7px 14px', fontSize: 13, color: '#6b6b6b', cursor: 'pointer' }}
            >
              Anuluj
            </button>
            <button
              type="submit"
              disabled={createUser.isPending}
              style={{ background: '#e85c04', border: 'none', borderRadius: 6, padding: '7px 16px', color: 'white', fontSize: 13, fontWeight: 600, cursor: 'pointer', opacity: createUser.isPending ? 0.7 : 1 }}
            >
              {createUser.isPending ? 'Dodawanie…' : 'Dodaj'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

/* ─── Roles reference tab ───────────────────────────────────────────── */

const ROLES_REFERENCE = [
  {
    ...ALL_ROLES[0], // admin
    permissions: ['Wszystkie zasoby (pełny dostęp)', 'Zarządzanie użytkownikami i rolami', 'Zatwierdzanie waloryzacji', 'Konfiguracja systemu'],
  },
  {
    ...ALL_ROLES[1], // manager
    permissions: ['Edycja klientów, umów, waloryzacji', 'Usuwanie zasobów', 'Zarządzanie usługami i stawkami', 'Podgląd raportów'],
  },
  {
    ...ALL_ROLES[2], // account_manager
    permissions: ['Tworzenie klientów, notatek', 'Inicjowanie waloryzacji', 'Upload dokumentów', 'Podgląd umów'],
  },
  {
    ...ALL_ROLES[3], // consultant
    permissions: ['Tworzenie klientów, umów, notatek', 'Upload dokumentów', 'Podgląd wszystkich zasobów'],
  },
  {
    ...ALL_ROLES[4], // viewer
    permissions: ['Podgląd klientów i umów', 'Podgląd raportów', 'Wyszukiwanie AI (RAG)'],
  },
]

/* ─── Main component ────────────────────────────────────────────────── */

export function SettingsPage() {
  const [activeTab, setActiveTab] = useState<'users' | 'roles'>('users')
  const [editingUserId, setEditingUserId] = useState<string | null>(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const ad = useActiveDirectory()
  const isAdmin = useIsAdmin()
  const card: CSSProperties = cardStyle

  const { data: usersData, isLoading: usersLoading, error: usersError } = useUsers({ page: 1, page_size: 50 })
  const deleteUser = useDeleteUser()
  const bootstrapAdmin = useBootstrapAdmin()

  const users = usersData?.items ?? []
  const totalUsers = usersData?.total ?? 0

  const kpis = [
    { label: 'UŻYTKOWNICY',    value: usersLoading ? '…' : String(totalUsers),  sub: usersLoading ? 'ładowanie…' : `${totalUsers} w systemie`,         color: '#3182ce' },
    { label: 'ROLE SYSTEMOWE', value: '5',                                       sub: 'Admin, Menedżer, AM, Konsultant, Viewer',                        color: '#6b3fa0' },
    { label: 'RBAC / ABAC',    value: 'ON',                                      sub: 'Role + zakres firmowy',                                          color: '#e85c04' },
    { label: 'SSO / AD',       value: ad.isConfigured ? 'ON' : 'OFF',            sub: `${ad.provider} · ${ad.domain}`, color: ad.isConfigured ? '#38a169' : '#e85c04' },
  ]

  return (
    <div style={{ width: '100%' }}>
      {editingUserId && <RoleEditor userId={editingUserId} onClose={() => setEditingUserId(null)} />}
      {showAddForm && <AddUserForm onClose={() => setShowAddForm(false)} />}

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#1a1714', margin: 0, marginBottom: 2 }}>Dostępy i role</h1>
          <p style={{ fontSize: 12.5, color: '#9e9389', margin: 0 }}>Zarządzanie użytkownikami, rolami i uprawnieniami RBAC/ABAC.</p>
        </div>
        {isAdmin && (
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => bootstrapAdmin.mutate()}
              disabled={bootstrapAdmin.isPending}
              title="Nadaj sobie rolę admin jeśli żaden admin jeszcze nie istnieje"
              style={{ background: 'white', border: '1px solid #e3e0db', borderRadius: 6, padding: '7px 14px', fontSize: 13, color: '#6b6b6b', cursor: 'pointer' }}
            >
              Bootstrap admin
            </button>
            <button
              onClick={() => setShowAddForm(true)}
              style={{ background: '#e85c04', border: 'none', borderRadius: 6, padding: '7px 16px', color: 'white', fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              Dodaj użytkownika
            </button>
          </div>
        )}
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
            <>
              {usersLoading && (
                <div style={{ color: '#9e9389', fontSize: 13, padding: '20px 0' }}>Ładowanie użytkowników…</div>
              )}
              {usersError && (
                <div style={{ color: '#c94f02', fontSize: 13, padding: '10px 0' }}>
                  Błąd ładowania — sprawdź czy masz uprawnienia admina lub zrestartuj backend.
                </div>
              )}
              {!usersLoading && !usersError && users.length === 0 && (
                <div style={{ color: '#9e9389', fontSize: 13, padding: '20px 0' }}>
                  Brak użytkowników. Kliknij „Dodaj użytkownika" lub zaloguj się przez AD.
                </div>
              )}
              {!usersLoading && users.length > 0 && (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr>
                      {['UŻYTKOWNIK', 'E-MAIL', 'AKCJE'].map((col) => (
                        <th key={col} style={{ textAlign: 'left', fontSize: 10, fontWeight: 700, color: '#9e9389', letterSpacing: '0.06em', paddingBottom: 10, borderBottom: '1px solid #f2f0ed' }}>
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((u, i) => {
                      const initials = u.login.slice(0, 2).toUpperCase()
                      const colors = ['#e85c04', '#3182ce', '#6b3fa0', '#276749', '#92400e']
                      const bg = colors[u.login.charCodeAt(0) % colors.length]
                      return (
                        <tr key={u.id} style={{ borderBottom: i < users.length - 1 ? '1px solid #f9f8f6' : 'none' }}>
                          <td style={{ padding: '11px 0' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              <div style={{ width: 32, height: 32, borderRadius: '50%', background: bg, color: 'white', fontSize: 11, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                {initials}
                              </div>
                              <div>
                                <div style={{ fontWeight: 700, color: '#1a1714' }}>{u.login}</div>
                                <div style={{ fontSize: 11, color: '#9e9389' }}>HRK\{u.login}</div>
                              </div>
                            </div>
                          </td>
                          <td style={{ padding: '11px 8px', color: '#4b5563', fontSize: 12 }}>{u.email}</td>
                          <td style={{ padding: '11px 0' }}>
                            <div style={{ display: 'flex', gap: 6 }}>
                              {isAdmin && (
                                <>
                                  <button
                                    onClick={() => setEditingUserId(String(u.id))}
                                    style={{ fontSize: 11, border: '1px solid #e3e0db', borderRadius: 6, padding: '3px 10px', background: 'white', color: '#4b5563', cursor: 'pointer' }}
                                  >
                                    Role
                                  </button>
                                  <button
                                    onClick={() => {
                                      if (confirm(`Usunąć użytkownika ${u.login}?`)) {
                                        deleteUser.mutate(String(u.id))
                                      }
                                    }}
                                    style={{ fontSize: 11, border: '1px solid #fdd5b8', borderRadius: 6, padding: '3px 10px', background: '#fff5f0', color: '#c94f02', cursor: 'pointer' }}
                                  >
                                    Usuń
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              )}
            </>
          )}

          {activeTab === 'roles' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 14 }}>
              {ROLES_REFERENCE.map((role) => (
                <div key={role.value} style={{ borderRadius: 8, border: '1px solid #f2f0ed', background: '#fafaf9', borderTop: `3px solid ${role.color}`, padding: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                    <div style={{ fontSize: 15, fontWeight: 800, color: '#1a1714' }}>{role.label}</div>
                    <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: role.color + '18', color: role.color }}>
                      {role.value}
                    </span>
                  </div>
                  <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {role.permissions.map((perm) => (
                      <li key={perm} style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12, color: '#374151' }}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={role.color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12"/>
                        </svg>
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
