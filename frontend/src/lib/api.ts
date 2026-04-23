export type ApiError = {
  code: string
  params?: Record<string, string | number>
}

export type SendResult = {
  success: boolean
  successCount?: number
  recipientsCount?: number
  error?: ApiError
  results?: RecipientResult[]
}

export type RecipientResult = {
  recipient: string
  reference: string
  success: boolean
  error?: ApiError
}

export type StatusResult = {
  success: boolean
  statusCode: number | null
  status: string
  operator?: string
  country?: string
  price?: number
  currency?: string
  deliveryTime?: number
}

export type MultiStatusResult = {
  results: Record<string, StatusResult>
}

type AuthStatus = {
  authenticated: boolean
  authMode: string
}

type ConfigResult = {
  defaultSender: string
  authMode: string
  oidcSkipLoginPage: boolean
  oidcLoginButtonText: string
  copyCurlEnabled: boolean
  copyCurlToken: string
}

type RawError =
  | string
  | {
      code?: string
      params?: Record<string, string | number>
    }
  | undefined

function normalizeError(raw: RawError, fallbackCode = 'generic'): ApiError {
  if (!raw) {
    return { code: fallbackCode }
  }
  if (typeof raw === 'string') {
    return { code: fallbackCode, params: { detail: raw } }
  }
  if (typeof raw === 'object' && typeof raw.code === 'string') {
    return { code: raw.code, params: raw.params }
  }
  return { code: fallbackCode }
}

async function requestJson<T>(input: string, init?: RequestInit): Promise<T> {
  const response = await fetch(input, {
    credentials: 'same-origin',
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  })

  if (!response.ok) {
    let payload: unknown = null
    try {
      payload = await response.json()
    } catch {
      // ignore
    }
    const err = new Error(`Request failed with status ${response.status}`) as Error & {
      apiError?: ApiError
    }
    if (payload && typeof payload === 'object' && 'error' in (payload as Record<string, unknown>)) {
      err.apiError = normalizeError((payload as { error: RawError }).error, 'network')
    } else {
      err.apiError = { code: 'network' }
    }
    throw err
  }

  return (await response.json()) as T
}

type RawSendResult = {
  success: boolean
  successCount?: number
  recipientsCount?: number
  error?: RawError
  results?: Array<{
    recipient: string
    reference: string
    success: boolean
    error?: RawError
  }>
}

export async function login(
  password: string,
): Promise<{ success: boolean; error?: ApiError }> {
  try {
    const raw = await requestJson<{ success: boolean; error?: RawError }>('/api/login', {
      method: 'POST',
      body: JSON.stringify({ password }),
    })
    return {
      success: raw.success,
      error: raw.error ? normalizeError(raw.error, 'generic') : undefined,
    }
  } catch (error) {
    const apiError = (error as { apiError?: ApiError }).apiError
    return {
      success: false,
      error: apiError ?? { code: 'network' },
    }
  }
}

export async function logout(): Promise<void> {
  await requestJson('/api/logout', {
    method: 'POST',
    body: JSON.stringify({}),
  })
}

export async function getAuthStatus(): Promise<AuthStatus> {
  return requestJson<AuthStatus>('/api/auth/status', {
    method: 'GET',
  })
}

export async function getConfig(): Promise<ConfigResult> {
  return requestJson<ConfigResult>('/api/config', {
    method: 'GET',
  })
}

export async function sendSms(
  sender: string,
  recipients: string[],
  message: string,
): Promise<SendResult> {
  try {
    const raw = await requestJson<RawSendResult>('/api/sms/send', {
      method: 'POST',
      body: JSON.stringify({ sender, recipients, message }),
    })
    return {
      success: raw.success,
      successCount: raw.successCount,
      recipientsCount: raw.recipientsCount,
      error: raw.error ? normalizeError(raw.error, 'generic') : undefined,
      results: raw.results?.map((recipientResult) => ({
        recipient: recipientResult.recipient,
        reference: recipientResult.reference,
        success: recipientResult.success,
        error: recipientResult.error
          ? normalizeError(recipientResult.error, 'generic')
          : undefined,
      })),
    }
  } catch (error) {
    const apiError = (error as { apiError?: ApiError }).apiError
    return {
      success: false,
      error: apiError ?? { code: 'network' },
    }
  }
}

export async function checkStatusMulti(references: string[]): Promise<MultiStatusResult> {
  const params = new URLSearchParams({ refs: references.join(',') })

  return requestJson<MultiStatusResult>(`/api/sms/status?${params.toString()}`, {
    method: 'GET',
  })
}

export async function checkStatus(reference: string): Promise<StatusResult> {
  const params = new URLSearchParams({ ref: reference })

  return requestJson<StatusResult>(`/api/sms/status?${params.toString()}`, {
    method: 'GET',
  })
}
