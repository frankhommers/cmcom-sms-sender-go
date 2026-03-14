export type SendResult = {
  success: boolean
  message?: string
  error?: string
  results?: RecipientResult[]
}

export type RecipientResult = {
  recipient: string
  reference: string
  success: boolean
  error?: string
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
    throw new Error(`Request failed with status ${response.status}`)
  }

  return (await response.json()) as T
}

export async function login(
  password: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    return await requestJson<{ success: boolean; error?: string }>('/api/login', {
      method: 'POST',
      body: JSON.stringify({ password }),
    })
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Login failed',
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
  return requestJson<SendResult>('/api/sms/send', {
    method: 'POST',
    body: JSON.stringify({ sender, recipients, message }),
  })
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
