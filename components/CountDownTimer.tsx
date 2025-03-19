"use client"

import { Card } from "@/components/ui/card"
import { useEffect, useState } from "react"

interface CountdownTimerProps {
  targetDate: Date
  onExpire?: () => void
}

interface TimeRemaining {
  days: number
  hours: number
  minutes: number
  seconds: number
  total: number
}

export function CountdownTimer({ targetDate, onExpire }: CountdownTimerProps) {
  const [timeRemaining, setTimeRemaining] = useState<TimeRemaining>({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
    total: 0,
  })

  useEffect(() => {
    const calculateTimeRemaining = (): TimeRemaining => {
      const now = new Date().getTime()
      const target = targetDate.getTime()
      const difference = target - now

      // If expired
      if (difference <= 0) {
        return {
          days: 0,
          hours: 0,
          minutes: 0,
          seconds: 0,
          total: 0,
        }
      }

      // Calculate time units
      const days = Math.floor(difference / (1000 * 60 * 60 * 24))
      const hours = Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
      const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60))
      const seconds = Math.floor((difference % (1000 * 60)) / 1000)

      return {
        days,
        hours,
        minutes,
        seconds,
        total: difference,
      }
    }

    // Initial calculation
    setTimeRemaining(calculateTimeRemaining())

    // Update every second
    const interval = setInterval(() => {
      const remaining = calculateTimeRemaining()
      setTimeRemaining(remaining)

      if (remaining.total <= 0 && onExpire) {
        onExpire()
        clearInterval(interval)
      }
    }, 1000)

    return () => clearInterval(interval)
  }, [targetDate, onExpire])

  return (
    <div className="grid grid-cols-4 gap-2">
      <TimeUnit value={timeRemaining.days} label="Days" />
      <TimeUnit value={timeRemaining.hours} label="Hours" />
      <TimeUnit value={timeRemaining.minutes} label="Mins" />
      <TimeUnit value={timeRemaining.seconds} label="Secs" />
    </div>
  )
}

interface TimeUnitProps {
  value: number
  label: string
}

function TimeUnit({ value, label }: TimeUnitProps) {
  const formattedValue = value < 10 ? `0${value}` : `${value}`

  return (
    <div className="flex flex-col items-center">
      <Card className="w-full p-2 flex items-center justify-center bg-muted">
        <span className="text-xl font-bold">{formattedValue}</span>
      </Card>
      <span className="text-xs text-muted-foreground mt-1">{label}</span>
    </div>
  )
}
