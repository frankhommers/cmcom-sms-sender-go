import { type FormEvent, useState } from 'react'
import { LoaderCircle, LockKeyhole } from 'lucide-react'

import { login } from '@/lib/api'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'

type LoginFormProps = {
  authMode: string
  oidcLoginButtonText?: string
  onLoginSuccess: () => void
}

export function LoginForm({ authMode, oidcLoginButtonText = 'Sign in', onLoginSuccess }: LoginFormProps) {
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (authMode !== 'password') {
      return
    }

    setError(null)
    setIsLoading(true)
    const result = await login(password)
    setIsLoading(false)

    if (!result.success) {
      setError(result.error ?? 'Inloggen mislukt')
      return
    }

    onLoginSuccess()
  }

  const handleOidc = () => {
    window.location.href = '/api/auth/oidc'
  }

  return (
    <Card className="w-full max-w-[480px]">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-xl">
          <LockKeyhole className="size-5 text-indigo-600" />
          SMS Sender
        </CardTitle>
        <CardDescription>
          {authMode === 'password'
            ? 'Voer je wachtwoord in om verder te gaan.'
            : 'Sign in to continue.'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertTitle>Inloggen mislukt</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {authMode === 'oidc' ? (
          <Button className="w-full" size="lg" onClick={handleOidc}>
            {oidcLoginButtonText}
          </Button>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3">
            <Input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Password"
              autoComplete="current-password"
              required
            />
            <Button className="w-full" size="lg" disabled={isLoading || password.length === 0}>
              {isLoading ? <LoaderCircle className="animate-spin" /> : null}
              Login
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  )
}
