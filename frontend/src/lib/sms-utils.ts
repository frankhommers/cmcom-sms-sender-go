export type SmsInfo = {
  count: number
  chars: number
  isUnicode: boolean
  limit: number
  partLimit?: number
}

const GSM_BASIC_SET = new Set(
  "@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞ !\"#¤%&'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà".split(
    '',
  ),
)
const GSM_EXTENDED_SET = new Set('^{}\\[~]|€'.split(''))

export function hasUnicodeCharacters(text: string): boolean {
  for (const char of text) {
    if (!GSM_BASIC_SET.has(char) && !GSM_EXTENDED_SET.has(char)) {
      return true
    }
  }

  return false
}

export function calculateSmsCount(text: string): SmsInfo {
  if (text.length === 0) {
    return {
      count: 1,
      chars: 0,
      isUnicode: false,
      limit: 160,
    }
  }

  const isUnicode = hasUnicodeCharacters(text)
  const chars = text.length

  if (isUnicode) {
    if (chars <= 70) {
      return {
        count: 1,
        chars,
        isUnicode,
        limit: 70,
      }
    }

    const partLimit = 67
    return {
      count: Math.ceil(chars / partLimit),
      chars,
      isUnicode,
      limit: 70,
      partLimit,
    }
  }

  if (chars <= 160) {
    return {
      count: 1,
      chars,
      isUnicode,
      limit: 160,
    }
  }

  const partLimit = 153
  return {
    count: Math.ceil(chars / partLimit),
    chars,
    isUnicode,
    limit: 160,
    partLimit,
  }
}
