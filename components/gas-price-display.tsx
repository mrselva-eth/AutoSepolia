"use client"

import { useState, useEffect } from "react"
import { Clock, ArrowRight, Zap } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"

interface GasPriceDisplayProps {
  speed: "slow" | "average" | "fast"
}

export function GasPriceDisplay({ speed }: GasPriceDisplayProps) {
  const [gasPrice, setGasPrice] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    async function fetchGasPrice() {
      try {
        // Try to fetch from Sepolia Etherscan API
        const response = await fetch("/api/gas-price")
        if (response.ok) {
          const data = await response.json()

          // Select the appropriate gas price based on speed
          if (speed === "slow") {
            setGasPrice(data.slow)
          } else if (speed === "average") {
            setGasPrice(data.average)
          } else {
            setGasPrice(data.fast)
          }

          setError(false)
        } else {
          // Fallback to default values
          setGasPrice(speed === "slow" ? "8" : speed === "average" ? "10" : "15")
          setError(true)
        }
      } catch (error) {
        console.error("Error fetching gas price:", error)
        // Fallback to default values
        setGasPrice(speed === "slow" ? "8" : speed === "average" ? "10" : "15")
        setError(true)
      } finally {
        setLoading(false)
      }
    }

    fetchGasPrice()

    // Refresh gas prices every 2 minutes instead of 30 seconds
    // This reduces API calls and is more appropriate for testnets
    const interval = setInterval(fetchGasPrice, 120000)

    return () => clearInterval(interval)
  }, [speed])

  const getIcon = () => {
    switch (speed) {
      case "slow":
        return <Clock className="h-4 w-4 mr-1" />
      case "fast":
        return <Zap className="h-4 w-4 mr-1" />
      default:
        return <ArrowRight className="h-4 w-4 mr-1" />
    }
  }

  return (
    <div className="flex items-center text-xs">
      {getIcon()}
      {loading ? (
        <Skeleton className="h-4 w-12" />
      ) : (
        <span className={error ? "text-yellow-500" : ""}>~{gasPrice} Gwei</span>
      )}
    </div>
  )
}

