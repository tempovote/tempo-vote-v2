import { useWalletStore } from "@/store/wallet"

/** Returns the current JWT from the wallet store, or null if not authenticated. */
export function getJwt(): string | null {
  return useWalletStore.getState().jwt
}

/** Returns Authorization header object if JWT is present, else empty object. */
export function authHeader(jwt: string | null): Record<string, string> {
  return jwt ? { Authorization: `Bearer ${jwt}` } : {}
}
