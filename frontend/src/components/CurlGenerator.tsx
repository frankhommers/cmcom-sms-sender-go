import { useMemo, useState } from 'react'
import { Check, Copy } from 'lucide-react'

import { Button } from '@/components/ui/button'

type CurlGeneratorProps = {
  sender: string
  recipients: string[]
  message: string
  token?: string
}

function normalizePhone(value: string): string {
  if (value.startsWith('+')) {
    return `00${value.slice(1)}`
  }
  return value
}

function shellSingleQuote(value: string): string {
  return value.replace(/'/g, `'"'"'`)
}

export function CurlGenerator({ sender, recipients, message, token }: CurlGeneratorProps) {
  const [copied, setCopied] = useState(false)

  const command = useMemo(() => {
    const to = (recipients.length > 0 ? recipients : ['0031612345678']).map((recipient) => ({
      number: normalizePhone(recipient),
    }))

    const payload = {
      messages: {
        msg: [
          {
            from: sender || 'YOUR-SENDER',
            to,
            body: {
              content: message || 'Hello from SMS Sender',
              type: 'AUTO',
            },
          },
        ],
      },
    }

    const body = shellSingleQuote(JSON.stringify(payload))

    return [
      "curl -X POST 'https://gw.cmtelecom.com/v1.0/message' \\",
      "  -H 'Content-Type: application/json' \\",
      `  -H 'X-CM-PRODUCTTOKEN: ${token || 'YOUR-PRODUCT-TOKEN-HERE'}' \\`,
      `  -d '${body}'`,
    ].join('\n')
  }, [sender, recipients, message, token])

  const handleCopy = async () => {
    await navigator.clipboard.writeText(command)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className="mt-3 rounded-lg border bg-slate-50 p-3">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-xs font-medium text-slate-700">Generated cURL</p>
        <Button type="button" variant="outline" size="sm" onClick={handleCopy}>
          {copied ? <Check /> : <Copy />}
          {copied ? 'Copied!' : 'Copy'}
        </Button>
      </div>
      <pre className="overflow-x-auto rounded-md bg-slate-950 p-3 text-xs leading-relaxed text-slate-100">
        <code>{command}</code>
      </pre>
    </div>
  )
}
