import { useNavigate } from 'react-router-dom'

import { HrkLogo } from '@/components/HrkLogo'
import { AD_PROFILES, useLogin } from '@/hooks/auth'

const SIM_USERS = [
  { login: 'asia',    ...AD_PROFILES.asia },
  { login: 'kasia',   ...AD_PROFILES.kasia },
  { login: 'mateusz', ...AD_PROFILES.mateusz },
  { login: 'tomek',   ...AD_PROFILES.tomek },
]

export function LoginPage() {
  const navigate = useNavigate()
  const { mutate: login, isPending, error } = useLogin()

  function handleLogin(username: string) {
    login(username, { onSuccess: () => navigate('/', { replace: true }) })
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #fafaf9 0%, #f5f2ef 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
      fontFamily: "'Figtree Variable', sans-serif",
    }}>
      <div style={{ width: '100%', maxWidth: 400 }}>

        {/* ── Logo + header ─────────────────────────── */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 14 }}>
            <HrkLogo size={36} />
          </div>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: '#1a1714', margin: 0, marginBottom: 4 }}>
            HRK Payroll Consulting
          </h1>
          <p style={{ fontSize: 12.5, color: '#9e9389', margin: 0 }}>
            System CRM · Środowisko wewnętrzne
          </p>
        </div>

        {/* ── Karta logowania ───────────────────────── */}
        <div style={{
          background: 'white',
          borderRadius: 12,
          border: '1px solid #e3e0db',
          boxShadow: '0 4px 20px rgba(0,0,0,0.06)',
          padding: '28px 28px 24px',
        }}>
          {/* AD badge */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            background: '#f5f2ef', borderRadius: 8, padding: '10px 14px',
            marginBottom: 24,
          }}>
            <div style={{
              width: 32, height: 32, borderRadius: 8, flexShrink: 0,
              background: 'linear-gradient(135deg, #0078d4 0%, #005fa3 100%)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                <circle cx="9" cy="7" r="4"/>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
              </svg>
            </div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#1a1714' }}>Active Directory</div>
              <div style={{ fontSize: 11, color: '#9e9389' }}>HRK\domena · logowanie SSO</div>
            </div>
          </div>

          {/* Główny przycisk logowania */}
          <button
            onClick={() => handleLogin('asia')}
            disabled={isPending}
            style={{
              width: '100%',
              background: isPending ? '#f2b48a' : '#e85c04',
              border: 'none',
              borderRadius: 8,
              padding: '12px 20px',
              color: 'white',
              fontSize: 14,
              fontWeight: 700,
              cursor: isPending ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 10,
              transition: 'background 0.15s',
              fontFamily: 'inherit',
            }}
            onMouseEnter={e => { if (!isPending) (e.currentTarget as HTMLButtonElement).style.background = '#d45203' }}
            onMouseLeave={e => { if (!isPending) (e.currentTarget as HTMLButtonElement).style.background = '#e85c04' }}
          >
            {isPending ? (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round">
                  <path d="M21 12a9 9 0 1 1-6.219-8.56">
                    <animateTransform attributeName="transform" type="rotate" from="0 12 12" to="360 12 12" dur="0.8s" repeatCount="indefinite"/>
                  </path>
                </svg>
                Logowanie…
              </>
            ) : (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/>
                  <polyline points="10 17 15 12 10 7"/>
                  <line x1="15" y1="12" x2="3" y2="12"/>
                </svg>
                Zaloguj się używając swojego konta
              </>
            )}
          </button>

          {error && (
            <div style={{
              marginTop: 12, padding: '8px 12px',
              background: '#fff5f0', borderRadius: 6,
              border: '1px solid #fdd5b8', color: '#c94f02',
              fontSize: 12,
            }}>
              Błąd logowania — sprawdź czy serwis AD jest uruchomiony.
            </div>
          )}

          {/* ── Separator ─────────────────────────── */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            margin: '20px 0 16px',
          }}>
            <div style={{ flex: 1, height: 1, background: '#f2f0ed' }} />
            <span style={{ fontSize: 10.5, fontWeight: 600, color: '#b5afa8', whiteSpace: 'nowrap' }}>
              SYMULACJA KONT
            </span>
            <div style={{ flex: 1, height: 1, background: '#f2f0ed' }} />
          </div>

          {/* ── Kafelki użytkowników AD ───────────── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {SIM_USERS.map((u) => (
              <button
                key={u.login}
                onClick={() => handleLogin(u.login)}
                disabled={isPending}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '10px 12px', borderRadius: 8,
                  background: '#fafaf9', border: '1px solid #e3e0db',
                  cursor: isPending ? 'not-allowed' : 'pointer',
                  textAlign: 'left', fontFamily: 'inherit',
                  transition: 'border-color 0.12s, background 0.12s',
                  opacity: isPending ? 0.6 : 1,
                }}
                onMouseEnter={e => {
                  if (!isPending) {
                    (e.currentTarget as HTMLButtonElement).style.background = '#fff8f4'
                    ;(e.currentTarget as HTMLButtonElement).style.borderColor = '#f2b48a'
                  }
                }}
                onMouseLeave={e => {
                  if (!isPending) {
                    (e.currentTarget as HTMLButtonElement).style.background = '#fafaf9'
                    ;(e.currentTarget as HTMLButtonElement).style.borderColor = '#e3e0db'
                  }
                }}
              >
                <div style={{
                  width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
                  background: 'linear-gradient(135deg, #e85c04 0%, #c94f02 100%)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 11, fontWeight: 800, color: 'white',
                }}>
                  {u.initials}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#1a1714' }}>
                    {u.displayName}
                  </div>
                  <div style={{ fontSize: 11, color: '#9e9389' }}>
                    HRK\{u.login} · {u.department}
                  </div>
                </div>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#c9c4be" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="9 18 15 12 9 6"/>
                </svg>
              </button>
            ))}
          </div>
        </div>

        {/* ── Footer ────────────────────────────────── */}
        <p style={{ textAlign: 'center', fontSize: 11, color: '#b5afa8', marginTop: 20 }}>
          HRK Payroll Consulting · System wewnętrzny
        </p>
      </div>
    </div>
  )
}
