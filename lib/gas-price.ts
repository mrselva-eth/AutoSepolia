import { ethers } from "ethers"

// Interface for Etherscan gas price response
interface EtherscanGasPriceResponse {
  status: string
  message: string
  result: {
    LastBlock: string
    SafeGasPrice: string
    ProposeGasPrice: string
    FastGasPrice: string
    suggestBaseFee: string
    gasUsedRatio: string
  }
}

// Gas price options
export type GasSpeed = "slow" | "average" | "fast"

// Cache for Etherscan gas prices
let cachedEtherscanGasPrice: EtherscanGasPriceResponse | null = null
let lastEtherscanFetch = 0
const CACHE_DURATION = 2 * 60 * 1000 // 2 minutes

/**
 * Get gas price from Etherscan API
 * @param network The Ethereum network (mainnet, goerli, sepolia)
 * @param apiKey Etherscan API key
 * @returns Gas price data or null if request fails
 */
export async function getEtherscanGasPrice(
  network: "mainnet" | "goerli" | "sepolia" = "sepolia",
  apiKey?: string,
): Promise<EtherscanGasPriceResponse | null> {
  // Check cache first
  const now = Date.now()
  if (cachedEtherscanGasPrice && now - lastEtherscanFetch < CACHE_DURATION) {
    return cachedEtherscanGasPrice
  }

  // Determine API URL based on network
  let apiUrl = "https://api.etherscan.io/api"
  if (network === "goerli") {
    apiUrl = "https://api-goerli.etherscan.io/api"
  } else if (network === "sepolia") {
    apiUrl = "https://api-sepolia.etherscan.io/api"
  }

  // Build the request URL
  const url = `${apiUrl}?module=gastracker&action=gasoracle${apiKey ? `&apikey=${apiKey}` : ""}`

  try {
    const response = await fetch(url)
    if (!response.ok) {
      console.warn(`Etherscan API returned status ${response.status}`)
      return null
    }

    const data = (await response.json()) as EtherscanGasPriceResponse
    if (data.status !== "1") {
      console.warn(`Etherscan API returned error: ${data.message}`)
      return null
    }

    // Update cache
    cachedEtherscanGasPrice = data
    lastEtherscanFetch = now

    return data
  } catch (error) {
    console.error("Error fetching gas price from Etherscan:", error)
    return null
  }
}

/**
 * Get gas price with fallback mechanisms
 * @param provider Ethers provider
 * @param speed Gas speed preference
 * @param etherscanApiKey Optional Etherscan API key
 * @returns Gas price in wei
 */
export async function getGasPrice(
  provider: ethers.JsonRpcProvider,
  speed: GasSpeed = "average",
  etherscanApiKey?: string,
): Promise<bigint> {
  // For Sepolia, we'll prioritize getting gas prices directly from the provider
  // since the Etherscan Gas Tracker might not be fully supported
  try {
    const feeData = await provider.getFeeData()
    const baseFee = feeData.gasPrice || ethers.parseUnits("20", "gwei")
    const priorityFee = feeData.maxPriorityFeePerGas || ethers.parseUnits("2", "gwei")

    // Apply multiplier based on speed
    let multiplier = 1.0
    switch (speed) {
      case "slow":
        multiplier = 0.9
        break
      case "fast":
        multiplier = 1.5
        break
      case "average":
      default:
        multiplier = 1.2
        break
    }

    // Calculate gas price with speed multiplier
    const gasPrice = BigInt(Math.floor(Number(baseFee) * multiplier)) + priorityFee

    // Ensure minimum gas price (especially important for testnets)
    const minGasPrice = ethers.parseUnits("8", "gwei")
    return gasPrice > minGasPrice ? gasPrice : minGasPrice
  } catch (error) {
    console.error("Error getting gas price from provider:", error)

    // Try to get gas price from Etherscan as a fallback
    const etherscanData = await getEtherscanGasPrice("sepolia", etherscanApiKey)

    if (etherscanData) {
      // Convert gas price based on selected speed
      let gasPriceGwei: string
      switch (speed) {
        case "slow":
          gasPriceGwei = etherscanData.result.SafeGasPrice
          break
        case "fast":
          gasPriceGwei = etherscanData.result.FastGasPrice
          break
        case "average":
        default:
          gasPriceGwei = etherscanData.result.ProposeGasPrice
          break
      }

      // Convert from Gwei to Wei
      return ethers.parseUnits(gasPriceGwei, "gwei")
    }

    // Last resort fallback
    switch (speed) {
      case "slow":
        return ethers.parseUnits("8", "gwei")
      case "fast":
        return ethers.parseUnits("15", "gwei")
      case "average":
      default:
        return ethers.parseUnits("10", "gwei")
    }
  }
}

