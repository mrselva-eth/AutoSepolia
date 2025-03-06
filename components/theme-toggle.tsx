"use client"

import { useState, useEffect } from "react"
import { useTheme } from "next-themes"
import { Sun, Moon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { motion } from "framer-motion"

export function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  // Avoid hydration mismatch
  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return null
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5 }}>
      <Button
        variant="outline"
        size="icon"
        onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
        className="rounded-full border-green-200 hover:bg-green-50 hover:text-green-700 dark:border-green-900/50 dark:hover:bg-green-900/20 dark:hover:text-green-400"
      >
        {theme === "dark" ? (
          <Sun className="h-5 w-5 text-green-600 dark:text-green-500" />
        ) : (
          <Moon className="h-5 w-5 text-green-600 dark:text-green-500" />
        )}
        <span className="sr-only">Toggle theme</span>
      </Button>
    </motion.div>
  )
}

