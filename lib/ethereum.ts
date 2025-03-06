import { ethers } from "ethers"

// Function to wait for a transaction to be mined or timeout
export async function waitForTransaction(provider: ethers.JsonRpcProvider, txHash: string, timeout = 30000) {
  const startTime = Date.now()
  while (Date.now() - startTime < timeout) {
    const receipt = await provider.getTransactionReceipt(txHash)
    if (receipt) {
      return receipt
    }
    await new Promise((resolve) => setTimeout(resolve, 1000)) // Wait 1 second before checking again
  }
  throw new Error("Transaction not mined within the timeout period")
}

// Function to get current gas price with optional priority fee
export async function getCurrentGasPrice(provider: ethers.JsonRpcProvider) {
  const feeData = await provider.getFeeData()
  const baseFee = feeData.gasPrice || ethers.parseUnits("10", "gwei")
  const priorityFee = feeData.maxPriorityFeePerGas || ethers.parseUnits("1", "gwei")
  return baseFee + priorityFee
}

// Function to transfer funds from a wallet to a destination wallet
export async function transferFunds(
  privateKey: string,
  destinationAddress: string,
  rpcEndpoint: string,
  percentage = 100,
) {
  const provider = new ethers.JsonRpcProvider(rpcEndpoint)

  // Create wallet instance
  const wallet = new ethers.Wallet(privateKey, provider)
  const walletAddress = wallet.address

  // Get current balance
  const balance = await provider.getBalance(walletAddress)
  console.log(`Wallet ${walletAddress} balance: ${ethers.formatEther(balance)} SepoliaETH`)

  // Check if balance is too low to transfer (need to keep some for gas)
  const minBalance = ethers.parseEther("0.005") // Minimum balance to initiate transfer
  const gasReserve = ethers.parseEther("0.002") // Keep some ETH for gas

  if (balance < minBalance) {
    throw new Error(`Balance too low to transfer (< ${ethers.formatEther(minBalance)} SepoliaETH)`)
  }

  // Calculate amount to transfer based on percentage (balance - gas reserve)
  const maxTransferAmount = balance - gasReserve
  const transferAmount = BigInt(Math.floor(Number(maxTransferAmount) * (percentage / 100)))

  // Estimate gas for the transaction
  const gasLimit = BigInt(21000) // Standard ETH transfer gas limit

  // Get current gas price
  const gasPrice = await getCurrentGasPrice(provider)
  const gasCost = gasPrice * gasLimit

  // Adjust transfer amount if needed
  if (transferAmount - gasCost <= BigInt(0)) {
    throw new Error("Not enough balance to cover transfer after gas costs")
  }

  console.log(`Transferring ${ethers.formatEther(transferAmount)} SepoliaETH to ${destinationAddress}`)

  // Create and send transaction
  const tx = {
    to: destinationAddress,
    value: transferAmount,
    gasLimit: gasLimit,
    maxFeePerGas: gasPrice,
  }

  const transaction = await wallet.sendTransaction(tx)
  console.log(`Transaction sent: ${transaction.hash}`)

  // Wait for transaction to be mined
  try {
    const receipt = await waitForTransaction(provider, transaction.hash)
    console.log(`Transaction confirmed in block ${receipt.blockNumber}`)
    return {
      success: true,
      hash: transaction.hash,
      blockNumber: receipt.blockNumber,
      amount: ethers.formatEther(transferAmount),
      from: walletAddress,
      to: destinationAddress,
    }
  } catch (error) {
    console.error("Transaction failed:", error)
    throw error
  }
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
) {
  const results = []

  // Validate total percentage
  const totalPercentage = destinationWallets.reduce((sum, wallet) => sum + wallet.percentage, 0)
  if (Math.abs(totalPercentage - 100) > 0.01) {
    throw new Error("Total percentage must equal 100%")
  }

  for (const destWallet of destinationWallets) {
    try {
      const result = await transferFunds(sourcePrivateKey, destWallet.address, rpcEndpoint, destWallet.percentage)
      results.push({
        destination: destWallet.address,
        percentage: destWallet.percentage,
        ...result,
      })
    } catch (error) {
      results.push({
        destination: destWallet.address,
        percentage: destWallet.percentage,
        success: false,
        error: (error as Error).message,
      })
    }
  }

  return results
}

