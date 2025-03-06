"use client"

// Add this to make the page dynamic and avoid caching
export const dynamic = "force-dynamic"

import { useState, useEffect, useCallback } from "react"
import { motion } from "framer-motion"
import { Shield, Wallet, ArrowRightLeft, Plus, Minus, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { toast } from "sonner"
import { startTransfer, getWalletBalances, checkWalletBalance } from "@/lib/actions"
import { WalletStatus } from "@/components/wallet-status"
import { NetworkStatus } from "@/components/network-status"
import { HexGrid } from "@/components/hex-grid"
import { DestinationWallets } from "@/components/destination-wallets"
import { DistributionSettings } from "@/components/distribution-settings"
import { ThemeToggle } from "@/components/theme-toggle"
import { useTheme } from "next-themes"
import { InputMethodToggle } from "@/components/input-method-toggle"
import { validatePrivateKey } from "@/lib/validation"
import type { GasSpeed } from "@/lib/gas-price"
import type { WalletStatus as WalletStatusType, WalletResult } from "@/lib/actions"

interface SourceWallet {
  privateKey: string
  balance: string
  status: WalletStatusType
  isValid: boolean
  error?: string
}

interface DestinationWallet {
  address: string
  percentage: number
  isValid?: boolean
  error?: string
}

export default function Home() {
  const [sourceWallets, setSourceWallets] = useState<SourceWallet[]>([
    { privateKey: "", balance: "0", status: "idle", isValid: true },
  ])
  const [destinationWallets, setDestinationWallets] = useState<DestinationWallet[]>([
    { address: "", percentage: 100, isValid: true },
  ])
  const [distributionMethod, setDistributionMethod] = useState<"equal" | "percentage" | "custom">("equal")
  const [isRunning, setIsRunning] = useState(false)
  const [activeTab, setActiveTab] = useState("setup")
  const [sourceInputMethod, setSourceInputMethod] = useState<"individual" | "comma-separated">("comma-separated")
  const [commaSeparatedKeys, setCommaSeparatedKeys] = useState("")
  const [keyErrors, setKeyErrors] = useState<string[]>([])
  const [isInitialLoad, setIsInitialLoad] = useState(true)
  const { theme } = useTheme()

  // Memoize the fetchBalancesForWallets function to prevent recreating it on every render
  const fetchBalancesForWallets = useCallback(async (wallets: SourceWallet[]) => {
    try {
      if (wallets.length === 0) return

      const results = await getWalletBalances(wallets.map((w) => w.privateKey))

      // Update balances in state
      setSourceWallets((prev) => {
        const updatedWallets = [...prev]

        // Create a map of private keys to results for easier lookup
        const resultMap = new Map()
        wallets.forEach((wallet, index) => {
          if (index < results.length) {
            resultMap.set(wallet.privateKey, results[index])
          }
        })

        // Update balances
        for (let i = 0; i < updatedWallets.length; i++) {
          const result = resultMap.get(updatedWallets[i].privateKey)
          if (result) {
            updatedWallets[i].balance = result.balance
          }
        }

        return updatedWallets
      })
    } catch (error) {
      console.error("Error fetching wallet balances:", error)
    }
  }, [])

  // Fetch wallet balances only on initial load
  useEffect(() => {
    if (isInitialLoad) {
      const validWallets = sourceWallets.filter((w) => w.privateKey.trim() !== "" && w.isValid)
      if (validWallets.length > 0) {
        fetchBalancesForWallets(validWallets)
      }
      setIsInitialLoad(false)
    }
  }, [isInitialLoad, sourceWallets, fetchBalancesForWallets])

  const addSourceWallet = () => {
    setSourceWallets([...sourceWallets, { privateKey: "", balance: "0", status: "idle", isValid: true }])
  }

  const removeSourceWallet = (index: number) => {
    if (sourceWallets.length > 1) {
      const newWallets = [...sourceWallets]
      newWallets.splice(index, 1)
      setSourceWallets(newWallets)
    }
  }

  const updateSourceWallet = (index: number, value: string) => {
    const newWallets = [...sourceWallets]
    newWallets[index].privateKey = value

    // Validate the private key if it's not empty
    if (value.trim()) {
      const validation = validatePrivateKey(value)
      newWallets[index].isValid = validation.isValid
      newWallets[index].error = validation.error
    } else {
      // Empty is considered valid until submission
      newWallets[index].isValid = true
      newWallets[index].error = undefined
    }

    setSourceWallets(newWallets)
  }

  const handleCommaSeparatedKeysChange = (value: string) => {
    setCommaSeparatedKeys(value)

    // Parse private keys and update wallets
    const keys = value
      .split(",")
      .map((key) => key.trim())
      .filter((key) => key)

    // Reset errors
    setKeyErrors([])

    if (keys.length > 0) {
      // Create new wallets with the parsed keys and validate each
      const newWallets = keys.map((privateKey) => {
        const validation = validatePrivateKey(privateKey)
        return {
          privateKey,
          balance: "0",
          status: "idle" as WalletStatusType,
          isValid: validation.isValid,
          error: validation.error,
        }
      })

      // Collect errors for display
      const errors = newWallets
        .map((wallet, index) => (wallet.error ? `Key #${index + 1}: ${wallet.error}` : null))
        .filter((error) => error !== null) as string[]

      setKeyErrors(errors)
      setSourceWallets(newWallets)

      // Fetch balances for valid wallets
      const validWallets = newWallets.filter((w) => w.privateKey.trim() !== "" && w.isValid)
      if (validWallets.length > 0) {
        fetchBalancesForWallets(validWallets)
      }
    } else {
      // If no keys, create a single empty wallet
      setSourceWallets([{ privateKey: "", balance: "0", status: "idle", isValid: true }])
    }
  }

  // Initialize comma-separated keys from wallets
  useEffect(() => {
    if (sourceInputMethod === "comma-separated") {
      setCommaSeparatedKeys(
        sourceWallets
          .map((w) => w.privateKey)
          .filter((k) => k)
          .join(", "),
      )

      // Collect errors for display
      const errors = sourceWallets
        .map((wallet, index) => (wallet.error && wallet.privateKey ? `Key #${index + 1}: ${wallet.error}` : null))
        .filter((error) => error !== null) as string[]

      setKeyErrors(errors)
    }
  }, [sourceInputMethod, sourceWallets])

  const handleStartTransfer = async (gasSpeed: GasSpeed = "average") => {
    // Validate destination wallets
    if (destinationWallets.length === 0 || destinationWallets.some((w) => !w.address)) {
      toast.error("Please add at least one destination wallet address")
      return
    }

    // Check if any destination wallet is invalid
    const invalidDestination = destinationWallets.find((w) => w.address && !w.isValid)
    if (invalidDestination) {
      toast.error("One or more destination wallet addresses are invalid")
      return
    }

    // Validate source wallets
    const validWallets = sourceWallets.filter((w) => w.privateKey.trim() !== "" && w.isValid)
    if (validWallets.length === 0) {
      toast.error("Please add at least one valid source wallet with a private key")
      return
    }

    // Check if any source wallet has an invalid private key
    const invalidWallet = sourceWallets.find((w) => w.privateKey && !w.isValid)
    if (invalidWallet) {
      toast.error("One or more private keys are invalid")
      return
    }

    // Validate percentages add up to 100% if using percentage distribution
    if (distributionMethod === "percentage") {
      const totalPercentage = destinationWallets.reduce((sum, wallet) => sum + (Number(wallet.percentage) || 0), 0)
      if (Math.abs(totalPercentage - 100) > 0.01) {
        toast.error("Destination wallet percentages must add up to 100%")
        return
      }
    }

    setIsRunning(true)
    toast.info(`Starting ETH transfer process with ${gasSpeed} gas price...`)

    try {
      // Check balances before starting the transfer
      let hasLowBalanceWallets = false

      // Update UI to show processing status
      const processingWallets = [...sourceWallets]
      for (let i = 0; i < validWallets.length; i++) {
        const wallet = validWallets[i]
        const index = sourceWallets.findIndex((w) => w.privateKey === wallet.privateKey)

        if (index !== -1) {
          try {
            // Check if this wallet has sufficient balance
            const { hasSufficientBalance, balance, minRequired } = await checkWalletBalance(wallet.privateKey)

            if (!hasSufficientBalance) {
              processingWallets[index].status = "low_balance"
              processingWallets[index].error = `Balance too low (${balance} ETH). Minimum required: ${minRequired} ETH.`
              processingWallets[index].balance = balance
              hasLowBalanceWallets = true
            } else {
              processingWallets[index].status = "processing"
            }
          } catch (error) {
            processingWallets[index].status = "error"
            processingWallets[index].error = (error as Error).message
          }
        }
      }

      setSourceWallets(processingWallets)

      // If any wallets have low balance, show a warning
      if (hasLowBalanceWallets) {
        toast.warning("Some wallets have insufficient balance for transfer")
      }

      // Switch to monitor tab to show progress
      setActiveTab("monitor")

      // Call the actual transfer function with a timeout handler for Netlify
      let timeoutId: NodeJS.Timeout

      const transferPromise = startTransfer(
        validWallets.map((w) => w.privateKey),
        destinationWallets,
        distributionMethod,
        gasSpeed,
      )

      // Set up a timeout for Netlify (just in case it doesn't respond)
      const timeoutPromise = new Promise<WalletResult[]>((_, reject) => {
        timeoutId = setTimeout(() => {
          reject(new Error("Request timed out - but transfers may still be processing"))
        }, 8000) // Set timeout to 8 seconds (below Netlify's 10s limit)
      })

      // Race the transfer promise against the timeout
      const result = await Promise.race<WalletResult[]>([transferPromise, timeoutPromise])
        .catch(async (error) => {
          // If it's a timeout, the transfers might still be happening in the background
          if (error.message.includes("timed out")) {
            // Show a message that transfers might still be processing
            toast.info(
              "Connection timed out, but transfers may still be processing. Please check wallet balances in a few minutes.",
            )

            // Wait a while and then refresh balances
            setTimeout(async () => {
              await refreshWalletBalances()
            }, 30000) // Wait 30 seconds

            // Return an empty array so we don't update the UI right away
            return [] as WalletResult[]
          }
          throw error // Re-throw if it's not a timeout error
        })
        .finally(() => {
          // Clear the timeout if it hasn't triggered
          clearTimeout(timeoutId)
        })

      // If we got an actual result (not an empty array from timeout handling)
      if (result && result.length > 0) {
        // Update UI with results
        const updatedWallets = [...sourceWallets]
        let resultIndex = 0

        for (let i = 0; i < updatedWallets.length; i++) {
          if (updatedWallets[i].privateKey.trim() !== "" && updatedWallets[i].isValid) {
            if (resultIndex < result.length) {
              updatedWallets[i].status = result[resultIndex].status
              updatedWallets[i].balance = result[resultIndex].balance
              updatedWallets[i].error = result[resultIndex].error
              resultIndex++
            }
          }
        }

        setSourceWallets(updatedWallets)

        // Check if any transfers failed or had low balance
        const anyFailed = result.some((r) => r.status === "error")
        const anyLowBalance = result.some((r) => r.status === "low_balance")

        if (anyFailed) {
          toast.error("Some transfers failed. Check the monitor tab for details.")
        } else if (anyLowBalance) {
          toast.warning("Some wallets had insufficient balance for transfer.")
        } else {
          toast.success("Transfer process completed successfully!")
        }
      }
    } catch (error) {
      console.error("Transfer error:", error)
      // Determine if this is a network error or a real failure
      const errorMessage = (error as Error).message

      if (errorMessage.includes("network") || errorMessage.includes("502") || errorMessage.includes("Gateway")) {
        toast.warning(
          "Network error occurred, but transfers may still be processing. Please check balances in a few minutes.",
        )

        // Schedule a balance refresh
        setTimeout(async () => {
          await refreshWalletBalances()
        }, 30000) // Wait 30 seconds
      } else {
        toast.error(`Error during transfer process: ${errorMessage}`)

        // Reset status to error for valid wallets
        const resetWallets = [...sourceWallets]
        validWallets.forEach((wallet) => {
          const index = sourceWallets.findIndex((w) => w.privateKey === wallet.privateKey)
          if (index !== -1) {
            resetWallets[index].status = "error"
            resetWallets[index].error = errorMessage
          }
        })
        setSourceWallets(resetWallets)
      }
    } finally {
      setIsRunning(false)
    }
  }

  const handleStopTransfer = () => {
    setIsRunning(false)
    toast.info("Transfer process stopped")
  }

  // Function to refresh wallet balances
  const refreshWalletBalances = async () => {
    const validWallets = sourceWallets.filter((w) => w.privateKey.trim() !== "" && w.isValid)
    if (validWallets.length === 0) {
      toast.info("No valid wallets to refresh")
      return
    }

    toast.info("Refreshing wallet balances...")
    await fetchBalancesForWallets(validWallets)
    toast.success("Wallet balances updated")
  }

  return (
    <div className="min-h-screen bg-white dark:bg-black text-gray-900 dark:text-white">
      <HexGrid />

      <div className="container mx-auto px-4 py-8 relative z-10">
        <div className="flex items-center justify-between mb-8">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="flex items-center"
          >
            <Shield className="h-8 w-8 mr-2 text-green-600 dark:text-green-500" />
            <h1 className="text-3xl font-bold text-green-700 dark:text-transparent dark:bg-clip-text dark:bg-gradient-to-r dark:from-green-400 dark:to-emerald-400">
              Sepolia ETH Auto-Transfer
            </h1>
          </motion.div>
          <ThemeToggle />
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-3 mb-8 bg-gray-100 dark:bg-black">
              <TabsTrigger
                value="setup"
                className="data-[state=active]:bg-green-50 data-[state=active]:text-green-700 dark:data-[state=active]:bg-green-900/20 dark:data-[state=active]:text-green-400"
              >
                Setup
              </TabsTrigger>
              <TabsTrigger
                value="distribution"
                className="data-[state=active]:bg-green-50 data-[state=active]:text-green-700 dark:data-[state=active]:bg-green-900/20 dark:data-[state=active]:text-green-400"
              >
                Distribution
              </TabsTrigger>
              <TabsTrigger
                value="monitor"
                className="data-[state=active]:bg-green-50 data-[state=active]:text-green-700 dark:data-[state=active]:bg-green-900/20 dark:data-[state=active]:text-green-400"
              >
                Monitor
              </TabsTrigger>
            </TabsList>

            <TabsContent value="setup">
              <div className="grid gap-6 md:grid-cols-2">
                <Card className="border-green-200 dark:border-green-900/50 bg-white dark:bg-black/60 backdrop-blur-sm">
                  <CardHeader>
                    <CardTitle className="flex items-center text-green-700 dark:text-green-500">
                      <Wallet className="h-5 w-5 mr-2" />
                      Source Wallets
                    </CardTitle>
                    <CardDescription className="text-gray-600 dark:text-gray-400">
                      Add the private keys of wallets you want to monitor
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <InputMethodToggle
                      value={sourceInputMethod}
                      onChange={setSourceInputMethod}
                      label="Private Key Input Method"
                    />

                    {sourceInputMethod === "comma-separated" ? (
                      <>
                        <Textarea
                          placeholder="Enter private keys separated by commas (e.g., 0x123...abc, 0x456...def, 0x789...ghi)"
                          value={commaSeparatedKeys}
                          onChange={(e) => handleCommaSeparatedKeysChange(e.target.value)}
                          className={`min-h-[100px] bg-gray-50 border-green-200 focus:border-green-500 dark:bg-black/50 dark:border-green-900/50 dark:focus:border-green-500 ${
                            keyErrors.length > 0
                              ? "border-red-300 dark:border-red-700 focus:border-red-500 dark:focus:border-red-500"
                              : ""
                          }`}
                        />
                        {keyErrors.length > 0 && (
                          <div className="text-red-500 text-sm space-y-1">
                            {keyErrors.map((error, i) => (
                              <div key={i} className="flex items-start">
                                <AlertCircle className="h-4 w-4 mr-1 mt-0.5 flex-shrink-0" />
                                <span>{error}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </>
                    ) : (
                      <>
                        {sourceWallets.map((wallet, index) => (
                          <div key={index} className="space-y-1">
                            <div className="flex items-center space-x-2">
                              <Input
                                type="password"
                                placeholder={`Wallet ${index + 1} Private Key`}
                                value={wallet.privateKey}
                                onChange={(e) => updateSourceWallet(index, e.target.value)}
                                className={`flex-1 bg-gray-50 border-green-200 focus:border-green-500 dark:bg-black/50 dark:border-green-900/50 dark:focus:border-green-500 ${
                                  wallet.privateKey && !wallet.isValid
                                    ? "border-red-300 dark:border-red-700 focus:border-red-500 dark:focus:border-red-500"
                                    : ""
                                }`}
                              />
                              <Button
                                variant="outline"
                                size="icon"
                                onClick={() => removeSourceWallet(index)}
                                disabled={sourceWallets.length === 1}
                                className="border-green-200 hover:bg-green-50 hover:text-green-700 dark:border-green-900/50 dark:hover:bg-green-900/20 dark:hover:text-green-400"
                              >
                                <Minus className="h-4 w-4" />
                              </Button>
                            </div>
                            {wallet.privateKey && !wallet.isValid && (
                              <div className="text-red-500 text-xs flex items-center">
                                <AlertCircle className="h-3 w-3 mr-1" />
                                <span>{wallet.error}</span>
                              </div>
                            )}
                          </div>
                        ))}
                        <Button
                          variant="outline"
                          onClick={addSourceWallet}
                          className="w-full border-green-200 hover:bg-green-50 hover:text-green-700 dark:border-green-900/50 dark:hover:bg-green-900/20 dark:hover:text-green-400"
                        >
                          <Plus className="h-4 w-4 mr-2" /> Add Source Wallet
                        </Button>
                      </>
                    )}
                  </CardContent>
                  {sourceInputMethod === "comma-separated" && (
                    <CardFooter>
                      <p className="text-xs text-gray-500 dark:text-gray-400 w-full text-center">
                        Enter multiple private keys separated by commas
                      </p>
                    </CardFooter>
                  )}
                </Card>

                <DestinationWallets
                  wallets={destinationWallets}
                  setWallets={setDestinationWallets}
                  distributionMethod={distributionMethod}
                />
              </div>
            </TabsContent>

            <TabsContent value="distribution">
              <DistributionSettings
                distributionMethod={distributionMethod}
                setDistributionMethod={setDistributionMethod}
                destinationWallets={destinationWallets}
                setDestinationWallets={setDestinationWallets}
                isRunning={isRunning}
                onStart={handleStartTransfer}
                onStop={handleStopTransfer}
              />
            </TabsContent>

            <TabsContent value="monitor">
              <Card className="border-green-200 dark:border-green-900/50 bg-white dark:bg-black/60 backdrop-blur-sm">
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center text-green-700 dark:text-green-500">
                      <ArrowRightLeft className="h-5 w-5 mr-2" />
                      Transfer Status
                    </CardTitle>
                    <CardDescription className="text-gray-600 dark:text-gray-400">
                      Monitor the status of your wallet transfers
                    </CardDescription>
                  </div>
                  <Button
                    variant="outline"
                    onClick={refreshWalletBalances}
                    className="border-green-200 hover:bg-green-50 hover:text-green-700 dark:border-green-900/50 dark:hover:bg-green-900/20 dark:hover:text-green-400"
                  >
                    Refresh Balances
                  </Button>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {sourceWallets.map((wallet, index) => (
                      <WalletStatus
                        key={index}
                        index={index}
                        balance={wallet.balance}
                        status={wallet.status}
                        error={wallet.error}
                      />
                    ))}
                  </div>
                </CardContent>
                <CardFooter className="flex justify-between">
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    Last updated: {new Date().toLocaleTimeString()}
                  </div>
                  <NetworkStatus />
                </CardFooter>
              </Card>
            </TabsContent>
          </Tabs>
        </motion.div>

        <motion.footer
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="mt-12 text-center text-sm text-gray-500 dark:text-gray-400"
        >
          <p>Secure Sepolia ETH Auto-Transfer System • {new Date().getFullYear()}</p>
          <p className="mt-1 text-xs">All private keys are processed locally and never stored on any server</p>
        </motion.footer>
      </div>
    </div>
  )
}

