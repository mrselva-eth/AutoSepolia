"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import { Wifi } from "lucide-react"

export function NetworkStatus() {
  const [isConnected, setIsConnected] = useState(true)
  const [pingTime, setPingTime] = useState("45")

  // Removed the interval that was making frequent checks
  // Now we'll just show a static indicator

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="w-full flex items-center justify-between p-2 rounded-md border border-green-200 bg-green-50 dark:border-green-900/30 dark:bg-black/40"
    >
      <div className="flex items-center">
        <Wifi className={`h-4 w-4 mr-2 ${isConnected ? "text-green-600 dark:text-green-500" : "text-red-500"}`} />
        <span className="text-xs">Sepolia Network</span>
      </div>
      <div className="flex items-center">
        <motion.div
          animate={{
            backgroundColor: isConnected ? "#10b981" : "#ef4444",
          }}
          className="h-2 w-2 rounded-full mr-2 bg-green-500"
        />
        <span className="text-xs">{isConnected ? `${pingTime}ms` : "Disconnected"}</span>
      </div>
    </motion.div>
  )
}

