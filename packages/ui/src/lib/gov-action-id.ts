import { bech32 } from "bech32"

/** CIP-129: txHash (32 bytes hex) + index (1 byte) → bech32 "gov_action1…". Trả "" nếu encode lỗi. */
export function govActionIdToBech32(txHash: string, index: number): string {
  try {
    const payload = new Uint8Array(33)
    for (let i = 0; i < 32; i++) {
      payload[i] = parseInt(txHash.slice(i * 2, i * 2 + 2), 16)
    }
    payload[32] = index & 0xff
    return bech32.encode("gov_action", bech32.toWords(payload), 200)
  } catch {
    return ""
  }
}
