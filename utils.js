import { ethers } from "ethers"
import dotenv from "dotenv"

dotenv.config()

const INFURA_PROJECT_ID = process.env.INFURA_PROJECT_ID

if (!INFURA_PROJECT_ID) {
  throw new Error("INFURA_PROJECT_ID is not set in the environment variables")
}

const RPC_ENDPOINT = `https://sepolia.infura.io/v3/${INFURA_PROJECT_ID}`

// Function to wait for a transaction to be mined or timeout
async function waitForTransaction(provider, txHash, timeout = 30000) {
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
async function getCurrentGasPrice(provider) {
  const feeData = await provider.getFeeData()
  const baseFee = feeData.gasPrice
  const priorityFee = feeData.maxPriorityFeePerGas || ethers.parseUnits("1", "gwei")
  return baseFee + priorityFee
}

// Function to transfer funds from a wallet to the main wallet
export async function transferFunds(privateKey, mainWalletAddress) {
  const provider = new ethers.JsonRpcProvider(RPC_ENDPOINT)

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
    console.log(`Balance too low to transfer (< ${ethers.formatEther(minBalance)} SepoliaETH)`)
    return
  }

  // Calculate amount to transfer (balance - gas reserve)
  const transferAmount = balance - gasReserve

  // Estimate gas for the transaction
  const gasLimit = 21000n // Standard ETH transfer gas limit

  // Retry mechanism
  const maxRetries = 3
  for (let i = 0; i < maxRetries; i++) {
    try {
      // Get current gas price
      const gasPrice = await getCurrentGasPrice(provider)
      const gasCost = gasPrice * gasLimit

      // Adjust transfer amount if needed
      const finalTransferAmount = transferAmount
      if (transferAmount - gasCost <= 0n) {
        console.log("Not enough balance to cover transfer after gas costs")
        return
      }

      console.log(`Attempt ${i + 1} with gas price: ${ethers.formatUnits(gasPrice, "gwei")} Gwei`)
      console.log(`Transferring ${ethers.formatEther(finalTransferAmount)} SepoliaETH to ${mainWalletAddress}`)

      // Create and send transaction
      const tx = {
        to: mainWalletAddress,
        value: finalTransferAmount,
        gasLimit: gasLimit,
        maxFeePerGas: gasPrice,
      }

      const transaction = await wallet.sendTransaction(tx)
      console.log(`Transaction sent: ${transaction.hash}`)

      // Wait for transaction to be mined or timeout
      try {
        const receipt = await waitForTransaction(provider, transaction.hash)
        console.log(`Transaction confirmed in block ${receipt.blockNumber}`)
        return receipt
      } catch (timeoutError) {
        console.log(`Transaction not mined within 30 seconds. Retrying with current gas price.`)
        // Continue to next iteration to retry with current gas price
      }
    } catch (error) {
      console.error(`Error in attempt ${i + 1}:`, error.message)
      if (i === maxRetries - 1) {
        throw error // Throw error on last attempt
      }
      // Wait for 5 seconds before next attempt
      await new Promise((resolve) => setTimeout(resolve, 5000))
    }
  }
}

