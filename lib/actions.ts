"use server"

import { distributeFunds, getWalletBalance } from "./ethereum"

interface DestinationWallet {
  address: string
  percentage: number
  isValid?: boolean
  error?: string
}

type WalletStatus = "idle" | "processing" | "success" | "error"

// Get the RPC endpoint from environment variables
const getRpcEndpoint = () => {
  const infuraProjectId = process.env.INFURA_PROJECT_ID
  if (!infuraProjectId) {
    throw new Error("INFURA_PROJECT_ID is not set in the environment variables")
  }
  return `https://sepolia.infura.io/v3/${infuraProjectId}`
}

// Get wallet balances
export async function getWalletBalances(privateKeys: string[]) {
  const rpcEndpoint = getRpcEndpoint()
  const results = []

  for (const privateKey of privateKeys) {
    try {
      if (!privateKey.trim()) {
        results.push({ status: "idle", balance: "0" })
        continue
      }

      const { balance } = await getWalletBalance(privateKey, rpcEndpoint)
      results.push({ status: "idle", balance })
    } catch (error) {
      console.error("Error getting wallet balance:", error)
      results.push({ status: "error", balance: "0" })
    }
  }

  return results
}

// Start the transfer process
export async function startTransfer(
  privateKeys: string[],
  destinationWallets: DestinationWallet[],
  distributionMethod: "equal" | "percentage" | "custom",
) {
  const rpcEndpoint = getRpcEndpoint()
  const results = []

  // Process each source wallet
  for (let i = 0; i < privateKeys.length; i++) {
    const privateKey = privateKeys[i]

    // Skip empty private keys
    if (!privateKey.trim()) {
      results.push({ status: "idle", balance: "0" })
      continue
    }

    try {
      // Get initial balance
      const { balance: initialBalance, address: sourceAddress } = await getWalletBalance(privateKey, rpcEndpoint)

      // Set status to processing
      results.push({ status: "processing", balance: initialBalance })

      // Prepare destination wallets with correct percentages
      let processedDestinations = [...destinationWallets]

      // If equal distribution, adjust percentages
      if (distributionMethod === "equal" && destinationWallets.length > 0) {
        const equalPercentage = 100 / destinationWallets.length
        processedDestinations = destinationWallets.map((wallet) => ({
          ...wallet,
          percentage: equalPercentage,
        }))
      }

      // Distribute funds
      await distributeFunds(privateKey, processedDestinations, rpcEndpoint)

      // Get updated balance
      const { balance: updatedBalance } = await getWalletBalance(privateKey, rpcEndpoint)

      // Update status to success
      results[i] = { status: "success", balance: updatedBalance }
    } catch (error) {
      console.error(`Error processing wallet ${i + 1}:`, error)

      // Get current balance if possible
      try {
        const { balance } = await getWalletBalance(privateKey, rpcEndpoint)
        results[i] = { status: "error", balance }
      } catch {
        // If we can't get the balance, just mark as error
        results[i] = { status: "error", balance: "0" }
      }
    }
  }

  return results
}

