import { bech32 } from "bech32"
import { blake2b } from "@noble/hashes/blake2.js"
import type { NetworkId } from "./types"

/**
 * Derive a CIP-129 DRep ID from a raw public DRep key (hex).
 * Formula: bech32("drep", blake2b_224(pubkey))
 */
export function pubDRepKeyToDrepId(pubDRepKeyHex: string): string {
  const pubKeyBytes = Uint8Array.from(
    pubDRepKeyHex.match(/.{1,2}/g)!.map((b) => parseInt(b, 16))
  )
  const hash = blake2b(pubKeyBytes, { dkLen: 28 })
  const words = bech32.toWords(hash)
  return bech32.encode("drep", words, 200)
}

/**
 * Convert a CIP-30 hex-encoded address to bech32 format.
 *
 * CIP-30 getChangeAddress() / getUsedAddresses() return hex-encoded raw bytes
 * (despite the spec saying cbor<address>, most wallets return raw bytes).
 * This converts them to human-readable bech32: addr1... or addr_test1...
 */
export function hexAddressToBech32(hexAddr: string, networkId: NetworkId): string {
  try {
    const bytes = Uint8Array.from(
      hexAddr.match(/.{1,2}/g)!.map((b) => parseInt(b, 16))
    )

    // Detect if CBOR-wrapped: byte string major type = 0x40–0x5B
    // e.g. 0x58 means "byte string, next byte is length"
    let raw = bytes
    const firstByte = bytes[0] ?? 0
    if (firstByte >= 0x40 && firstByte <= 0x5f) {
      // CBOR short byte string: length = firstByte - 0x40
      raw = bytes.slice(1)
    } else if (firstByte === 0x58) {
      // CBOR 1-byte length prefix
      raw = bytes.slice(2)
    }

    const words = bech32.toWords(raw)
    // Detect address type from header nibble
    const header = raw[0] ?? 0
    const isStake = (header & 0xe0) === 0xe0   // 0xE_ or 0xF_
    const prefix  = networkId === 1
      ? (isStake ? "stake" : "addr")
      : (isStake ? "stake_test" : "addr_test")

    return bech32.encode(prefix, words, 200)
  } catch {
    return hexAddr  // fallback: return raw hex
  }
}
