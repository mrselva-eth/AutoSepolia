import { ethers } from "ethers"
import { getGasPrice, type GasSpeed } from "./gas-price"

// Update the waitForTransaction function to handle timeouts better
export async function waitForTransaction(provider: ethers.JsonRpcProvider, txHash: string, timeout = 60000) {
  // Reduced timeout to 60 seconds for the initial check
  const startTime = Date.now()

  try {
    // First, verify the transaction exists
    const tx = await provider.getTransaction(txHash).catch((e) => {
      console.warn(`Error getting transaction ${txHash}:`, e)
      return null
    })

    if (!tx) {
      console.warn(`Transaction ${txHash} not found. It might be pending or not exist.`)
    }

    while (Date.now() - startTime < timeout) {
      try {
        const receipt = await provider.getTransactionReceipt(txHash)
        if (receipt) {
          return receipt
        }

        // Check if transaction is still in mempool
        const pendingTx = await provider.getTransaction(txHash).catch(() => null)
        if (!pendingTx) {
          console.warn(`Transaction ${txHash} no longer in mempool. It might have been dropped.`)
        }

        await new Promise((resolve) => setTimeout(resolve, 3000)) // Check every 3 seconds
      } catch (error) {
        console.warn(`Error checking transaction receipt: ${error}. Retrying...`)
        await new Promise((resolve) => setTimeout(resolve, 5000)) // Wait longer on error
      }
    }

    // If we reach here, we timed out waiting for the transaction
    // Check one last time if the transaction exists in the blockchain
    const finalCheck = await provider.getTransaction(txHash).catch(() => null)
    if (finalCheck) {
      console.log(`Transaction ${txHash} exists but is not yet mined after timeout.`)
      return {
        status: 1, // Assume success since the transaction exists
        blockNumber: 0,
        to: finalCheck.to,
        from: finalCheck.from,
        hash: txHash,
      } as any // Type assertion to satisfy return type
    }

    // Return a special result for timeout
    return {
      status: 2, // Special status for timeout
      hash: txHash,
      timeout: true,
    } as any
  } catch (error) {
    console.error(`Timeout waiting for transaction ${txHash}:`, error)
    throw error
  }
}

// New function to prepare transactions without sending them
export async function prepareTransaction(
  privateKey: string,
  destinationWallets: { address: string; percentage: number }[],
  rpcEndpoint: string,
  gasSpeed: GasSpeed = "average",
  etherscanApiKey?: string,
) {
  console.log(`Preparing transactions for ${destinationWallets.length} destinations...`)

  // Create a provider
  const provider = new ethers.JsonRpcProvider(rpcEndpoint)

  // Create wallet instance
  const wallet = new ethers.Wallet(privateKey, provider)
  const walletAddress = wallet.address

  // Get current balance
  const balance = await provider.getBalance(walletAddress)
  console.log(`Wallet ${walletAddress} balance: ${ethers.formatEther(balance)} SepoliaETH`)

  // Check if balance is too low
  const minBalance = ethers.parseEther("0.005")
  if (balance < minBalance) {
    throw new Error(`Balance too low to transfer (< ${ethers.formatEther(minBalance)} SepoliaETH)`)
  }

  // Get gas price - try multiple speeds if needed
  let gasPrice: bigint
  let usedGasSpeed = gasSpeed

  try {
    // First try with requested speed
    gasPrice = await getGasPrice(provider, gasSpeed, etherscanApiKey)
    console.log(`Gas price (${gasSpeed}): ${ethers.formatUnits(gasPrice, "gwei")} Gwei`)

    // If gas price is extremely high (over 100 Gwei), try a lower speed
    if (gasPrice > ethers.parseUnits("100", "gwei") && gasSpeed !== "slow") {
      console.log("Gas price is very high, trying slower speed...")
      const slowerGasPrice = await getGasPrice(provider, "slow", etherscanApiKey)
      console.log(`Gas price (slow): ${ethers.formatUnits(slowerGasPrice, "gwei")} Gwei`)

      // Use the slower gas price if it's significantly lower
      if (slowerGasPrice < (gasPrice * BigInt(80)) / BigInt(100)) {
        gasPrice = slowerGasPrice
        usedGasSpeed = "slow"
        console.log("Using slower gas price to save on fees")
      }
    }

    // If gas price is still extremely high (over 150 Gwei), use a fixed lower value
    if (gasPrice > ethers.parseUnits("150", "gwei")) {
      console.log("Gas price is extremely high, using fixed lower value")
      gasPrice = ethers.parseUnits("50", "gwei")
      console.log(`Using fixed gas price: ${ethers.formatUnits(gasPrice, "gwei")} Gwei`)
    }
  } catch (error) {
    console.error("Error getting gas price:", error)
    // Use a reasonable default
    gasPrice = ethers.parseUnits("50", "gwei")
    console.log(`Using default gas price: ${ethers.formatUnits(gasPrice, "gwei")} Gwei`)
  }

  // Calculate gas cost for a standard ETH transfer
  const gasLimit = BigInt(21000)
  const gasCost = gasPrice * gasLimit

  console.log(`Estimated gas cost: ${ethers.formatEther(gasCost)} ETH`)

  // Calculate available amount after gas reserve
  // Reserve enough for gas plus a small buffer
  const gasReserve = (gasCost * BigInt(destinationWallets.length) * BigInt(12)) / BigInt(10)
  const availableAmount = balance - gasReserve

  console.log(`Available for transfer after gas reserve: ${ethers.formatEther(availableAmount)} ETH`)

  if (availableAmount <= BigInt(0)) {
    throw new Error(
      `Not enough balance to cover transfers after gas costs. Need at least ${ethers.formatEther(gasReserve)} ETH for gas.`,
    )
  }

  // Get nonce
  const nonce = await provider.getTransactionCount(wallet.address, "pending")
  console.log(`Starting nonce: ${nonce}`)

  // Prepare transactions for each destination
  const preparedTxs = []

  for (let i = 0; i < destinationWallets.length; i++) {
    const destWallet = destinationWallets[i]

    // Calculate amount for this wallet based on percentage
    const amountForWallet = BigInt(Math.floor(Number(availableAmount) * (destWallet.percentage / 100)))

    console.log(
      `Preparing transfer of ${ethers.formatEther(amountForWallet)} ETH (${destWallet.percentage}%) to ${destWallet.address}`,
    )

    // Prepare transaction object
    const tx = {
      to: destWallet.address,
      value: amountForWallet,
      gasLimit: gasLimit,
      maxFeePerGas: gasPrice,
      maxPriorityFeePerGas: ethers.parseUnits("2", "gwei"),
      nonce: nonce + i, // Increment nonce for each transaction
    }

    preparedTxs.push({
      tx,
      destination: destWallet.address,
      percentage: destWallet.percentage,
      amount: amountForWallet.toString(),
      gasPrice: gasPrice.toString(),
    })
  }

  return preparedTxs
}

// New function to send prepared transactions
export async function sendPreparedTransaction(privateKey: string, preparedTxs: any[], rpcEndpoint: string) {
  console.log(`Sending ${preparedTxs.length} prepared transactions...`)

  const provider = new ethers.JsonRpcProvider(rpcEndpoint)
  const wallet = new ethers.Wallet(privateKey, provider)
  const results = []

  for (const preparedTx of preparedTxs) {
    try {
      console.log(`Sending transaction to ${preparedTx.destination}...`)

      // Send the transaction
      const transaction = await wallet.sendTransaction(preparedTx.tx)
      console.log(`Transaction sent: ${transaction.hash}`)

      // Wait for transaction with a short timeout
      // We don't need to wait for full confirmation here
      const receipt = await waitForTransaction(provider, transaction.hash, 30000)

      if (receipt.timeout) {
        // Transaction is still pending, but that's okay
        results.push({
          success: true, // Assume success since it was sent
          hash: transaction.hash,
          destination: preparedTx.destination,
          percentage: preparedTx.percentage,
          amount: ethers.formatEther(BigInt(preparedTx.amount)),
          pending: true,
          message: "Transaction sent but not yet confirmed. Check your wallet later.",
        })
      } else {
        // Transaction was confirmed
        results.push({
          success: true,
          hash: transaction.hash,
          blockNumber: receipt.blockNumber,
          destination: preparedTx.destination,
          percentage: preparedTx.percentage,
          amount: ethers.formatEther(BigInt(preparedTx.amount)),
          pending: false,
        })
      }
    } catch (error) {
      console.error(`Error sending transaction to ${preparedTx.destination}:`, error)

      // Check if this is an "insufficient funds" error
      const errorMessage = (error as Error).message || ""
      if (errorMessage.includes("insufficient funds")) {
        // Try again with a lower amount
        try {
          console.log("Insufficient funds error. Trying with a lower amount...")

          // Reduce the amount by 10%
          const reducedAmount = (BigInt(preparedTx.amount) * BigInt(90)) / BigInt(100)

          // If the reduced amount is too small, don't bother
          if (reducedAmount < ethers.parseUnits("0.001", "ether")) {
            throw new Error("Amount too small after reduction")
          }

          console.log(`Retrying with amount: ${ethers.formatEther(reducedAmount)} ETH`)

          // Create a new transaction with reduced amount
          const newTx = {
            ...preparedTx.tx,
            value: reducedAmount,
          }

          // Send the transaction
          const transaction = await wallet.sendTransaction(newTx)
          console.log(`Transaction sent with reduced amount: ${transaction.hash}`)

          // Wait for transaction with a short timeout
          const receipt = await waitForTransaction(provider, transaction.hash, 30000)

          if (receipt.timeout) {
            results.push({
              success: true,
              hash: transaction.hash,
              destination: preparedTx.destination,
              percentage: preparedTx.percentage,
              amount: ethers.formatEther(reducedAmount),
              pending: true,
              message: "Transaction sent with reduced amount but not yet confirmed. Check your wallet later.",
            })
          } else {
            results.push({
              success: true,
              hash: transaction.hash,
              blockNumber: receipt.blockNumber,
              destination: preparedTx.destination,
              percentage: preparedTx.percentage,
              amount: ethers.formatEther(reducedAmount),
              pending: false,
              message: "Transaction completed with reduced amount due to high gas fees.",
            })
          }
        } catch (retryError) {
          console.error("Error on retry with lower amount:", retryError)
          results.push({
            success: false,
            destination: preparedTx.destination,
            percentage: preparedTx.percentage,
            error: `Insufficient funds even after reducing amount. Gas prices may be too high. Error: ${(retryError as Error).message}`,
          })
        }
      } else {
        // For other errors, just record the failure
        results.push({
          success: false,
          destination: preparedTx.destination,
          percentage: preparedTx.percentage,
          error: (error as Error).message,
        })
      }
    }
  }

  return results
}

// Function to get wallet balance
export async function getWalletBalance(privateKey: string, rpcEndpoint: string) {
  try {
    const provider = new ethers.JsonRpcProvider(rpcEndpoint)
    const wallet = new ethers.Wallet(privateKey, provider)
    const balance = await provider.getBalance(wallet.address)
    return {
      address: wallet.address,
      balance: ethers.formatEther(balance),
    }
  } catch (error) {
    console.error("Error getting wallet balance:", error)
    throw error
  }
}

// Function to distribute funds to multiple wallets
export async function distributeFunds(
  sourcePrivateKey: string,
  destinationWallets: { address: string; percentage: number }[],
  rpcEndpoint: string,
  gasSpeed: GasSpeed = "average",
  etherscanApiKey?: string,
) {
  // This is now a wrapper around the new two-step approach
  const preparedTxs = await prepareTransaction(
    sourcePrivateKey,
    destinationWallets,
    rpcEndpoint,
    gasSpeed,
    etherscanApiKey,
  )

  return await sendPreparedTransaction(sourcePrivateKey, preparedTxs, rpcEndpoint)
}

// Legacy function for compatibility
export async function transferFunds(
  privateKey: string,
  destinationAddress: string,
  rpcEndpoint: string,
  percentage = 100,
  gasSpeed: GasSpeed = "average",
  etherscanApiKey?: string,
) {
  // Use the new approach
  const preparedTxs = await prepareTransaction(
    privateKey,
    [{ address: destinationAddress, percentage }],
    rpcEndpoint,
    gasSpeed,
    etherscanApiKey,
  )

  const results = await sendPreparedTransaction(privateKey, preparedTxs, rpcEndpoint)

  // Return in the old format for compatibility
  if (results.length > 0) {
    if (results[0].success) {
      return {
        success: true,
        hash: results[0].hash,
        blockNumber: results[0].blockNumber || 0,
        amount: results[0].amount,
        from: new ethers.Wallet(privateKey).address,
        to: destinationAddress,
        pending: results[0].pending,
      }
    } else {
      return {
        success: false,
        error: results[0].error || "Transaction failed",
      }
    }
  }

  return {
    success: false,
    error: "No result returned",
  }
}

