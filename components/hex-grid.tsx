"use client"

import { useEffect, useRef } from "react"
import { useTheme } from "next-themes"

export function HexGrid() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const { theme } = useTheme()

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    // Set canvas dimensions
    const setCanvasDimensions = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
    }

    setCanvasDimensions()
    window.addEventListener("resize", setCanvasDimensions)

    // Hexagon properties
    const hexSize = 30
    const hexHeight = hexSize * Math.sqrt(3)
    const hexWidth = hexSize * 2
    const hexVerticalSpacing = hexHeight
    const hexHorizontalSpacing = hexWidth * 0.75

    // Calculate number of hexagons needed
    const columns = Math.ceil(canvas.width / hexHorizontalSpacing) + 1
    const rows = Math.ceil(canvas.height / hexVerticalSpacing) + 1

    // Animation properties
    let time = 0
    const hexagons: { x: number; y: number; phase: number; speed: number }[] = []

    // Initialize hexagons
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < columns; col++) {
        const x = col * hexHorizontalSpacing
        const y = row * hexVerticalSpacing + (col % 2 === 0 ? 0 : hexHeight / 2)

        hexagons.push({
          x,
          y,
          phase: Math.random() * Math.PI * 2,
          speed: 0.5 + Math.random() * 0.5,
        })
      }
    }

    // Draw a single hexagon
    function drawHexagon(x: number, y: number, size: number, opacity: number, isDark: boolean) {
      ctx.beginPath()
      for (let i = 0; i < 6; i++) {
        const angle = (Math.PI / 3) * i
        const hx = x + size * Math.cos(angle)
        const hy = y + size * Math.sin(angle)

        if (i === 0) {
          ctx.moveTo(hx, hy)
        } else {
          ctx.lineTo(hx, hy)
        }
      }
      ctx.closePath()

      // Set stroke style with gradient
      if (isDark) {
        const gradient = ctx.createLinearGradient(x - size, y - size, x + size, y + size)
        gradient.addColorStop(0, `rgba(16, 185, 129, ${opacity * 0.7})`)
        gradient.addColorStop(1, `rgba(6, 182, 212, ${opacity * 0.7})`)
        ctx.strokeStyle = gradient
      } else {
        ctx.strokeStyle = `rgba(16, 185, 129, ${opacity * 0.3})`
      }

      ctx.lineWidth = 1
      ctx.stroke()
    }

    // Animation loop
    function animate() {
      const isDark = document.documentElement.classList.contains("dark")
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      time += 0.01

      hexagons.forEach((hex) => {
        const opacity = 0.1 + 0.2 * Math.sin(time * hex.speed + hex.phase)
        drawHexagon(hex.x, hex.y, hexSize, opacity, isDark)
      })

      requestAnimationFrame(animate)
    }

    animate()

    return () => {
      window.removeEventListener("resize", setCanvasDimensions)
    }
  }, [theme])

  return <canvas ref={canvasRef} className="fixed top-0 left-0 w-full h-full -z-10" />
}

