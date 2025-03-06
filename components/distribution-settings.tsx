"use client"

import { motion } from "framer-motion"
import { Settings, Play, Square, ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import { NetworkStatus } from "@/components/network-status"
import { Slider } from "@/components/ui/slider"

interface DistributionWallet {
  address: string
  percentage: number
}

interface DistributionSettingsProps {
  distributionMethod: "equal" | "percentage" | "custom"
  setDistributionMethod: (method: "equal" | "percentage" | "custom") => void
  destinationWallets: DistributionWallet[]
  setDestinationWallets: (wallets: DistributionWallet[]) => void
  isRunning: boolean
  onStart: () => void
  onStop: () => void
}

export function DistributionSettings({
  distributionMethod,
  setDistributionMethod,
  destinationWallets,
  setDestinationWallets,
  isRunning,
  onStart,
  onStop,
}: DistributionSettingsProps) {
  const handleMethodChange = (value: string) => {
    const method = value as "equal" | "percentage" | "custom"
    setDistributionMethod(method)

    // Update percentages based on the selected method
    const updatedWallets = [...destinationWallets]

    if (method === "equal") {
      const equalPercentage = 100 / updatedWallets.length
      updatedWallets.forEach((wallet) => {
        wallet.percentage = equalPercentage
      })
    }

    setDestinationWallets(updatedWallets)
  }

  const handleSliderChange = (index: number, value: number[]) => {
    const newPercentage = value[0]
    const updatedWallets = [...destinationWallets]

    // Calculate how much we need to adjust other wallets
    const oldPercentage = updatedWallets[index].percentage
    const difference = newPercentage - oldPercentage

    // Set the new percentage for this wallet
    updatedWallets[index].percentage = newPercentage

    // Adjust other wallets proportionally
    if (difference !== 0) {
      const otherWallets = updatedWallets.filter((_, i) => i !== index)
      const totalOtherPercentage = otherWallets.reduce((sum, w) => sum + w.percentage, 0)

      if (totalOtherPercentage > 0) {
        otherWallets.forEach((wallet) => {
          const ratio = wallet.percentage / totalOtherPercentage
          const adjustment = difference * ratio * -1
          wallet.percentage += adjustment
        })
      }
    }

    // Ensure we have exactly 100%
    const total = updatedWallets.reduce((sum, w) => sum + w.percentage, 0)
    if (Math.abs(total - 100) > 0.01) {
      const adjustment = (100 - total) / (updatedWallets.length - 1)
      updatedWallets.forEach((wallet, i) => {
        if (i !== index) {
          wallet.percentage += adjustment
        }
      })
    }

    // Round to 2 decimal places
    updatedWallets.forEach((wallet) => {
      wallet.percentage = Math.round(wallet.percentage * 100) / 100
    })

    setDestinationWallets(updatedWallets)
  }

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <Card className="border-green-200 dark:border-green-900/50 bg-white dark:bg-black/60 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="flex items-center text-green-700 dark:text-green-500">
            <Settings className="h-5 w-5 mr-2" />
            Distribution Method
          </CardTitle>
          <CardDescription className="text-gray-600 dark:text-gray-400">
            Choose how to distribute funds across destination wallets
          </CardDescription>
        </CardHeader>
        <CardContent>
          <RadioGroup value={distributionMethod} onValueChange={handleMethodChange} className="space-y-4">
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="equal" id="equal" className="border-green-500 text-green-600" />
              <Label htmlFor="equal" className="cursor-pointer">
                <div className="font-medium">Equal Distribution</div>
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  Split funds equally between all destination wallets
                </div>
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="percentage" id="percentage" className="border-green-500 text-green-600" />
              <Label htmlFor="percentage" className="cursor-pointer">
                <div className="font-medium">Percentage-based</div>
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  Specify exact percentages for each destination wallet
                </div>
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="custom" id="custom" className="border-green-500 text-green-600" />
              <Label htmlFor="custom" className="cursor-pointer">
                <div className="font-medium">Custom Distribution</div>
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  Use sliders to visually adjust the distribution
                </div>
              </Label>
            </div>
          </RadioGroup>
        </CardContent>
        <CardFooter className="flex flex-col space-y-4">
          <NetworkStatus />
          <Button
            onClick={isRunning ? onStop : onStart}
            disabled={destinationWallets.length === 0 || destinationWallets.some((w) => !w.address)}
            className={`w-full ${
              isRunning
                ? "bg-red-500 hover:bg-red-600 dark:bg-red-900/80 dark:hover:bg-red-800"
                : "bg-green-600 hover:bg-green-700 dark:bg-gradient-to-r dark:from-green-600 dark:to-emerald-600 dark:hover:from-green-500 dark:hover:to-emerald-500"
            }`}
          >
            {isRunning ? (
              <>
                <Square className="h-4 w-4 mr-2" /> Stop Transfer
              </>
            ) : (
              <>
                <Play className="h-4 w-4 mr-2" /> Start Transfer
              </>
            )}
          </Button>
        </CardFooter>
      </Card>

      <Card className="border-green-200 dark:border-green-900/50 bg-white dark:bg-black/60 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="flex items-center text-green-700 dark:text-green-500">
            <ArrowRight className="h-5 w-5 mr-2" />
            Distribution Preview
          </CardTitle>
          <CardDescription className="text-gray-600 dark:text-gray-400">
            Visual representation of how funds will be distributed
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {distributionMethod === "custom" ? (
            <div className="space-y-6">
              {destinationWallets.map((wallet, index) => (
                <div key={index} className="space-y-2">
                  <div className="flex justify-between">
                    <Label className="text-sm truncate max-w-[200px]">
                      {wallet.address ? wallet.address : `Wallet ${index + 1}`}
                    </Label>
                    <span className="text-sm font-medium">{wallet.percentage.toFixed(1)}%</span>
                  </div>
                  <Slider
                    value={[wallet.percentage]}
                    min={0}
                    max={100}
                    step={0.1}
                    onValueChange={(value) => handleSliderChange(index, value)}
                    className="cursor-pointer"
                  />
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-4">
              {destinationWallets.map((wallet, index) => (
                <motion.div
                  key={index}
                  initial={{ width: 0 }}
                  animate={{ width: `${wallet.percentage}%` }}
                  transition={{ duration: 0.5 }}
                  className="relative h-12 rounded-md overflow-hidden"
                >
                  <div
                    className="absolute inset-0 bg-green-100 dark:bg-green-900/40 rounded-md"
                    style={{ width: `${wallet.percentage}%` }}
                  />
                  <div className="absolute inset-0 flex items-center justify-between px-3">
                    <span className="text-sm font-medium truncate max-w-[200px]">
                      {wallet.address
                        ? wallet.address.substring(0, 8) + "..." + wallet.address.substring(wallet.address.length - 6)
                        : `Wallet ${index + 1}`}
                    </span>
                    <span className="text-sm font-medium">{wallet.percentage.toFixed(1)}%</span>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </CardContent>
        <CardFooter>
          <div className="text-xs text-gray-500 dark:text-gray-400 w-full text-center">
            {distributionMethod === "equal"
              ? "Equal distribution: each wallet receives the same amount"
              : distributionMethod === "percentage"
                ? "Percentage-based: specify exact percentages for each wallet"
                : "Custom: use sliders to adjust distribution visually"}
          </div>
        </CardFooter>
      </Card>
    </div>
  )
}

