"use client"

import { useState } from "react"
import { Eye, EyeOff } from "lucide-react"
import { Button } from "@/components/ui/button"

interface MaskedPrivateKeyProps {
  value: string
  className?: string
}

export function MaskedPrivateKey({ value, className = "" }: MaskedPrivateKeyProps) {
  const [showKey, setShowKey] = useState(false)

  if (!value) return null

  // Show first 6 and last 4 characters, mask the rest
  const maskedValue = showKey
    ? value
    : value.length > 10
      ? `${value.substring(0, 6)}...${value.substring(value.length - 4)}`
      : "••••••"

  return (
    <div className={`flex items-center ${className}`}>
      <code className="text-xs font-mono">{maskedValue}</code>
      <Button type="button" variant="ghost" size="sm" className="h-6 w-6 p-0 ml-1" onClick={() => setShowKey(!showKey)}>
        {showKey ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
        <span className="sr-only">{showKey ? "Hide" : "Show"} private key</span>
      </Button>
    </div>
  )
}

