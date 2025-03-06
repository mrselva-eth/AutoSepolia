import { NextResponse } from "next/server"
import { getEtherscanGasPrice } from "@/lib/gas-price"

// Cache gas prices for 2 minutes to reduce API calls
let cachedGasPrices: {
  slow: string
  average: string
  fast: string
  baseFee: string
  source: string
  timestamp: number
} | null = null

// Cache duration in milliseconds (2 minutes)
const CACHE_DURATION = 2 * 60 * 1000

export async function GET() {
  try {
    // Check if we have valid cached data
    const now = Date.now()
    if (cachedGasPrices && now - cachedGasPrices.timestamp < CACHE_DURATION) {
      return NextResponse.json({
        ...cachedGasPrices,
        cached: true,
      })
    }

    // Get Etherscan API key from environment variables
    const etherscanApiKey = process.env.ETHERSCAN_API_KEY || ""

    // Try to get gas prices from Etherscan
    const etherscanData = await getEtherscanGasPrice("sepolia", etherscanApiKey)

    if (etherscanData) {
      // Cache and return the gas prices from Etherscan
      cachedGasPrices = {
        slow: etherscanData.result.SafeGasPrice,
        average: etherscanData.result.ProposeGasPrice,
        fast: etherscanData.result.FastGasPrice,
        baseFee: etherscanData.result.suggestBaseFee,
        source: "etherscan",
        timestamp: now,
      }

      return NextResponse.json({
        ...cachedGasPrices,
        cached: false,
      })
    }

    // For Sepolia, try to get gas prices from the provider directly
    // Since Etherscan Gas Tracker might not be fully supported on Sepolia

    // Fallback to default values
    cachedGasPrices = {
      slow: "8",
      average: "10",
      fast: "15",
      baseFee: "8",
      source: "fallback",
      timestamp: now,
    }

    return NextResponse.json({
      ...cachedGasPrices,
      cached: false,
    })
  } catch (error) {
    console.error("Error fetching gas price:", error)

    // Return error response with fallback values
    return NextResponse.json(
      {
        error: "Failed to fetch gas prices",
        slow: "8",
        average: "10",
        fast: "15",
        source: "error",
        timestamp: Date.now(),
      },
      { status: 500 },
    )
  }
}

