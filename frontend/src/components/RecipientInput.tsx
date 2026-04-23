import { type KeyboardEvent, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { X } from 'lucide-react'

type RecipientInputProps = {
  recipients: string[]
  onChange: (recipients: string[]) => void
}

const VALID_RECIPIENT_PATTERN = /^[+\d ]+$/

function normalizeRecipient(value: string): string {
  return value.replace(/\s+/g, '')
}

export function RecipientInput({ recipients, onChange }: RecipientInputProps) {
  const { t } = useTranslation()
  const [inputValue, setInputValue] = useState('')

  const remove = (recipient: string) => {
    onChange(recipients.filter((value) => value !== recipient))
  }

  const tryAddRecipient = () => {
    const trimmed = inputValue.trim()
    if (trimmed.length === 0) {
      setInputValue('')
      return
    }

    if (!VALID_RECIPIENT_PATTERN.test(trimmed)) {
      return
    }

    const normalized = normalizeRecipient(trimmed)
    if (normalized.length === 0 || recipients.includes(normalized)) {
      setInputValue('')
      return
    }

    onChange([...recipients, normalized])
    setInputValue('')
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' || event.key === ',' || event.key === 'Tab') {
      event.preventDefault()
      tryAddRecipient()
      return
    }

    if (event.key === 'Backspace' && inputValue.length === 0 && recipients.length > 0) {
      event.preventDefault()
      onChange(recipients.slice(0, -1))
    }
  }

  return (
    <div className="flex min-h-10 flex-wrap items-center gap-1.5 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2">
      {recipients.map((recipient) => (
        <span
          key={recipient}
          className="inline-flex items-center gap-1 rounded-full bg-indigo-100 px-2.5 py-0.5 text-xs font-medium text-indigo-800"
        >
          {recipient}
          <button
            type="button"
            onClick={() => remove(recipient)}
            className="ml-0.5 rounded-full hover:bg-indigo-200"
            aria-label={t('sms.recipientRemove', { recipient })}
          >
            <X className="size-3" />
          </button>
        </span>
      ))}
      <input
        id="recipients"
        className="min-w-[120px] flex-1 bg-transparent outline-none placeholder:text-muted-foreground"
        value={inputValue}
        onChange={(event) => setInputValue(event.target.value.replace(/[^\d+ ]/g, ''))}
        onKeyDown={handleKeyDown}
        onBlur={tryAddRecipient}
        placeholder={recipients.length === 0 ? t('sms.recipientPlaceholder') : ''}
      />
    </div>
  )
}
