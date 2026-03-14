import { CheckCircle2, Circle, CircleAlert, LoaderCircle, XCircle } from 'lucide-react'
import { Fragment } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import type { RecipientStatus } from '@/hooks/useStatusPolling'
import { cn } from '@/lib/utils'

type StatusTone = 'pending' | 'active' | 'completed' | 'failed'

type DeliveryProgressProps = {
  statuses: RecipientStatus[]
  isPolling: boolean
  onStopTracking: () => void
}

const STEP_LABELS = ['Verzenden', 'Geaccepteerd', 'Afgeleverd']

function deriveStepStates(statusCode: number | null): StatusTone[] {
  if (statusCode === null) {
    return ['active', 'pending', 'pending']
  }

  if (statusCode === 0) {
    return ['completed', 'active', 'pending']
  }

  if (statusCode === 2) {
    return ['completed', 'completed', 'completed']
  }

  if (statusCode === 1 || statusCode === 3) {
    return ['completed', 'failed', 'pending']
  }

  return ['active', 'pending', 'pending']
}

function iconForState(state: StatusTone) {
  if (state === 'completed') {
    return <CheckCircle2 className="size-4" />
  }
  if (state === 'failed') {
    return <XCircle className="size-4" />
  }
  if (state === 'active') {
    return <LoaderCircle className="size-4 animate-spin" />
  }
  return <Circle className="size-4" />
}

function stepClassName(state: StatusTone): string {
  return cn(
    'flex h-9 w-9 items-center justify-center rounded-full border transition-colors',
    state === 'pending' && 'border-slate-300 bg-slate-50 text-slate-400',
    state === 'active' && 'border-indigo-400 bg-indigo-50 text-indigo-600 shadow-sm shadow-indigo-200 animate-pulse',
    state === 'completed' && 'border-emerald-500 bg-emerald-50 text-emerald-600',
    state === 'failed' && 'border-red-500 bg-red-50 text-red-600',
  )
}

export function DeliveryProgress({
  statuses,
  isPolling,
  onStopTracking,
}: DeliveryProgressProps) {
  const hasFailed = statuses.some((status) => status.statusCode === 1 || status.statusCode === 3)
  const allDelivered = statuses.length > 0 && statuses.every((status) => status.statusCode === 2)
  const statusText = statuses.map((status) => `${status.recipient}: ${status.statusText}`).join(' | ')

  return (
    <div className="mt-4 rounded-lg border bg-background p-4">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold">Delivery status</h3>
          {hasFailed ? (
            <Badge variant="destructive">Failed</Badge>
          ) : allDelivered ? (
            <Badge className="bg-emerald-600 text-white">Delivered</Badge>
          ) : (
            <Badge variant="outline">In progress</Badge>
          )}
        </div>
        <Button type="button" size="sm" variant="outline" onClick={onStopTracking}>
          Stop Tracking
        </Button>
      </div>

      <div className="space-y-3">
        {statuses.map((recipientStatus) => {
          const states = deriveStepStates(recipientStatus.statusCode)

          return (
            <div key={recipientStatus.reference} className="rounded-md border border-slate-200 p-3">
              <div className="mb-2 flex items-center justify-between gap-3">
                <span className="text-xs font-semibold text-slate-700">{recipientStatus.recipient}</span>
                <span className="text-[11px] text-slate-500">{recipientStatus.statusText}</span>
              </div>

              <div className="grid grid-cols-[1fr_auto_1fr_auto_1fr] items-center gap-2">
                {STEP_LABELS.map((label, index) => (
                  <Fragment key={`${recipientStatus.reference}-${label}`}>
                    <div className="flex flex-col items-center gap-1 text-center">
                      <div className={stepClassName(states[index])}>{iconForState(states[index])}</div>
                      <span
                        className={cn(
                          'text-[10px] font-medium',
                          states[index] === 'pending' && 'text-slate-400',
                          states[index] === 'active' && 'text-indigo-700',
                          states[index] === 'completed' && 'text-emerald-700',
                          states[index] === 'failed' && 'text-red-700',
                        )}
                      >
                        {label}
                      </span>
                    </div>
                    {index < STEP_LABELS.length - 1 && (
                      <Separator
                        orientation="horizontal"
                        className={cn(
                          'h-px',
                          states[index] === 'completed' ? 'bg-emerald-400' : 'bg-slate-200',
                        )}
                      />
                    )}
                  </Fragment>
                ))}
              </div>

              {recipientStatus.details && (
                <details className="mt-2">
                  <summary className="cursor-pointer text-[11px] font-medium text-slate-600">
                    Delivery details
                  </summary>
                  <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-[11px] text-slate-700">
                    {recipientStatus.details.operator && (
                      <span>Operator: {recipientStatus.details.operator}</span>
                    )}
                    {recipientStatus.details.country && (
                      <span>Country: {recipientStatus.details.country}</span>
                    )}
                    {typeof recipientStatus.details.price === 'number' && (
                      <span>
                        Price: {recipientStatus.details.price} {recipientStatus.details.currency ?? ''}
                      </span>
                    )}
                    {typeof recipientStatus.details.deliveryTime === 'number' && (
                      <span>Delivery time: {recipientStatus.details.deliveryTime} ms</span>
                    )}
                  </div>
                </details>
              )}
            </div>
          )
        })}
      </div>

      <div className="mt-4 rounded-md bg-slate-50 p-3 text-xs text-slate-700">
        <div className="flex items-center gap-2">
          <CircleAlert className="size-3.5 text-slate-500" />
          <span>
            <strong>Status:</strong> {statusText}
          </span>
          {!isPolling && <span className="text-slate-500">(tracking stopped)</span>}
        </div>
      </div>
    </div>
  )
}
