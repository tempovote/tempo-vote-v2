/**
 * Epoch timing parameters and countdown helpers for Cardano networks.
 *
 * Mainnet:
 * - Genesis start: 2017-09-23T21:44:51Z (1506203091 s)
 * - Epoch duration: 432,000 s (5 days)
 *
 * Preprod:
 * - Genesis start: 2022-06-01T00:00:00Z (1654041600 s)
 * - Epoch duration: 86,400 s (1 day)
 *
 * Preview (fallback):
 * - Genesis start: 2022-10-25T00:00:00Z (1666656000 s)
 * - Epoch duration: 86,400 s (1 day)
 */

export interface NetworkEpochConfig {
  startTimeSec: number
  epochLengthSec: number
}

const MAINNET_CONFIG: NetworkEpochConfig = {
  startTimeSec: 1506203091,
  epochLengthSec: 432000,
}

export const NETWORK_EPOCH_CONFIGS: Record<string, NetworkEpochConfig> = {
  mainnet: MAINNET_CONFIG,
  preprod: {
    startTimeSec: 1654041600,
    epochLengthSec: 86400,
  },
  preview: {
    startTimeSec: 1666656000,
    epochLengthSec: 86400,
  },
}

/**
 * Returns the timestamp (in ms) when an epoch ends.
 * In Cardano, epoch N ends at the start of epoch N + 1.
 */
export function getEpochEndTimeMs(epoch: number, network = "mainnet"): number {
  const config = NETWORK_EPOCH_CONFIGS[network] ?? MAINNET_CONFIG
  const endSec = config.startTimeSec + (epoch + 1) * config.epochLengthSec
  return endSec * 1000
}

/**
 * Computes the remaining milliseconds until the end of the given epoch.
 */
export function getEpochRemainingMs(epoch: number, network = "mainnet", nowMs = Date.now()): number {
  const endMs = getEpochEndTimeMs(epoch, network)
  return Math.max(0, endMs - nowMs)
}

/**
 * Formats remaining time into a concise human-readable string:
 * - If >= 1 day: "Xd Yh" (e.g. "2d 9h")
 * - If < 1 day and >= 1 hour: "Xh Ym" (e.g. "4h 15m")
 * - If < 1 hour and >= 1 min: "Xm" (e.g. "45m")
 * - If < 1 min: "< 1m"
 */
export function formatEpochDuration(ms: number): string {
  if (ms <= 0) return ""

  const totalSec = Math.floor(ms / 1000)
  const days = Math.floor(totalSec / 86400)
  const hours = Math.floor((totalSec % 86400) / 3600)
  const minutes = Math.floor((totalSec % 3600) / 60)

  if (days > 0) {
    return `${days}d ${hours}h`
  }
  if (hours > 0) {
    return `${hours}h ${minutes}m`
  }
  if (minutes > 0) {
    return `${minutes}m`
  }
  return "< 1m"
}
