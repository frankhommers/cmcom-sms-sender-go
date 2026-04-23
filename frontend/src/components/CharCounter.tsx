import { useTranslation } from 'react-i18next'

import { calculateSmsCount } from '@/lib/sms-utils'
import { cn } from '@/lib/utils'

type CharCounterProps = {
  text: string
}

export function CharCounter({ text }: CharCounterProps) {
  const { t } = useTranslation()
  const smsInfo = calculateSmsCount(text)

  return (
    <div className="mt-2 flex items-center justify-between text-xs">
      <span className="text-muted-foreground">
        {t('charCounter.characters', { count: smsInfo.chars })}{' '}
        {smsInfo.isUnicode ? t('charCounter.unicode') : t('charCounter.gsm7')}
      </span>
      <span
        className={cn(
          'font-medium',
          smsInfo.count > 3 && 'text-red-600',
          smsInfo.count > 1 && smsInfo.count <= 3 && 'text-indigo-600',
          smsInfo.count === 1 && 'text-muted-foreground',
        )}
      >
        {t('charCounter.sms', { count: smsInfo.count })}
      </span>
    </div>
  )
}
