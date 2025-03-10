"use server"

import { distributeFunds, getWalletBalance } from "./ethereum"
import type { GasSpeed } from "./gas-price"
import { ethers } from "ethers"

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

// Update the checkWalletBalance function to handle errors better and add a timeout
export async function checkWalletBalance(privateKey: string) {
  try {
    const rpcEndpoint = getRpcEndpoint()
    const provider = new ethers.JsonRpcProvider(rpcEndpoint)

    // Set a timeout for the provider
    provider
      .getNetwork()
      .then((network) => {
        console.log(`Connected to network: ${network.name}`)
      })
      .catch((error) => {
        console.error("Network connection error:", error)
      })

    const wallet = new ethers.Wallet(privateKey, provider)
    const balance = await provider.getBalance(wallet.address)

    // Convert balance to ETH (as a number)
    const balanceEth = Number.parseFloat(ethers.formatEther(balance))

    // Minimum required balance (0.005 ETH)
    const minBalance = 0.005

    return {
      address: wallet.address,
      balance: ethers.formatEther(balance),
      hasSufficientBalance: balanceEth >= minBalance,
      minRequired: minBalance,
    }
  } catch (error) {
    console.error("Error checking wallet balance:", error)
    // Return a default object with error information
    return {
      address: "Error",
      balance: "0",
      hasSufficientBalance: false,
      minRequired: 0.005,
      error: (error as Error).message,
    }
  }
}

// Update the startTransfer function to handle timeouts better
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

  // Ensure we have valid destination wallets
  if (!destinationWallets || destinationWallets.length === 0) {
    console.error("No destination wallets provided")
    return [{ status: "error", balance: "0", error: "No destination wallets provided" }]
  }

  // Process each source wallet
  for (let i = 0; i < privateKeys.length; i++) {
    const privateKey = privateKeys[i]

    // Skip empty private keys
    if (!privateKey || !privateKey.trim()) {
      results.push({ status: "idle", balance: "0" })
      continue
    }

    try {
      // Set a timeout for the entire wallet processing
      const walletProcessPromise = (async () => {
        // Get initial balance and check if it's sufficient
        const balanceCheck = await checkWalletBalance(privateKey)

        // If there was an error checking the balance
        if (balanceCheck.error) {
          return {
            status: "error",
            balance: "0",
            error: `Error checking balance: ${balanceCheck.error}`,
          }
        }

        const { balance: initialBalance, address: sourceAddress, hasSufficientBalance, minRequired } = balanceCheck

        // If balance is too low, mark as low_balance and continue to next wallet
        if (!hasSufficientBalance) {
          console.log(
            `Wallet ${sourceAddress} has insufficient balance: ${initialBalance} ETH (minimum required: ${minRequired} ETH)`,
          )
          return {
            status: "low_balance",
            balance: initialBalance,
            error: `Balance too low (${initialBalance} ETH). Minimum required: ${minRequired} ETH. Process completed.`,
          }
        }

        // Set status to processing
        results[i] = { status: "processing", balance: initialBalance }

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

        // Return success status
        return { status: "success", balance: updatedBalance }
      })()

      // Set a timeout of 240 seconds (4 minutes) for the entire wallet processing
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => {
          reject(new Error("Wallet processing timed out after 240 seconds"))
        }, 240000)
      })

      // Race the wallet processing against the timeout
      const result = await Promise.race([walletProcessPromise, timeoutPromise]).catch(async (error) => {
        console.error(`Error or timeout processing wallet ${i + 1}:`, error)

        // Try to get current balance even after timeout
        try {
          const { balance } = await getWalletBalance(privateKey, rpcEndpoint)
          return {
            status: "error",
            balance,
            error: `Operation timed out: ${error.message}. The transaction may still be processing.`,
          }
        } catch (balanceError) {
          return {
            status: "error",
            balance: "0",
            error: `Operation timed out: ${error.message}. Could not retrieve current balance.`,
          }
        }
      })

      // Add the result to our results array
      results[i] = result
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

