import { ethers } from "ethers"
import { getGasPrice, type GasSpeed } from "./gas-price"

// Function to wait for a transaction to be mined or timeout
export async function waitForTransaction(provider: ethers.JsonRpcProvider, txHash: string, timeout = 120000) {
  // Increased timeout to 120 seconds for Sepolia network
  const startTime = Date.now()
  while (Date.now() - startTime < timeout) {
    const receipt = await provider.getTransactionReceipt(txHash)
    if (receipt) {
      return receipt
    }
    await new Promise((resolve) => setTimeout(resolve, 2000)) // Check every 2 seconds
  }
  throw new Error("Transaction not mined within the timeout period")
}

// Function to transfer funds from a wallet to a destination wallet
export async function transferFunds(
  privateKey: string,
  destinationAddress: string,
  rpcEndpoint: string,
  percentage = 100,
  gasSpeed: GasSpeed = "average",
  etherscanApiKey?: string,
) {
  console.log(`Starting transfer to ${destinationAddress}...`)
  const provider = new ethers.JsonRpcProvider(rpcEndpoint)

  // Create wallet instance
  const wallet = new ethers.Wallet(privateKey, provider)
  const walletAddress = wallet.address

  // Get current balance
  const balance = await provider.getBalance(walletAddress)
  console.log(`Wallet ${walletAddress} balance: ${ethers.formatEther(balance)} SepoliaETH`)

  // Check if balance is too low to transfer (need to keep some for gas)
  const minBalance = ethers.parseEther("0.005") // Minimum balance to initiate transfer
  const gasReserve = ethers.parseEther("0.003") // Increased gas reserve

  if (balance < minBalance) {
    throw new Error(`Balance too low to transfer (< ${ethers.formatEther(minBalance)} SepoliaETH)`)
  }

  // Calculate amount to transfer based on percentage (balance - gas reserve)
  const maxTransferAmount = balance - gasReserve
  const transferAmount = BigInt(Math.floor(Number(maxTransferAmount) * (percentage / 100)))

  // Estimate gas for the transaction
  const gasLimit = BigInt(21000) // Standard ETH transfer gas limit

  // Retry mechanism with increasing gas price and proper nonce management
  const maxRetries = 3
  let lastError = null
  let nonce = null

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      // Get gas price based on speed and attempt number
      // For retries, we gradually increase the speed
      let currentSpeed: GasSpeed = gasSpeed
      if (attempt === 1) {
        currentSpeed = "average" // Second attempt uses average speed if not already
      } else if (attempt === 2) {
        currentSpeed = "fast" // Third attempt uses fast speed
      }

      console.log(`Getting gas price for speed: ${currentSpeed} (attempt ${attempt + 1})`)
      const gasPrice = await getGasPrice(provider, currentSpeed, etherscanApiKey)

      // For retries, boost the gas price significantly to replace the transaction
      const boostFactor = 1.0 + attempt * 0.3 // 1.0x, 1.3x, 1.6x
      const boostedGasPrice = attempt > 0 ? BigInt(Math.floor(Number(gasPrice) * boostFactor)) : gasPrice

      console.log(`Gas price: ${ethers.formatUnits(boostedGasPrice, "gwei")} Gwei${attempt > 0 ? " (boosted)" : ""}`)

      // Get the nonce for the first attempt and reuse it for retries
      if (nonce === null) {
        nonce = await provider.getTransactionCount(wallet.address, "pending")
        console.log(`Using nonce: ${nonce}`)
      }

      const gasCost = boostedGasPrice * gasLimit

      // Adjust transfer amount if needed
      if (transferAmount - gasCost <= BigInt(0)) {
        throw new Error("Not enough balance to cover transfer after gas costs")
      }

      console.log(`Transferring ${ethers.formatEther(transferAmount)} SepoliaETH to ${destinationAddress}`)

      // Create and send transaction with explicit nonce
      const tx = {
        to: destinationAddress,
        value: transferAmount,
        gasLimit: gasLimit,
        maxFeePerGas: boostedGasPrice,
        maxPriorityFeePerGas: ethers.parseUnits((2 + attempt).toString(), "gwei"),
        nonce: nonce,
      }

      console.log("Sending transaction...")
      const transaction = await wallet.sendTransaction(tx)
      console.log(`Transaction sent: ${transaction.hash}`)

      // Wait for transaction to be mined
      console.log("Waiting for transaction confirmation...")
      const receipt = await waitForTransaction(provider, transaction.hash)
      console.log(`Transaction confirmed in block ${receipt.blockNumber}`)

      // Verify the transaction was successful
      if (receipt.status === 0) {
        throw new Error("Transaction failed on the blockchain")
      }

      return {
        success: true,
        hash: transaction.hash,
        blockNumber: receipt.blockNumber,
        amount: ethers.formatEther(transferAmount),
        from: walletAddress,
        to: destinationAddress,
      }
    } catch (error) {
      console.error(`Attempt ${attempt + 1} failed:`, error)
      lastError = error

      // Check if this is a "replacement transaction underpriced" error
      const errorMessage = (error as Error).message || ""
      if (
        errorMessage.includes("replacement transaction underpriced") ||
        errorMessage.includes("could not replace existing tx")
      ) {
        console.log("Transaction replacement requires higher gas price")
      }

      // If this is not the last attempt, wait before retrying
      if (attempt < maxRetries - 1) {
        const waitTime = 5000 + attempt * 2000 // 5s, 7s, 9s
        console.log(`Retrying in ${waitTime / 1000} seconds with higher gas price...`)
        await new Promise((resolve) => setTimeout(resolve, waitTime))
      }
    }
  }

  // If we've exhausted all retries, throw the last error
  throw lastError || new Error("Failed to send transaction after multiple attempts")
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
  const results = []

  // Validate total percentage
  const totalPercentage = destinationWallets.reduce((sum, wallet) => sum + wallet.percentage, 0)
  if (Math.abs(totalPercentage - 100) > 0.01) {
    throw new Error("Total percentage must equal 100%")
  }

  // If we're distributing to multiple wallets, we need to handle each transfer separately
  if (destinationWallets.length > 1) {
    // Get source wallet balance first
    const provider = new ethers.JsonRpcProvider(rpcEndpoint)
    const wallet = new ethers.Wallet(sourcePrivateKey, provider)
    const balance = await provider.getBalance(wallet.address)

    console.log(`Source wallet ${wallet.address} has ${ethers.formatEther(balance)} ETH`)

    // Check if balance is too low
    const minBalance = ethers.parseEther("0.005")
    if (balance < minBalance) {
      throw new Error(`Balance too low to transfer (< ${ethers.formatEther(minBalance)} SepoliaETH)`)
    }

    // Calculate available amount after gas reserve
    const gasReserve = ethers.parseEther("0.003") * BigInt(destinationWallets.length)
    const availableAmount = balance - gasReserve

    if (availableAmount <= BigInt(0)) {
      throw new Error("Not enough balance to cover transfers after gas costs")
    }

    // Process each destination wallet
    for (const destWallet of destinationWallets) {
      try {
        // Calculate amount for this wallet based on percentage
        const amountForWallet = BigInt(Math.floor(Number(availableAmount) * (destWallet.percentage / 100)))

        console.log(
          `Transferring ${ethers.formatEther(amountForWallet)} ETH (${destWallet.percentage}%) to ${destWallet.address}`,
        )

        // Use the transferFunds function with retry mechanism
        const result = await transferFunds(
          sourcePrivateKey,
          destWallet.address,
          rpcEndpoint,
          destWallet.percentage,
          gasSpeed,
          etherscanApiKey,
        )

        results.push({
          destination: destWallet.address,
          percentage: destWallet.percentage,
          ...result,
        })
      } catch (error) {
        console.error(`Error transferring to ${destWallet.address}:`, error)
        results.push({
          destination: destWallet.address,
          percentage: destWallet.percentage,
          success: false,
          error: (error as Error).message,
        })
      }
    }
  } else {
    // If only one destination, use the standard transfer function
    try {
      const result = await transferFunds(
        sourcePrivateKey,
        destinationWallets[0].address,
        rpcEndpoint,
        destinationWallets[0].percentage,
        gasSpeed,
        etherscanApiKey,
      )
      results.push({
        destination: destinationWallets[0].address,
        percentage: destinationWallets[0].percentage,
        ...result,
      })
    } catch (error) {
      results.push({
        destination: destinationWallets[0].address,
        percentage: destinationWallets[0].percentage,
        success: false,
        error: (error as Error).message,
      })
    }
  }

  // Check if any transfers were successful
  const anySuccess = results.some((result) => result.success)
  if (!anySuccess) {
    throw new Error("All transfers failed. Check console for details.")
  }

  return results
}

