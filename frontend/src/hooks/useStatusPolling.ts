import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { checkStatus, checkStatusMulti, type StatusResult } from '@/lib/api'

const DEFINITIVE_STATUS_CODES = new Set([1, 2, 3])
const POLL_INTERVAL_MS = 2000
const POLL_TIMEOUT_MS = 300000

export type StatusDetails = StatusResult

type PollingState = {
  statusCode: number | null
  statusText: string
  details: StatusDetails | null
  isPolling: boolean
  stopPolling: () => void
}

export type RecipientStatus = {
  reference: string
  recipient: string
  statusCode: number | null
  statusText: string
  details: StatusDetails | null
}

export type MultiPollingState = {
  statuses: RecipientStatus[]
  isPolling: boolean
  allComplete: boolean
  stopPolling: () => void
}

function extractRecipientFromReference(reference: string): string {
  const parts = reference.split('-')
  if (parts.length < 3) {
    return reference
  }

  return parts.slice(2).join('-')
}

export function useStatusPolling(reference: string | null): PollingState {
  const { t } = useTranslation()
  const [statusCode, setStatusCode] = useState<number | null>(null)
  const [statusText, setStatusText] = useState(() => t('status.notStarted'))
  const [details, setDetails] = useState<StatusDetails | null>(null)
  const [isPolling, setIsPolling] = useState(false)

  const intervalRef = useRef<number | null>(null)
  const timeoutRef = useRef<number | null>(null)
  const timeoutReachedRef = useRef(false)

  const clearTimers = useCallback(() => {
    if (intervalRef.current !== null) {
      window.clearInterval(intervalRef.current)
      intervalRef.current = null
    }

    if (timeoutRef.current !== null) {
      window.clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
  }, [])

  const stopPolling = useCallback(() => {
    clearTimers()
    setIsPolling(false)
    if (!timeoutReachedRef.current) {
      setStatusText(t('status.trackingStopped'))
    }
  }, [clearTimers, t])

  useEffect(() => {
    if (!reference) {
      clearTimers()
      setStatusCode(null)
      setStatusText(t('status.notStarted'))
      setDetails(null)
      setIsPolling(false)
      timeoutReachedRef.current = false
      return
    }

    let active = true
    timeoutReachedRef.current = false
    setIsPolling(true)
    setStatusText(t('status.fetching'))

    const poll = async () => {
      if (!active) {
        return
      }

      try {
        const result = await checkStatus(reference)
        if (!active) {
          return
        }

        setDetails(result)
        setStatusCode(result.statusCode)
        setStatusText(result.status || t('status.unknown'))

        if (result.statusCode !== null && DEFINITIVE_STATUS_CODES.has(result.statusCode)) {
          localStorage.removeItem('sms_last_ref')
          clearTimers()
          setIsPolling(false)
        }
      } catch {
        if (!active) {
          return
        }

        setStatusText(t('status.checkFailedRetry'))
      }
    }

    void poll()

    intervalRef.current = window.setInterval(() => {
      void poll()
    }, POLL_INTERVAL_MS)

    timeoutRef.current = window.setTimeout(() => {
      if (!active) {
        return
      }

      timeoutReachedRef.current = true
      clearTimers()
      setIsPolling(false)
      setStatusText(t('status.timeoutReached'))
    }, POLL_TIMEOUT_MS)

    return () => {
      active = false
      clearTimers()
      setIsPolling(false)
    }
  }, [reference, clearTimers, t])

  return {
    statusCode,
    statusText,
    details,
    isPolling,
    stopPolling,
  }
}

export function useMultiStatusPolling(references: string[]): MultiPollingState {
  const { t } = useTranslation()
  const [statuses, setStatuses] = useState<RecipientStatus[]>([])
  const [isPolling, setIsPolling] = useState(false)
  const [allComplete, setAllComplete] = useState(false)

  const intervalRef = useRef<number | null>(null)
  const timeoutRef = useRef<number | null>(null)

  const clearTimers = useCallback(() => {
    if (intervalRef.current !== null) {
      window.clearInterval(intervalRef.current)
      intervalRef.current = null
    }

    if (timeoutRef.current !== null) {
      window.clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
  }, [])

  const stopPolling = useCallback(() => {
    clearTimers()
    setIsPolling(false)
    setStatuses((current) =>
      current.map((status) => {
        if (status.statusText === t('status.timeoutReached')) {
          return status
        }

        if (status.statusCode !== null && DEFINITIVE_STATUS_CODES.has(status.statusCode)) {
          return status
        }

        return {
          ...status,
          statusText: t('status.trackingStopped'),
        }
      }),
    )
  }, [clearTimers, t])

  useEffect(() => {
    if (references.length === 0) {
      clearTimers()
      setStatuses([])
      setIsPolling(false)
      setAllComplete(false)
      return
    }

    let active = true
    setAllComplete(false)
    setIsPolling(true)
    setStatuses(
      references.map((reference) => ({
        reference,
        recipient: extractRecipientFromReference(reference),
        statusCode: null,
        statusText: t('status.fetching'),
        details: null,
      })),
    )

    const poll = async () => {
      if (!active) {
        return
      }

      try {
        const result = await checkStatusMulti(references)
        if (!active) {
          return
        }

        const nextStatuses = references.map((reference) => {
          const statusResult = result.results[reference]

          if (!statusResult) {
            return {
              reference,
              recipient: extractRecipientFromReference(reference),
              statusCode: null,
              statusText: t('status.unknown'),
              details: null,
            }
          }

          return {
            reference,
            recipient: extractRecipientFromReference(reference),
            statusCode: statusResult.statusCode,
            statusText: statusResult.status || t('status.unknown'),
            details: statusResult,
          }
        })

        setStatuses(nextStatuses)

        const hasAllDefinitive =
          nextStatuses.length > 0 &&
          nextStatuses.every(
            (status) => status.statusCode !== null && DEFINITIVE_STATUS_CODES.has(status.statusCode),
          )

        if (hasAllDefinitive) {
          localStorage.removeItem('sms_last_refs')
          clearTimers()
          setIsPolling(false)
          setAllComplete(true)
        }
      } catch {
        if (!active) {
          return
        }

        setStatuses((current) =>
          current.map((status) => ({
            ...status,
            statusText: t('status.checkFailedRetry'),
          })),
        )
      }
    }

    void poll()

    intervalRef.current = window.setInterval(() => {
      void poll()
    }, POLL_INTERVAL_MS)

    timeoutRef.current = window.setTimeout(() => {
      if (!active) {
        return
      }

      clearTimers()
      setIsPolling(false)
      setStatuses((current) =>
        current.map((status) => {
          if (status.statusCode !== null && DEFINITIVE_STATUS_CODES.has(status.statusCode)) {
            return status
          }

          return {
            ...status,
            statusText: t('status.timeoutReached'),
          }
        }),
      )
    }, POLL_TIMEOUT_MS)

    return () => {
      active = false
      clearTimers()
      setIsPolling(false)
    }
  }, [references, clearTimers, t])

  return {
    statuses,
    isPolling,
    allComplete,
    stopPolling,
  }
}
