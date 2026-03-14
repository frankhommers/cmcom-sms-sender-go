import { calculateSmsCount } from '@/lib/sms-utils'
import { cn } from '@/lib/utils'

type CharCounterProps = {
  text: string
}

export function CharCounter({ text }: CharCounterProps) {
  const smsInfo = calculateSmsCount(text)

  return (
    <div className="mt-2 flex items-center justify-between text-xs">
      <span className="text-muted-foreground">
        {smsInfo.chars} characters {smsInfo.isUnicode ? '(Unicode)' : '(GSM-7)'}
      </span>
      <span
        className={cn(
          'font-medium',
          smsInfo.count > 3 && 'text-red-600',
          smsInfo.count > 1 && smsInfo.count <= 3 && 'text-indigo-600',
          smsInfo.count === 1 && 'text-muted-foreground',
        )}
      >
        {smsInfo.count} {smsInfo.count === 1 ? 'SMS' : 'SMS messages'}
      </span>
    </div>
  )
}
