"use server"

import { distributeFunds, getWalletBalance } from "./ethereum"
import type { GasSpeed } from "./gas-price"

interface DestinationWallet {
  address: string
  percentage: number
  isValid?: boolean
  error?: string
}

type WalletStatus = "idle" | "processing" | "success" | "error" | "low_balance"

// Get the RPC endpoint from environment variables
const getRpcEndpoint = () => {
  const infuraProjectId = process.env.INFURA_PROJECT_ID
  if (!infuraProjectId) {
    throw new Error("INFURA_PROJECT_ID is not set in the environment variables")
  }
  return `https://sepolia.infura.io/v3/${infuraProjectId}`
}

// Add a function to get the Etherscan API key
const getEtherscanApiKey = () => {
  return process.env.ETHERSCAN_API_KEY || ""
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

// Check if a wallet has sufficient balance for transfer
export async function checkWalletBalance(privateKey: string) {
  try {
    const rpcEndpoint = getRpcEndpoint()
    const { balance, address } = await getWalletBalance(privateKey, rpcEndpoint)

    // Convert balance to ETH (as a number)
    const balanceEth = Number.parseFloat(balance)

    // Minimum required balance (0.005 ETH)
    const minBalance = 0.005

    return {
      address,
      balance,
      hasSufficientBalance: balanceEth >= minBalance,
      minRequired: minBalance,
    }
  } catch (error) {
    console.error("Error checking wallet balance:", error)
    throw error
  }
}

// Start the transfer process
export async function startTransfer(
  privateKeys: string[],
  destinationWallets: DestinationWallet[],
  distributionMethod: "equal" | "percentage" | "custom",
  gasSpeed: GasSpeed = "average",
) {
  console.log("Starting transfer process...")
  const rpcEndpoint = getRpcEndpoint()
  const etherscanApiKey = getEtherscanApiKey()
  console.log(`Using Etherscan API key: ${etherscanApiKey ? "Yes" : "No"}`)
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
      // Get initial balance and check if it's sufficient
      const {
        balance: initialBalance,
        address: sourceAddress,
        hasSufficientBalance,
        minRequired,
      } = await checkWalletBalance(privateKey)

      // If balance is too low, mark as low_balance and continue to next wallet
      if (!hasSufficientBalance) {
        console.log(
          `Wallet ${sourceAddress} has insufficient balance: ${initialBalance} ETH (minimum required: ${minRequired} ETH)`,
        )
        results.push({
          status: "low_balance",
          balance: initialBalance,
          error: `Balance too low (${initialBalance} ETH). Minimum required: ${minRequired} ETH.`,
        })
        continue
      }

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

      console.log(`Distributing funds from wallet ${sourceAddress} to ${processedDestinations.length} destination(s)`)
      console.log(`Using gas speed: ${gasSpeed}`)

      // Distribute funds
      const distributionResults = await distributeFunds(
        privateKey,
        processedDestinations,
        rpcEndpoint,
        gasSpeed,
        etherscanApiKey,
      )

      // Check if any transfers were successful
      const anySuccess = distributionResults.some((result) => result.success)

      if (!anySuccess) {
        throw new Error("All transfers failed. Check console for details.")
      }

      // Get updated balance
      const { balance: updatedBalance } = await getWalletBalance(privateKey, rpcEndpoint)

      // Update status to success
      results[i] = { status: "success", balance: updatedBalance }
    } catch (error) {
      console.error(`Error processing wallet ${i + 1}:`, error)

      // Get current balance if possible
      try {
        const { balance } = await getWalletBalance(privateKey, rpcEndpoint)
        results[i] = { status: "error", balance, error: (error as Error).message }
      } catch {
        // If we can't get the balance, just mark as error
        results[i] = { status: "error", balance: "0", error: (error as Error).message }
      }
    }
  }

  return results
}

