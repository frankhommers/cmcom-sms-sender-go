import { type FormEvent, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { LoaderCircle, LockKeyhole } from 'lucide-react'

import { login } from '@/lib/api'
import type { ApiError } from '@/lib/api'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { translateError } from '@/lib/i18n-errors'

type LoginFormProps = {
  authMode: string
  oidcLoginButtonText?: string
  onLoginSuccess: () => void
}

export function LoginForm({ authMode, oidcLoginButtonText, onLoginSuccess }: LoginFormProps) {
  const { t } = useTranslation()
  const [password, setPassword] = useState('')
  const [error, setError] = useState<ApiError | null>(null)
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
      setError(result.error ?? { code: 'invalid_password' })
      return
    }

    onLoginSuccess()
  }

  const handleOidc = () => {
    window.location.href = '/api/auth/oidc'
  }

  const oidcLabel = oidcLoginButtonText && oidcLoginButtonText.length > 0
    ? oidcLoginButtonText
    : t('login.oidcDefaultButton')

  return (
    <Card className="w-full max-w-[480px]">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-xl">
          <LockKeyhole className="size-5 text-indigo-600" />
          {t('login.title')}
        </CardTitle>
        <CardDescription>
          {authMode === 'password'
            ? t('login.descriptionPassword')
            : t('login.descriptionOidc')}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertTitle>{t('login.failed')}</AlertTitle>
            <AlertDescription>{translateError(t, error)}</AlertDescription>
          </Alert>
        )}

        {authMode === 'oidc' ? (
          <Button className="w-full" size="lg" onClick={handleOidc}>
            {oidcLabel}
          </Button>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3">
            <Input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder={t('login.passwordPlaceholder')}
              autoComplete="current-password"
              required
            />
            <Button className="w-full" size="lg" disabled={isLoading || password.length === 0}>
              {isLoading ? <LoaderCircle className="animate-spin" /> : null}
              {t('login.submit')}
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  )
}
