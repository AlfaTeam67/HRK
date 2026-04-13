import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { useKeycloak } from '@/features/auth/hooks/useKeycloak'

export function AuthStatusCard() {
  const { token, login } = useAuth()
  const keycloak = useKeycloak()
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const handleLoginClick = async () => {
    try {
      await login()
      setErrorMessage(null)
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Login failed.')
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Auth status</CardTitle>
        <CardDescription>{keycloak.reason}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm">Status: {token ? 'authenticated' : 'not authenticated'}</p>
        {errorMessage ? <p className="text-sm text-destructive">{errorMessage}</p> : null}
        <Button type="button" onClick={() => void handleLoginClick()}>
          Demo login
        </Button>
      </CardContent>
    </Card>
  )
}
