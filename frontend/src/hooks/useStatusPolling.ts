import { useCallback, useEffect, useRef, useState } from 'react'

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
  const [statusCode, setStatusCode] = useState<number | null>(null)
  const [statusText, setStatusText] = useState('Nog niet gestart')
  const [details, setDetails] = useState<StatusDetails | null>(null)
  const [isPolling, setIsPolling] = useState(false)

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
    setStatusText((current) =>
      current === 'Timeout bereikt' ? current : 'Tracking gestopt',
    )
  }, [clearTimers])

  useEffect(() => {
    if (!reference) {
      clearTimers()
      setStatusCode(null)
      setStatusText('Nog niet gestart')
      setDetails(null)
      setIsPolling(false)
      return
    }

    let active = true
    setIsPolling(true)
    setStatusText('Status ophalen...')

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
        setStatusText(result.status || 'Onbekende status')

        if (result.statusCode !== null && DEFINITIVE_STATUS_CODES.has(result.statusCode)) {
          localStorage.removeItem('sms_last_ref')
          clearTimers()
          setIsPolling(false)
        }
      } catch {
        if (!active) {
          return
        }

        setStatusText('Status check mislukt, opnieuw proberen...')
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
      setStatusText('Timeout bereikt')
    }, POLL_TIMEOUT_MS)

    return () => {
      active = false
      clearTimers()
      setIsPolling(false)
    }
  }, [reference, clearTimers])

  return {
    statusCode,
    statusText,
    details,
    isPolling,
    stopPolling,
  }
}

export function useMultiStatusPolling(references: string[]): MultiPollingState {
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
        if (status.statusText === 'Timeout bereikt') {
          return status
        }

        if (status.statusCode !== null && DEFINITIVE_STATUS_CODES.has(status.statusCode)) {
          return status
        }

        return {
          ...status,
          statusText: 'Tracking gestopt',
        }
      }),
    )
  }, [clearTimers])

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
        statusText: 'Status ophalen...',
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
              statusText: 'Onbekende status',
              details: null,
            }
          }

          return {
            reference,
            recipient: extractRecipientFromReference(reference),
            statusCode: statusResult.statusCode,
            statusText: statusResult.status || 'Onbekende status',
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
            statusText: 'Status check mislukt, opnieuw proberen...',
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
            statusText: 'Timeout bereikt',
          }
        }),
      )
    }, POLL_TIMEOUT_MS)

    return () => {
      active = false
      clearTimers()
      setIsPolling(false)
    }
  }, [references, clearTimers])

  return {
    statuses,
    isPolling,
    allComplete,
    stopPolling,
  }
}
