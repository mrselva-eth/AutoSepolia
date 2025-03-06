import dotenv from "dotenv"
import { transferFunds } from "./utils.js"

// Load environment variables
dotenv.config()

// Main function to check balances and transfer funds
async function main() {
  console.log("Starting Sepolia ETH auto-transfer process...")

  // Get wallet private keys from environment variables
  const walletKeys = [
    process.env.WALLET_1_PRIVATE_KEY,
    process.env.WALLET_2_PRIVATE_KEY,
    process.env.WALLET_3_PRIVATE_KEY,
    process.env.WALLET_4_PRIVATE_KEY,
    process.env.WALLET_5_PRIVATE_KEY,
  ]

  const mainWalletAddress = process.env.MAIN_WALLET_ADDRESS

  if (!mainWalletAddress) {
    console.error("Main wallet address not found in environment variables")
    process.exit(1)
  }

  // Check if all wallet keys are available
  const missingKeys = walletKeys.filter((key) => !key).length
  if (missingKeys > 0) {
    console.error(`Missing ${missingKeys} wallet private key(s) in environment variables`)
    process.exit(1)
  }

  // Process each wallet
  for (let i = 0; i < walletKeys.length; i++) {
    try {
      const walletNumber = i + 1
      console.log(`Processing wallet ${walletNumber}...`)

      await transferFunds(walletKeys[i], mainWalletAddress)

      console.log(`Wallet ${walletNumber} processed successfully`)
    } catch (error) {
      console.error(`Error processing wallet ${i + 1}:`, error.message)
      console.log(`Skipping wallet ${i + 1} due to error. Will try again in the next run.`)
    }
  }

  console.log("Auto-transfer process completed")
}

// Run the main function
main().catch((error) => {
  console.error("Error in main process:", error)
  process.exit(1)
})

