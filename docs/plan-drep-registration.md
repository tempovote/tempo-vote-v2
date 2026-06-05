# Plan: DRep Registration Feature

**Status tracking across sessions — update checkboxes khi hoàn thành từng bước.**

---

## Tổng quan

Implement tính năng đăng ký DRep end-to-end trên Cardano Preprod + Mainnet.

**Flow:**
```
User fills form → Upload CIP-119 metadata to IPFS (Pinata)
→ GET anchorUrl + anchorDataHash
→ Build TX DREP_REGISTER (Kotlin backend)
→ Sign in wallet (CIP-30)
→ Submit to chain via Ogmios
→ Show txHash + success screen
```

**Quyết định kiến trúc:**
- IPFS provider: **Pinata** (env var: `PINATA_JWT`)
- UI layout: **Multi-step wizard** (4 bước: Form → Upload → Sign → Success)

---

## Trạng thái ban đầu

| Thành phần | File | Trạng thái |
|---|---|---|
| Build TX `DREP_REGISTER` | `apps/api/.../TxBuilder.kt` | ✅ Sẵn sàng |
| `POST /tx/build` + `/tx/submit` | `TransactionRoutes.kt` | ✅ Sẵn sàng |
| Wallet bridge CIP-95 (`getDRepKey`) | `packages/wallet-bridge/src/cip95.ts` | ✅ Sẵn sàng |
| `useWallet`, `useTx` hooks | `apps/web/hooks/` | ✅ Sẵn sàng |
| CIP-119 Zod schemas | `packages/types/src/cardano/cip119.ts` | ✅ Sẵn sàng |
| `POST /metadata/upload` | `apps/api/.../routes/StubRoutes.kt` | ❌ Stub |
| Trang `/dreps/register` | `apps/web/app/dreps/register/` | ❌ Chưa có |
| Form component CIP-119 | `apps/web/components/drep/` | ❌ Chưa có |

---

## Phase 1 — Backend: Metadata Upload (Kotlin)

**Branch:** `feature/drep-register`

### Mục tiêu
Implement `POST /metadata/upload`:
- Nhận CIP-119 body fields từ FE
- Build CIP-119 JSON-LD object đầy đủ
- Tính blake2b-256 hash của JSON string
- Upload lên Pinata IPFS
- Trả về `{ anchorUrl, anchorDataHash }`

### Checklist

- [x] **1.1** Tạo `apps/api/src/main/kotlin/routes/MetadataRoutes.kt`
  - [x] Request data class: `MetadataUploadRequest`
  - [x] Build CIP-119 JSON-LD theo spec
  - [x] Tính blake2b-256 hash (dùng BouncyCastle — transitive dep từ cardano-client-lib)
  - [x] Upload lên Pinata via OkHttp (`POST https://api.pinata.cloud/pinning/pinJSONToIPFS`)
  - [x] Response: `{ anchorUrl: "ipfs://...", anchorDataHash: "hex..." }`
  - [x] Error handling: missing PINATA_JWT, Pinata API errors, validation errors
- [x] **1.2** Xóa stub `metadataRoutes()` khỏi `StubRoutes.kt`
- [x] **1.3** Thêm `MetadataUploadRequest`/`Response` schemas vào `packages/types/src/api/metadata.ts`
- [x] **1.4** Thêm `PINATA_JWT=...` vào `.env.example`
- [x] **1.5** Test thủ công: `curl POST /metadata/upload` với Pinata JWT thật
  - Upload OK: `ipfs://QmdDJw5di9toqqBYHfVYpL3vgoQMFvHyfrWDsjf8bn3a1P`
  - Hash OK: `fcbb986e...` (blake2b-256)
  - IPFS gateway verify OK — CIP-119 JSON-LD đúng format

---

## Phase 2 — Frontend: Multi-step Registration (Next.js)

**Branch:** `feature/drep-register` (cùng branch)

### Bước wizard

| Bước | Nội dung |
|---|---|
| 1 — Thông tin cơ bản | givenName (bắt buộc), imageUrl, paymentAddress, doNotList |
| 2 — Hồ sơ DRep | motivations, objectives, qualifications, references[] |
| 3 — Xác nhận | Preview metadata, DRep ID, phí TX ước tính |
| 4 — Ký & Submit | Upload → Build TX → Sign → Submit → txHash |

### Checklist

- [ ] **2.1** Tạo `apps/web/app/dreps/register/page.tsx`
  - [ ] Guard: wallet chưa connect → prompt connect
  - [ ] Guard: ví không support CIP-95 → thông báo lỗi
  - [ ] Guard: đã là DRep registered → redirect / thông báo
  - [ ] State machine: `idle | step1 | step2 | step3 | uploading | signing | success | error`

- [ ] **2.2** Tạo `apps/web/components/drep/RegisterDRepForm.tsx`
  - [ ] Bước 1: givenName, imageUrl, paymentAddress, doNotList toggle
  - [ ] Bước 2: motivations textarea, objectives, qualifications, references builder (add/remove)
  - [ ] Validation với `Cip119BodySchema` (từ `@tempo-vote/types`)
  - [ ] Progress indicator (step 1/2/3)

- [ ] **2.3** Tạo `apps/web/components/drep/RegisterDRepConfirm.tsx`
  - [ ] Hiển thị preview CIP-119 metadata
  - [ ] Hiển thị DRep ID (bech32)
  - [ ] Ước tính phí TX (khoảng 2 ADA deposit + network fee)
  - [ ] Button "Xác nhận & Đăng ký"

- [ ] **2.4** Implement registration flow trong page.tsx
  ```typescript
  // Step 4 flow:
  1. POST /api/metadata/upload → { anchorUrl, anchorDataHash }
  2. useTx("DREP_REGISTER", { drepId, anchorUrl, anchorDataHash })
  3. Show txHash + link CardanoScan
  4. refreshDrepStatus() trong useWallet
  ```

- [ ] **2.5** Tạo `apps/web/components/drep/RegisterDRepSuccess.tsx`
  - [ ] txHash với link explorer (CardanoScan preprod/mainnet)
  - [ ] Thông báo chờ confirm (~20-60s)
  - [ ] Button "Xem hồ sơ DRep"

---

## Phase 3 — Wire-up & Polish

### Checklist

- [ ] **3.1** Kết nối button trong `apps/web/app/page.tsx` → `/dreps/register`
- [ ] **3.2** Kết nối link trong `apps/web/components/wallet/WalletModal.tsx` → `/dreps/register`
- [ ] **3.3** Cập nhật `useWallet.ts`: sau khi register xong, refresh `isDrepRegistered` + `drepName`
- [ ] **3.4** Test preprod end-to-end:
  - [ ] Connect Eternl wallet (preprod)
  - [ ] Điền form, upload metadata → kiểm tra IPFS link
  - [ ] Sign TX → kiểm tra txHash trên CardanoScan
  - [ ] Reconnect ví → kiểm tra `isDrepRegistered = true`
- [ ] **3.5** Test edge cases:
  - [ ] Wallet từ chối sign → show error, cho phép retry
  - [ ] IPFS upload fail → show error + retry
  - [ ] Đã là DRep → không cho register lại

---

## Files sẽ tạo mới / sửa

```
apps/api/src/main/kotlin/routes/
  MetadataRoutes.kt          [NEW] — Pinata upload endpoint

apps/api/src/main/kotlin/routes/
  StubRoutes.kt              [EDIT] — xóa stub metadataRoutes()

packages/types/src/api/
  metadata.ts                [NEW] — MetadataUploadRequest/Response schemas
  index.ts                   [EDIT] — export metadata types

apps/web/app/dreps/register/
  page.tsx                   [NEW] — Registration page

apps/web/components/drep/
  RegisterDRepForm.tsx        [NEW] — Multi-step form
  RegisterDRepConfirm.tsx     [NEW] — Preview + confirm
  RegisterDRepSuccess.tsx     [NEW] — Success screen

apps/web/app/page.tsx        [EDIT] — Wire button → /dreps/register
apps/web/components/wallet/WalletModal.tsx  [EDIT] — Wire link

.env.example                 [EDIT] — Thêm PINATA_JWT
```

---

## Env vars cần thiết

```bash
# Pinata IPFS (DRep metadata upload)
PINATA_JWT=eyJ...   # Bearer token từ app.pinata.cloud
```

---

## Ghi chú kỹ thuật

### blake2b-256 hash
```kotlin
// Dùng BouncyCastle (transitive dep từ cardano-client-lib)
val digest = Blake2bDigest(256)
val input = jsonString.toByteArray(Charsets.UTF_8)
digest.update(input, 0, input.size)
val out = ByteArray(32)
digest.doFinal(out, 0)
val hex = out.joinToString("") { "%02x".format(it) }
```

### Pinata API
```
POST https://api.pinata.cloud/pinning/pinJSONToIPFS
Authorization: Bearer <PINATA_JWT>
Content-Type: application/json

{
  "pinataContent": <cip119-metadata-object>,
  "pinataMetadata": { "name": "drep-<drepId>-metadata" }
}

Response: { "IpfsHash": "Qm..." }
anchorUrl = "ipfs://<IpfsHash>"
```

### DRep ID format
- Wallet trả về bech32: `drep1xxxxxxx` (via `getDRepKey()`)
- Backend `buildDRepRegister()` nhận bech32 hoặc hex credential hash
- `drepIdToCredentialHex()` trong `OgmiosStateQueries.kt` để convert nếu cần
