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
  try {
    // First try to get fee data from the provider
    const feeData = await provider.getFeeData()

    // If we have maxFeePerGas, use that as a base
    if (feeData.maxFeePerGas) {
      console.log(`Provider suggested maxFeePerGas: ${ethers.formatUnits(feeData.maxFeePerGas, "gwei")} Gwei`)

      // Apply multiplier based on speed
      let multiplier = 1.0
      switch (speed) {
        case "slow":
          multiplier = 0.8
          break
        case "fast":
          multiplier = 1.3
          break
        case "average":
        default:
          multiplier = 1.0
          break
      }

      return BigInt(Math.floor(Number(feeData.maxFeePerGas) * multiplier))
    }

    // If we have gasPrice, use that
    if (feeData.gasPrice) {
      console.log(`Provider suggested gasPrice: ${ethers.formatUnits(feeData.gasPrice, "gwei")} Gwei`)

      // Apply multiplier based on speed
      let multiplier = 1.0
      switch (speed) {
        case "slow":
          multiplier = 0.8
          break
        case "fast":
          multiplier = 1.3
          break
        case "average":
        default:
          multiplier = 1.0
          break
      }

      return BigInt(Math.floor(Number(feeData.gasPrice) * multiplier))
    }

    // If we couldn't get fee data from the provider, try Etherscan
    console.log("No fee data from provider, trying Etherscan...")
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

      console.log(`Etherscan suggested gas price (${speed}): ${gasPriceGwei} Gwei`)
      return ethers.parseUnits(gasPriceGwei, "gwei")
    }

    // If all else fails, use reasonable defaults for Sepolia
    console.log("Using default gas price values")
    switch (speed) {
      case "slow":
        return ethers.parseUnits("20", "gwei")
      case "fast":
        return ethers.parseUnits("50", "gwei")
      case "average":
      default:
        return ethers.parseUnits("35", "gwei")
    }
  } catch (error) {
    console.error("Error getting gas price:", error)

    // Last resort fallback
    console.log("Using fallback gas price due to error")
    switch (speed) {
      case "slow":
        return ethers.parseUnits("20", "gwei")
      case "fast":
        return ethers.parseUnits("50", "gwei")
      case "average":
      default:
        return ethers.parseUnits("35", "gwei")
    }
  }
}

