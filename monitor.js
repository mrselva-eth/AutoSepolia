import dotenv from "dotenv"
import cron from "node-cron"
import { transferFunds } from "./utils.js"

// Load environment variables
dotenv.config()

// Function to check balances and transfer funds
async function checkAndTransfer() {
  console.log("Running scheduled balance check at:", new Date().toISOString())

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
    return
  }

  // Check if all wallet keys are available
  const missingKeys = walletKeys.filter((key) => !key).length
  if (missingKeys > 0) {
    console.error(`Missing ${missingKeys} wallet private key(s) in environment variables`)
    return
  }

  // Process each wallet
  for (let i = 0; i < walletKeys.length; i++) {
    try {
      const walletNumber = i + 1
      console.log(`Checking wallet ${walletNumber}...`)

      await transferFunds(walletKeys[i], mainWalletAddress)
    } catch (error) {
      console.error(`Error processing wallet ${i + 1}:`, error.message)
    }
  }

  console.log("Scheduled check completed")
}

// Schedule the task to run every hour
// You can adjust the schedule as needed: https://github.com/node-cron/node-cron#cron-syntax
console.log("Starting monitoring service...")
console.log("The script will check balances and transfer funds automatically on schedule")
console.log("Press Ctrl+C to stop the service")

// Run immediately on startup
checkAndTransfer().catch((error) => {
  console.error("Error in initial check:", error)
})

// Then schedule to run every hour
cron.schedule("0 * * * *", () => {
  checkAndTransfer().catch((error) => {
    console.error("Error in scheduled check:", error)
  })
})

