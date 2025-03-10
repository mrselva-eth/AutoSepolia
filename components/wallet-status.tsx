"use client"

import { motion } from "framer-motion"
import { Wallet, CheckCircle, AlertCircle, Clock, AlertTriangle } from "lucide-react"

interface WalletStatusProps {
  index: number
  balance: string
  status: "idle" | "processing" | "success" | "error" | "low_balance"
  error?: string
}

export function WalletStatus({ index, balance, status, error }: WalletStatusProps) {
  const getStatusIcon = () => {
    switch (status) {
      case "processing":
        return (
          <div className="animate-pulse">
            <Clock className="h-5 w-5 text-yellow-500" />
          </div>
        )
      case "success":
        return <CheckCircle className="h-5 w-5 text-green-500" />
      case "error":
        return <AlertCircle className="h-5 w-5 text-red-500" />
      case "low_balance":
        return <AlertTriangle className="h-5 w-5 text-orange-500" />
      default:
        return <Wallet className="h-5 w-5 text-gray-500" />
    }
  }

  const getStatusText = () => {
    switch (status) {
      case "processing":
        return "Processing"
      case "success":
        return "Transferred"
      case "error":
        return "Failed"
      case "low_balance":
        return "Low Balance"
      default:
        return "Idle"
    }
  }

  // Add a safe balance display
  const displayBalance = balance || "0"

  const getStatusColor = () => {
    switch (status) {
      case "processing":
        return "border-yellow-200 bg-yellow-50 dark:border-yellow-900/50 dark:bg-yellow-900/10"
      case "success":
        return "border-green-200 bg-green-50 dark:border-green-900/50 dark:bg-green-900/10"
      case "error":
        return "border-red-200 bg-red-50 dark:border-red-900/50 dark:bg-red-900/10"
      case "low_balance":
        return "border-orange-200 bg-orange-50 dark:border-orange-900/50 dark:bg-orange-900/10"
      default:
        return "border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-900/20"
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.1 }}
      className={`flex flex-col p-3 rounded-md border ${getStatusColor()}`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          {getStatusIcon()}
          <div className="ml-3">
            <div className="text-sm font-medium">Wallet {index + 1}</div>
            <div className="text-xs text-gray-500 dark:text-gray-400">Balance: {displayBalance} ETH</div>
          </div>
        </div>
        <div className="text-sm font-medium">{getStatusText()}</div>
      </div>

      {(status === "error" || status === "low_balance") && error && (
        <div
          className={`mt-2 text-xs ${status === "low_balance" ? "text-orange-500" : "text-red-500"} flex items-start`}
        >
          {status === "low_balance" ? (
            <AlertTriangle className="h-3 w-3 mr-1 mt-0.5 flex-shrink-0" />
          ) : (
            <AlertCircle className="h-3 w-3 mr-1 mt-0.5 flex-shrink-0" />
          )}
          <span>{error}</span>
        </div>
      )}

      {status === "processing" && (
        <div className="mt-2 text-xs text-yellow-500 flex items-start">
          <Clock className="h-3 w-3 mr-1 mt-0.5 flex-shrink-0" />
          <span>Transaction in progress. This may take several minutes on the Sepolia network.</span>
        </div>
      )}
    </motion.div>
  )
}

