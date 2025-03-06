"use client"
import { useState, useEffect } from "react"
import { ShieldAlert, Plus, Minus, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { toast } from "sonner"
import { InputMethodToggle } from "./input-method-toggle"
import { validateEthereumAddress } from "@/lib/validation"

interface DestinationWallet {
  address: string
  percentage: number
  isValid?: boolean
  error?: string
}

interface DestinationWalletsProps {
  wallets: DestinationWallet[]
  setWallets: (wallets: DestinationWallet[]) => void
  distributionMethod: "equal" | "percentage" | "custom"
}

export function DestinationWallets({ wallets, setWallets, distributionMethod }: DestinationWalletsProps) {
  const [inputMethod, setInputMethod] = useState<"individual" | "comma-separated">("comma-separated")
  const [commaSeparatedAddresses, setCommaSeparatedAddresses] = useState("")
  const [addressErrors, setAddressErrors] = useState<string[]>([])

  // Initialize comma-separated addresses from wallets
  useEffect(() => {
    if (inputMethod === "comma-separated") {
      setCommaSeparatedAddresses(
        wallets
          .map((w) => w.address)
          .filter((a) => a)
          .join(", "),
      )

      // Collect errors for display
      const errors = wallets
        .map((wallet, index) => (wallet.error && wallet.address ? `Address #${index + 1}: ${wallet.error}` : null))
        .filter((error) => error !== null) as string[]

      setAddressErrors(errors)
    }
  }, [inputMethod, wallets])

  // Handle changes to comma-separated input
  const handleCommaSeparatedChange = (value: string) => {
    setCommaSeparatedAddresses(value)

    // Parse addresses and update wallets
    const addresses = value
      .split(",")
      .map((addr) => addr.trim())
      .filter((addr) => addr)

    // Reset errors
    setAddressErrors([])

    // Create new wallets array with the parsed addresses
    let newWallets: DestinationWallet[] = []

    if (addresses.length > 0) {
      // Create wallets with appropriate percentages and validate each address
      if (distributionMethod === "equal") {
        const equalPercentage = 100 / addresses.length
        newWallets = addresses.map((address) => {
          const validation = validateEthereumAddress(address)
          return {
            address,
            percentage: equalPercentage,
            isValid: validation.isValid,
            error: validation.error,
          }
        })
      } else {
        // Try to preserve existing percentages where possible
        newWallets = addresses.map((address, index) => {
          const existingWallet = wallets.find((w) => w.address === address)
          const validation = validateEthereumAddress(address)
          return {
            address,
            percentage: existingWallet
              ? existingWallet.percentage
              : index < wallets.length
                ? wallets[index].percentage
                : 0,
            isValid: validation.isValid,
            error: validation.error,
          }
        })

        // Ensure percentages add up to 100%
        const totalPercentage = newWallets.reduce((sum, w) => sum + w.percentage, 0)
        if (Math.abs(totalPercentage - 100) > 0.01) {
          const equalPercentage = 100 / newWallets.length
          newWallets.forEach((w) => (w.percentage = equalPercentage))
        }
      }

      // Collect errors for display
      const errors = newWallets
        .map((wallet, index) => (wallet.error ? `Address #${index + 1}: ${wallet.error}` : null))
        .filter((error) => error !== null) as string[]

      setAddressErrors(errors)
    } else {
      // If no addresses, create a single empty wallet
      newWallets = [{ address: "", percentage: 100, isValid: true }]
    }

    setWallets(newWallets)
  }

  const addWallet = () => {
    // When adding a new wallet, distribute percentages evenly
    const newWallets = [...wallets, { address: "", percentage: 0, isValid: true }]

    if (distributionMethod === "equal") {
      const equalPercentage = 100 / newWallets.length
      newWallets.forEach((wallet) => {
        wallet.percentage = equalPercentage
      })
    } else if (distributionMethod === "percentage") {
      // Redistribute remaining percentage
      const lastWallet = newWallets[newWallets.length - 1]
      lastWallet.percentage = 0
    }

    setWallets(newWallets)
  }

  const removeWallet = (index: number) => {
    if (wallets.length > 1) {
      const newWallets = [...wallets]
      newWallets.splice(index, 1)

      if (distributionMethod === "equal") {
        const equalPercentage = 100 / newWallets.length
        newWallets.forEach((wallet) => {
          wallet.percentage = equalPercentage
        })
      }

      setWallets(newWallets)
    }
  }

  const updateWalletAddress = (index: number, value: string) => {
    const newWallets = [...wallets]
    newWallets[index].address = value

    // Validate the address if it's not empty
    if (value.trim()) {
      const validation = validateEthereumAddress(value)
      newWallets[index].isValid = validation.isValid
      newWallets[index].error = validation.error
    } else {
      // Empty is considered valid until submission
      newWallets[index].isValid = true
      newWallets[index].error = undefined
    }

    setWallets(newWallets)
  }

  const updateWalletPercentage = (index: number, value: string) => {
    // Allow empty string for better editing experience
    if (value === "") {
      const newWallets = [...wallets]
      newWallets[index].percentage = 0
      setWallets(newWallets)
      return
    }

    // Parse the input value
    const newValue = Number.parseFloat(value)

    // Validate the input is a number
    if (isNaN(newValue)) {
      return
    }

    // Calculate total percentage excluding current wallet
    const otherWalletsTotal = wallets.reduce((sum, wallet, i) => {
      return i !== index ? sum + wallet.percentage : sum
    }, 0)

    // Check if new value would exceed 100%
    if (otherWalletsTotal + newValue > 100) {
      // If exceeding, set to remaining available percentage
      const remainingPercentage = Math.max(0, 100 - otherWalletsTotal)
      const newWallets = [...wallets]
      newWallets[index].percentage = remainingPercentage
      setWallets(newWallets)

      // Show warning toast
      toast.warning("Total percentage cannot exceed 100%")
      return
    }

    const newWallets = [...wallets]
    newWallets[index].percentage = newValue
    setWallets(newWallets)
  }

  return (
    <Card className="border-green-200 dark:border-green-900/50 bg-white dark:bg-black/60 backdrop-blur-sm">
      <CardHeader>
        <CardTitle className="flex items-center text-green-700 dark:text-green-500">
          <ShieldAlert className="h-5 w-5 mr-2" />
          Destination Wallets
        </CardTitle>
        <CardDescription className="text-gray-600 dark:text-gray-400">
          Add wallets to receive the distributed funds
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <InputMethodToggle value={inputMethod} onChange={setInputMethod} label="Address Input Method" />

        {inputMethod === "comma-separated" ? (
          <div className="space-y-2">
            <Textarea
              placeholder="Enter wallet addresses separated by commas (e.g., 0x123...abc, 0x456...def, 0x789...ghi)"
              value={commaSeparatedAddresses}
              onChange={(e) => handleCommaSeparatedChange(e.target.value)}
              className={`min-h-[100px] bg-gray-50 border-green-200 focus:border-green-500 dark:bg-black/50 dark:border-green-900/50 dark:focus:border-green-500 ${
                addressErrors.length > 0
                  ? "border-red-300 dark:border-red-700 focus:border-red-500 dark:focus:border-red-500"
                  : ""
              }`}
            />
            {addressErrors.length > 0 && (
              <div className="text-red-500 text-sm space-y-1">
                {addressErrors.map((error, i) => (
                  <div key={i} className="flex items-start">
                    <AlertCircle className="h-4 w-4 mr-1 mt-0.5 flex-shrink-0" />
                    <span>{error}</span>
                  </div>
                ))}
              </div>
            )}
            {distributionMethod === "percentage" && wallets.length > 0 && (
              <div className="mt-4 space-y-2">
                <p className="text-sm font-medium">Percentage Distribution</p>
                {wallets.map((wallet, index) => (
                  <div key={index} className="flex items-center justify-between">
                    <span className="text-xs truncate max-w-[70%]">
                      {wallet.address ? wallet.address : `Wallet ${index + 1}`}
                    </span>
                    <div className="w-20 flex items-center">
                      <Input
                        type="text"
                        inputMode="decimal"
                        placeholder="%"
                        value={wallet.percentage === 0 && distributionMethod === "percentage" ? "" : wallet.percentage}
                        onChange={(e) => updateWalletPercentage(index, e.target.value)}
                        className="w-full bg-gray-50 border-green-200 focus:border-green-500 dark:bg-black/50 dark:border-green-900/50 dark:focus:border-green-500"
                      />
                      <span className="ml-1">%</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <>
            {wallets.map((wallet, index) => (
              <div key={index} className="space-y-1">
                <div className="flex items-center space-x-2">
                  <Input
                    placeholder={`Destination Wallet ${index + 1} (0x...)`}
                    value={wallet.address}
                    onChange={(e) => updateWalletAddress(index, e.target.value)}
                    className={`flex-1 bg-gray-50 border-green-200 focus:border-green-500 dark:bg-black/50 dark:border-green-900/50 dark:focus:border-green-500 ${
                      wallet.address && wallet.isValid === false
                        ? "border-red-300 dark:border-red-700 focus:border-red-500 dark:focus:border-red-500"
                        : ""
                    }`}
                  />
                  {distributionMethod === "percentage" && (
                    <div className="w-20 flex items-center">
                      <Input
                        type="text"
                        inputMode="decimal"
                        placeholder="%"
                        value={wallet.percentage === 0 && distributionMethod === "percentage" ? "" : wallet.percentage}
                        onChange={(e) => updateWalletPercentage(index, e.target.value)}
                        className="w-full bg-gray-50 border-green-200 focus:border-green-500 dark:bg-black/50 dark:border-green-900/50 dark:focus:border-green-500"
                      />
                      <span className="ml-1">%</span>
                    </div>
                  )}
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => removeWallet(index)}
                    disabled={wallets.length === 1}
                    className="border-green-200 hover:bg-green-50 hover:text-green-700 dark:border-green-900/50 dark:hover:bg-green-900/20 dark:hover:text-green-400"
                  >
                    <Minus className="h-4 w-4" />
                  </Button>
                </div>
                {wallet.address && wallet.isValid === false && (
                  <div className="text-red-500 text-xs flex items-center">
                    <AlertCircle className="h-3 w-3 mr-1" />
                    <span>{wallet.error}</span>
                  </div>
                )}
              </div>
            ))}
            <Button
              variant="outline"
              onClick={addWallet}
              className="w-full border-green-200 hover:bg-green-50 hover:text-green-700 dark:border-green-900/50 dark:hover:bg-green-900/20 dark:hover:text-green-400"
            >
              <Plus className="h-4 w-4 mr-2" /> Add Destination Wallet
            </Button>
          </>
        )}
      </CardContent>
      {inputMethod === "comma-separated" && (
        <CardFooter>
          <p className="text-xs text-gray-500 dark:text-gray-400 w-full text-center">
            Enter multiple wallet addresses separated by commas
          </p>
        </CardFooter>
      )}
    </Card>
  )
}

