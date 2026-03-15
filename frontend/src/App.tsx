import { useEffect, useState } from 'react'
import { LogOut, RotateCcw, X } from 'lucide-react'

import { LoginForm } from '@/components/LoginForm'
import { SmsForm } from '@/components/SmsForm'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { getAuthStatus, getConfig, logout } from '@/lib/api'

type AuthState = {
  loading: boolean
  authenticated: boolean
  authMode: string
  defaultSender: string
  oidcSkipLoginPage: boolean
  oidcLoginButtonText: string
}

function App() {
  const [authState, setAuthState] = useState<AuthState>({
    loading: true,
    authenticated: false,
    authMode: 'password',
    defaultSender: '',
    oidcSkipLoginPage: false,
    oidcLoginButtonText: 'Sign in',
  })
  const [trackingReferences, setTrackingReferences] = useState<string[] | null>(null)
  const [resumeReferences, setResumeReferences] = useState<string[] | null>(null)

  const loadInitial = async () => {
    try {
      const [auth, config] = await Promise.all([getAuthStatus(), getConfig()])
      setAuthState({
        loading: false,
        authenticated: auth.authenticated,
        authMode: auth.authMode || config.authMode || 'password',
        defaultSender: config.defaultSender || '',
        oidcSkipLoginPage: config.oidcSkipLoginPage ?? false,
        oidcLoginButtonText: config.oidcLoginButtonText || 'Sign in',
      })
    } catch {
      setAuthState((prev) => ({
        ...prev,
        loading: false,
      }))
    }
  }

  useEffect(() => {
    void loadInitial()

    const rawLastReferences = localStorage.getItem('sms_last_refs')
    if (rawLastReferences) {
      try {
        const parsed = JSON.parse(rawLastReferences)
        if (Array.isArray(parsed) && parsed.every((value) => typeof value === 'string')) {
          setResumeReferences(parsed)
        }
      } catch {
        localStorage.removeItem('sms_last_refs')
      }
    }
  }, [])

  const handleLogout = async () => {
    await logout()
    localStorage.removeItem('sms_last_refs')
    setTrackingReferences(null)
    setResumeReferences(null)
    setAuthState((prev) => ({ ...prev, authenticated: false }))
  }

  const handleResumeTracking = () => {
    const rawLastReferences = localStorage.getItem('sms_last_refs')
    if (!rawLastReferences) {
      return
    }

    try {
      const parsed = JSON.parse(rawLastReferences)
      if (Array.isArray(parsed) && parsed.every((value) => typeof value === 'string')) {
        setTrackingReferences(parsed)
        setResumeReferences(parsed)
      }
    } catch {
      localStorage.removeItem('sms_last_refs')
    }
  }

  const dismissResumeTracking = () => {
    localStorage.removeItem('sms_last_refs')
    setTrackingReferences(null)
    setResumeReferences(null)
  }

  useEffect(() => {
    if (
      !authState.loading &&
      !authState.authenticated &&
      authState.authMode === 'oidc' &&
      authState.oidcSkipLoginPage
    ) {
      window.location.href = '/api/auth/oidc'
    }
  }, [authState.loading, authState.authenticated, authState.authMode, authState.oidcSkipLoginPage])

  if (authState.loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gradient-to-b from-slate-50 via-white to-slate-100 p-4">
        <p className="text-sm text-muted-foreground">Loading SMS Sender...</p>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-indigo-50 via-white to-slate-100 p-4">
      <div className="mx-auto flex w-full max-w-[480px] flex-col gap-3 py-10">
        {authState.authenticated && (
          <header className="flex items-center justify-end">
            <Button variant="outline" onClick={handleLogout}>
              <LogOut />
              Logout
            </Button>
          </header>
        )}

        {authState.authenticated &&
          resumeReferences &&
          resumeReferences.length > 0 &&
          (!trackingReferences || trackingReferences.length === 0) && (
          <Card className="cursor-pointer border-indigo-200 bg-indigo-50/60" onClick={handleResumeTracking}>
            <CardContent className="flex items-center justify-between pt-4">
              <div className="flex items-center gap-2 text-sm text-indigo-700">
                <RotateCcw className="size-4" />
                Laatste SMS tracken ({resumeReferences.length} ontvangers)
              </div>
              <Button
                type="button"
                size="icon-sm"
                variant="ghost"
                onClick={(event) => {
                  event.stopPropagation()
                  dismissResumeTracking()
                }}
              >
                <X className="size-4" />
              </Button>
            </CardContent>
          </Card>
        )}

        {authState.authenticated ? (
          <SmsForm
            defaultSender={authState.defaultSender}
            trackingReferences={trackingReferences}
            onTrackingReferencesChange={(references) => {
              setTrackingReferences(references)
              setResumeReferences(references)
            }}
          />
        ) : (
          <LoginForm
            authMode={authState.authMode}
            oidcLoginButtonText={authState.oidcLoginButtonText}
            onLoginSuccess={() => {
              setAuthState((prev) => ({ ...prev, authenticated: true }))
            }}
          />
        )}
      </div>
    </main>
  )
}

export default App
