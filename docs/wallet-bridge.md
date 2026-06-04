# Wallet Bridge

`packages/wallet-bridge` — raw CIP-30/CIP-95 implementation, không dùng MeshSDK hay library nặng.

## Usage

```typescript
import {
  connectWallet,
  getNetworkId,
  getChangeAddress,
  getRewardAddresses,
  getUtxos,
  getDRepKey,
  signTx,
  signData,
  getAvailableWallets,
} from "@tempo/wallet-bridge"

// Detect available wallets
const wallets = getAvailableWallets()  // ["eternl", "lace", ...]

// Connect with CIP-95 governance extension
const api = await connectWallet("eternl")

// Query wallet info
const networkId     = await getNetworkId(api)       // 0 | 1
const changeAddr    = await getChangeAddress(api)   // addr_test1...
const rewardAddrs   = await getRewardAddresses(api) // [stake_test1...]
const utxos         = await getUtxos(api)           // ["<cbor>", ...]

// CIP-95 DRep key
const drepKey = await getDRepKey(api)
// { pubDRepKey: "hex", dRepIDCip105: "drep1..." }

// Sign & submit
const signedCbor = await signTx(api, unsignedCbor)
const txHash     = await submitTx(api, signedCbor)

// Wallet auth (signData)
const { signature, key } = await signData(api, stakeAddress, nonce)
```

## CIP-30 specification

Spec: https://cips.cardano.org/cip/CIP-30

Wallet extensions inject `window.cardano.<walletName>` với methods:
- `enable(options?)` — request access, returns `CIP30Api`
- `isEnabled()` — check if already enabled

Sau khi `enable()`:
- `getNetworkId()` → `0` (testnet) hoặc `1` (mainnet)
- `getUtxos()` → UTxO list dạng CBOR hex
- `getChangeAddress()` → bech32 payment address
- `getRewardAddresses()` → bech32 stake addresses
- `signTx(cbor, partialSign?)` → signed tx CBOR
- `signData(addr, payload)` → `{ signature, key }`
- `submitTx(cbor)` → txHash

## CIP-95 extension (Conway governance)

Spec: https://cips.cardano.org/cip/CIP-95

Được request khi `enable({ extensions: [{ cip: 95 }] })`.

Thêm `api.cip95`:
- `getDRepKey()` → `{ pubDRepKey, dRepIDCip105, dRepIDBech32 }`
- `getRegisteredPubStakeKeys()` → registered stake keys
- `getUnregisteredPubStakeKeys()` → unregistered stake keys

## Supported wallets

| Wallet | CIP-30 | CIP-95 |
|--------|--------|--------|
| Eternl | ✅ | ✅ |
| Lace | ✅ | ✅ |
| Yoroi | ✅ | ✅ |
| Vespr | ✅ | ✅ |
| NuFi | ✅ | ✅ |

## Wallet detection

```typescript
import { getAvailableWallets, getGovernanceWallets } from "@tempo/wallet-bridge"

getAvailableWallets()    // tất cả ví detect được
getGovernanceWallets()   // chỉ ví hỗ trợ CIP-95
```

## Error handling

```typescript
try {
  const api = await connectWallet("eternl")
} catch (e) {
  // User rejected connection
  // or wallet not installed
}

try {
  const drepKey = await getDRepKey(api)
} catch (e) {
  // Wallet does not support CIP-95
  // Check hasCip95(api) before calling getDRepKey
}
```
