import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { SUPPORTED_LANGUAGES, type SupportedLanguage } from '@/i18n'
import { cn } from '@/lib/utils'

export function LanguageSwitcher() {
  const { i18n, t } = useTranslation()
  const current = (i18n.resolvedLanguage ?? i18n.language ?? 'en').slice(0, 2) as SupportedLanguage

  return (
    <div
      role="group"
      aria-label={t('app.language.label')}
      className="inline-flex items-center gap-1 rounded-md border border-input bg-background p-0.5"
    >
      {SUPPORTED_LANGUAGES.map((lang) => {
        const isActive = current === lang
        return (
          <Button
            key={lang}
            type="button"
            size="xs"
            variant={isActive ? 'default' : 'ghost'}
            onClick={() => {
              if (!isActive) {
                void i18n.changeLanguage(lang)
              }
            }}
            className={cn('uppercase', isActive && 'pointer-events-none')}
            aria-pressed={isActive}
          >
            {t(`app.language.${lang}`)}
          </Button>
        )
      })}
    </div>
  )
}
