# Architecture

## Overview

tempo-vote-v2 là Cardano governance DApp cho DRep, được chia thành:

- **apps/web** — Next.js 15 browser DApp (TypeScript)
- **apps/api** — Kotlin/Ktor backend (transaction building + off-chain data)
- **packages/wallet-bridge** — Raw CIP-30/CIP-95 browser wallet integration
- **packages/types** — Zod schemas shared giữa FE và BE

## Transaction flow

```
[Browser]                                    [Kotlin Backend]
   │
   │ 1. wallet.getUtxos()
   │    wallet.getChangeAddress()
   │    wallet.getRewardAddresses()
   │    wallet.cip95.getDRepKey()
   │
   │ 2. POST /tx/build ──────────────────────────►
   │    { txType, utxos, changeAddress, ... }      │
   │                                               │  KupmiosBackendService
   │                                               │  QuickTxBuilder
   │                                               │  → unsigned tx CBOR
   │
   │ ◄── { unsignedTxCbor } ───────────────────────
   │
   │ 3. wallet.signTx(unsignedTxCbor)
   │    → signed CBOR (private key stays in wallet)
   │
   │ 4. POST /tx/submit ─────────────────────────►
   │    { signedTx, network }                      │
   │                                               │  Ogmios submit
   │                                               │  → txHash
   │ ◄── { txHash } ──────────────────────────────
```

## On-chain vs Off-chain data

| Data | Source | Stored in DB? |
|---|---|---|
| Governance Actions | Ogmios state query | No |
| DRep list + info | Ogmios state query | No |
| Vote history | Ogmios state query | No |
| Treasury balance | Ogmios state query | No |
| Internal polls | apps/api (Ktor) | Yes |
| Poll votes | apps/api (Ktor) | Yes |
| DRep communities | apps/api (Ktor) | Yes |

## Network separation

Hai môi trường hoàn toàn tách biệt qua env vars:

```
OGMIOS_PREPROD_URL=ws://ogmios-preprod:1337
KUPO_PREPROD_URL=http://kupo-preprod:1442
OGMIOS_MAINNET_URL=ws://ogmios-mainnet:1337
KUPO_MAINNET_URL=http://kupo-mainnet:1442
```

Network được auto-detect từ `wallet.getNetworkId()`:
- `0` → preprod
- `1` → mainnet

## Polyglot monorepo

```
Root
├── Turborepo    → quản lý apps/web + packages/*  (TypeScript)
└── Gradle       → quản lý apps/api               (Kotlin)
```

Turborepo KHÔNG biết về Kotlin. Để build toàn bộ:
```bash
pnpm build                   # TS packages
cd apps/api && ./gradlew build  # Kotlin
```
