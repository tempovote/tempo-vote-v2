"use client"

import { useState, useEffect } from "react"
import { getEpochRemainingMs, formatEpochDuration } from "@/lib/epoch"

export interface EpochCountdownState {
  remainingMs: number
  formattedTime: string
  isExpired: boolean
}

/**
 * Hook to track voting time remaining until the end of the given GA expiry epoch.
 * Updates at a 30s interval (or 5s if < 1 minute).
 */
export function useEpochCountdown(
  epoch: number | undefined,
  network = "mainnet",
  isActive = true
): EpochCountdownState {
  const calculate = (): EpochCountdownState => {
    if (epoch === undefined || !isActive) {
      return { remainingMs: 0, formattedTime: "", isExpired: false }
    }
    const remainingMs = getEpochRemainingMs(epoch, network)
    return {
      remainingMs,
      formattedTime: formatEpochDuration(remainingMs),
      isExpired: remainingMs <= 0,
    }
  }

  const [state, setState] = useState<EpochCountdownState>(calculate)

  useEffect(() => {
    if (epoch === undefined || !isActive) {
      setState({ remainingMs: 0, formattedTime: "", isExpired: false })
      return
    }

    setState(calculate())

    const intervalMs = state.remainingMs < 60_000 ? 5_000 : 30_000
    const interval = setInterval(() => {
      setState(calculate())
    }, intervalMs)

    return () => clearInterval(interval)
  }, [epoch, network, isActive, state.remainingMs < 60_000])

  return state
}
