"use server"

import { getWalletBalance, prepareTransaction, sendPreparedTransaction } from "./ethereum"
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

// Update the checkWalletBalance function to handle errors better
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

// New function to prepare transactions without executing them
export async function prepareTransferTransactions(
  privateKeys: string[],
  destinationWallets: DestinationWallet[],
  distributionMethod: "equal" | "percentage" | "custom",
  gasSpeed: GasSpeed = "average",
) {
  console.log("Preparing transfer transactions...")
  const rpcEndpoint = getRpcEndpoint()
  const etherscanApiKey = getEtherscanApiKey()
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
      // Get initial balance and check if it's sufficient
      const balanceCheck = await checkWalletBalance(privateKey)

      // If there was an error checking the balance
      if (balanceCheck.error) {
        results.push({
          status: "error",
          balance: "0",
          error: `Error checking balance: ${balanceCheck.error}`,
        })
        continue
      }

      const { balance: initialBalance, address: sourceAddress, hasSufficientBalance, minRequired } = balanceCheck

      // If balance is too low, mark as low_balance and continue to next wallet
      if (!hasSufficientBalance) {
        console.log(
          `Wallet ${sourceAddress} has insufficient balance: ${initialBalance} ETH (minimum required: ${minRequired} ETH)`,
        )
        results.push({
          status: "low_balance",
          balance: initialBalance,
          error: `Balance too low (${initialBalance} ETH). Minimum required: ${minRequired} ETH. Process completed.`,
        })
        continue
      }

      // Set status to processing
      results.push({
        status: "processing",
        balance: initialBalance,
        address: sourceAddress,
        privateKey: privateKey, // We need this for the next step
      })

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

      console.log(
        `Preparing transactions from wallet ${sourceAddress} to ${processedDestinations.length} destination(s)`,
      )
      console.log(`Using gas speed: ${gasSpeed}`)

      // Instead of executing transactions, just prepare them
      const preparedTransactions = await prepareTransaction(
        privateKey,
        processedDestinations,
        rpcEndpoint,
        gasSpeed,
        etherscanApiKey,
      )

      // Store the prepared transactions in the result
      results[i] = {
        status: "processing",
        balance: initialBalance,
        address: sourceAddress,
        privateKey: privateKey,
        preparedTransactions: preparedTransactions,
      }
    } catch (error) {
      console.error(`Error preparing transactions for wallet ${i + 1}:`, error)

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

// New function to execute prepared transactions
export async function executeTransactions(preparedData: any[]) {
  console.log("Executing prepared transactions...")
  const rpcEndpoint = getRpcEndpoint()
  const results = []

  for (let i = 0; i < preparedData.length; i++) {
    const data = preparedData[i]

    // Skip wallets that don't have prepared transactions
    if (!data || !data.preparedTransactions || data.status !== "processing") {
      results.push(data) // Keep the original data
      continue
    }

    try {
      console.log(`Executing transactions for wallet ${data.address}...`)

      // Execute the prepared transactions
      const txResults = await sendPreparedTransaction(data.privateKey, data.preparedTransactions, rpcEndpoint)

      // Check if any transfers were successful
      const anySuccess = txResults.some((result: any) => result.success)

      if (!anySuccess) {
        throw new Error("All transfers failed. Check console for details.")
      }

      // Get updated balance
      const { balance: updatedBalance } = await getWalletBalance(data.privateKey, rpcEndpoint)

      // Update status to success
      results.push({
        status: "success",
        balance: updatedBalance,
        address: data.address,
        txResults: txResults,
      })
    } catch (error) {
      console.error(`Error executing transactions for wallet ${data.address}:`, error)

      // Get current balance if possible
      try {
        const { balance } = await getWalletBalance(data.privateKey, rpcEndpoint)
        results.push({
          status: "error",
          balance,
          address: data.address,
          error: (error as Error).message,
        })
      } catch {
        // If we can't get the balance, just mark as error
        results.push({
          status: "error",
          balance: "0",
          address: data.address,
          error: (error as Error).message,
        })
      }
    }
  }

  return results
}

// Update the startTransfer function to use the two-step approach
export async function startTransfer(
  privateKeys: string[],
  destinationWallets: DestinationWallet[],
  distributionMethod: "equal" | "percentage" | "custom",
  gasSpeed: GasSpeed = "average",
) {
  try {
    // Step 1: Prepare the transactions (this should be quick)
    const preparedData = await prepareTransferTransactions(
      privateKeys,
      destinationWallets,
      distributionMethod,
      gasSpeed,
    )

    // Step 2: Execute the prepared transactions
    return await executeTransactions(preparedData)
  } catch (error) {
    console.error("Error in startTransfer:", error)
    return privateKeys.map(() => ({
      status: "error" as WalletStatus,
      balance: "0",
      error: (error as Error).message,
    }))
  }
}

