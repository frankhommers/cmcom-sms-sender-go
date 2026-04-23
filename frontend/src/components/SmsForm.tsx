import { type FormEvent, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { MessageSquarePlus, Send, TerminalSquare } from 'lucide-react'

import { CharCounter } from '@/components/CharCounter'
import { CurlGenerator } from '@/components/CurlGenerator'
import { DeliveryProgress } from '@/components/DeliveryProgress'
import { RecipientInput } from '@/components/RecipientInput'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useMultiStatusPolling } from '@/hooks/useStatusPolling'
import { sendSms } from '@/lib/api'
import type { ApiError } from '@/lib/api'
import { translateError } from '@/lib/i18n-errors'

type SmsFormProps = {
  defaultSender: string
  copyCurlEnabled: boolean
  copyCurlToken: string
  trackingReferences: string[] | null
  onTrackingReferencesChange: (references: string[] | null) => void
}

export function SmsForm({
  defaultSender,
  copyCurlEnabled,
  copyCurlToken,
  trackingReferences,
  onTrackingReferencesChange,
}: SmsFormProps) {
  const { t } = useTranslation()
  const [sender, setSender] = useState(defaultSender)
  const [recipients, setRecipients] = useState<string[]>([])
  const [message, setMessage] = useState('')
  const [error, setError] = useState<ApiError | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [isSending, setIsSending] = useState(false)
  const [showCurl, setShowCurl] = useState(false)

  const activeTrackingReferences = useMemo(() => trackingReferences ?? [], [trackingReferences])
  const polling = useMultiStatusPolling(activeTrackingReferences)

  const senderIsValid = useMemo(() => /^[a-zA-Z0-9]{1,11}$/.test(sender), [sender])
  const recipientsAreValid = useMemo(
    () =>
      recipients.length > 0 &&
      recipients.every((recipient) => /^\+?[1-9][0-9]{6,14}$/.test(recipient.replace(/\s+/g, ''))),
    [recipients],
  )
  const canSend = senderIsValid && recipientsAreValid && message.trim().length > 0

  const handleSend = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!canSend) {
      setError({ code: 'client_validation' })
      return
    }

    setError(null)
    setSuccessMessage(null)
    setIsSending(true)

    try {
      const result = await sendSms(sender, recipients, message)

      if (!result.success) {
        setError(result.error ?? { code: 'send_failed' })
        return
      }

      if (typeof result.successCount === 'number' && typeof result.recipientsCount === 'number') {
        setSuccessMessage(
          t('sms.sendSuccessCount', {
            success: result.successCount,
            total: result.recipientsCount,
          }),
        )
      } else {
        setSuccessMessage(t('sms.sendSuccess'))
      }

      const references = (result.results ?? [])
        .filter((recipientResult) => recipientResult.success && recipientResult.reference)
        .map((recipientResult) => recipientResult.reference)

      if (references.length > 0) {
        localStorage.setItem('sms_last_refs', JSON.stringify(references))
        onTrackingReferencesChange(references)
      }
    } catch {
      setError({ code: 'send_failed' })
    } finally {
      setIsSending(false)
    }
  }

  const stopTracking = () => {
    polling.stopPolling()
    localStorage.removeItem('sms_last_refs')
    onTrackingReferencesChange(null)
  }

  const errorMessage = (err: ApiError): string => {
    if (err.code === 'client_validation') {
      return t('sms.validation')
    }
    if (err.code === 'send_failed') {
      return t('sms.sendFailed')
    }
    return translateError(t, err)
  }

  return (
    <Card className="w-full max-w-[480px]">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-xl">
          <MessageSquarePlus className="size-5 text-indigo-600" />
          {t('sms.compose')}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSend} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="sender">{t('sms.sender')}</Label>
            <Input
              id="sender"
              maxLength={11}
              value={sender}
              onChange={(event) => setSender(event.target.value.replace(/[^a-zA-Z0-9]/g, ''))}
              placeholder={t('sms.senderPlaceholder')}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="recipients">{t('sms.recipients')}</Label>
            <RecipientInput recipients={recipients} onChange={setRecipients} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="message">{t('sms.message')}</Label>
            <Textarea
              id="message"
              rows={5}
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              placeholder={t('sms.messagePlaceholder')}
            />
            <CharCounter text={message} />
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertTitle>{t('sms.error')}</AlertTitle>
              <AlertDescription>{errorMessage(error)}</AlertDescription>
            </Alert>
          )}

          {successMessage && (
            <Alert>
              <AlertTitle>{t('sms.sent')}</AlertTitle>
              <AlertDescription>{successMessage}</AlertDescription>
            </Alert>
          )}

          <div className={`grid gap-2 ${copyCurlEnabled ? 'grid-cols-2' : 'grid-cols-1'}`}>
            <Button type="submit" disabled={isSending || !canSend}>
              <Send />
              {t('sms.send')}
            </Button>
            {copyCurlEnabled && (
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowCurl((value) => !value)}
              >
                <TerminalSquare />
                {t('sms.generateCurl')}
              </Button>
            )}
          </div>
        </form>

        {showCurl && copyCurlEnabled && (
          <CurlGenerator sender={sender} recipients={recipients} message={message} token={copyCurlToken} />
        )}

        {activeTrackingReferences.length > 0 && (
          <DeliveryProgress
            statuses={polling.statuses}
            isPolling={polling.isPolling}
            onStopTracking={stopTracking}
          />
        )}
      </CardContent>
    </Card>
  )
}
