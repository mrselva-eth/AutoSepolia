"use client"

import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"

interface InputMethodToggleProps {
  value: "individual" | "comma-separated"
  onChange: (value: "individual" | "comma-separated") => void
  label?: string
}

export function InputMethodToggle({ value, onChange, label }: InputMethodToggleProps) {
  return (
    <div className="mb-4">
      <Label className="text-sm text-gray-600 dark:text-gray-400 mb-2 block">{label || "Input Method"}</Label>
      <RadioGroup
        value={value}
        onValueChange={(val) => onChange(val as "individual" | "comma-separated")}
        className="flex space-x-4"
      >
        <div className="flex items-center space-x-2">
          <RadioGroupItem value="comma-separated" id="comma-separated" className="border-green-500 text-green-600" />
          <Label htmlFor="comma-separated" className="cursor-pointer text-sm">
            Comma Separated
          </Label>
        </div>
        <div className="flex items-center space-x-2">
          <RadioGroupItem value="individual" id="individual" className="border-green-500 text-green-600" />
          <Label htmlFor="individual" className="cursor-pointer text-sm">
            Individual Inputs
          </Label>
        </div>
      </RadioGroup>
    </div>
  )
}

