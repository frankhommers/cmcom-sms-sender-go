import { type FormEvent, useMemo, useState } from 'react'
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

type SmsFormProps = {
  defaultSender: string
  trackingReferences: string[] | null
  onTrackingReferencesChange: (references: string[] | null) => void
}

export function SmsForm({
  defaultSender,
  trackingReferences,
  onTrackingReferencesChange,
}: SmsFormProps) {
  const [sender, setSender] = useState(defaultSender)
  const [recipients, setRecipients] = useState<string[]>([])
  const [message, setMessage] = useState('')
  const [error, setError] = useState<string | null>(null)
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
      setError('Controleer afzender, ontvangers en bericht.')
      return
    }

    setError(null)
    setSuccessMessage(null)
    setIsSending(true)

    try {
      const result = await sendSms(sender, recipients, message)

      if (!result.success) {
        setError(result.error ?? 'SMS verzenden mislukt.')
        return
      }

      setSuccessMessage(result.message ?? 'SMS succesvol verzonden.')

      const references = (result.results ?? [])
        .filter((recipientResult) => recipientResult.success && recipientResult.reference)
        .map((recipientResult) => recipientResult.reference)

      if (references.length > 0) {
        localStorage.setItem('sms_last_refs', JSON.stringify(references))
        onTrackingReferencesChange(references)
      }
    } catch {
      setError('SMS verzenden mislukt.')
    } finally {
      setIsSending(false)
    }
  }

  const stopTracking = () => {
    polling.stopPolling()
    localStorage.removeItem('sms_last_refs')
    onTrackingReferencesChange(null)
  }

  return (
    <Card className="w-full max-w-[480px]">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-xl">
          <MessageSquarePlus className="size-5 text-indigo-600" />
          Compose SMS
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSend} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="sender">Sender</Label>
            <Input
              id="sender"
              maxLength={11}
              value={sender}
              onChange={(event) => setSender(event.target.value.replace(/[^a-zA-Z0-9]/g, ''))}
              placeholder="CompanyName"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="recipients">Recipients</Label>
            <RecipientInput recipients={recipients} onChange={setRecipients} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="message">Message</Label>
            <Textarea
              id="message"
              rows={5}
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              placeholder="Typ je SMS-bericht"
            />
            <CharCounter text={message} />
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertTitle>Fout</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {successMessage && (
            <Alert>
              <AlertTitle>Verzonden</AlertTitle>
              <AlertDescription>{successMessage}</AlertDescription>
            </Alert>
          )}

          <div className="grid grid-cols-2 gap-2">
            <Button type="submit" disabled={isSending || !canSend}>
              <Send />
              Send SMS
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowCurl((value) => !value)}
            >
              <TerminalSquare />
              Genereer cURL
            </Button>
          </div>
        </form>

        {showCurl && <CurlGenerator sender={sender} recipients={recipients} message={message} />}

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
