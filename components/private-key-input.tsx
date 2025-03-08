"use client"

import { useState } from "react"
import { Eye, EyeOff } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"

interface PrivateKeyInputProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
  isInvalid?: boolean
}

export function PrivateKeyInput({
  value,
  onChange,
  placeholder = "Private Key",
  className = "",
  isInvalid = false,
}: PrivateKeyInputProps) {
  const [showKey, setShowKey] = useState(false)

  return (
    <div className="relative flex-1">
      <Input
        type={showKey ? "text" : "password"}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`pr-8 font-mono ${className} ${
          isInvalid ? "border-red-300 dark:border-red-700 focus:border-red-500 dark:focus:border-red-500" : ""
        }`}
      />
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="absolute right-2 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0"
        onClick={() => setShowKey(!showKey)}
      >
        {showKey ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
        <span className="sr-only">{showKey ? "Hide" : "Show"} private key</span>
      </Button>
    </div>
  )
}

