import type { TFunction } from 'i18next'

import type { ApiError } from '@/lib/api'

export function translateError(t: TFunction, error: ApiError | null | undefined): string {
  if (!error) {
    return t('errors.generic')
  }
  const key = `errors.${error.code}`
  const fallback = t('errors.generic')
  const translated = t(key, { ...error.params, defaultValue: fallback })
  return translated
}
