"use client"

import { useState, useRef } from "react"

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080"

export interface DRepFormData {
  givenName: string
  motivations: string
  objectives: string
  qualifications: string
  imageUrl: string
  imagePreviewUrl: string  // local blob URL for display (not stored on-chain)
  paymentAddress: string
  doNotList: boolean
  references: { type: string; label: string; uri: string }[]
}

interface Props {
  data: DRepFormData
  step: 1 | 2
  onChange: (data: DRepFormData) => void
  onNext: () => void
  onBack: () => void
}

export default function RegisterDRepForm({ data, step, onChange, onNext, onBack }: Props) {
  const set = (patch: Partial<DRepFormData>) => onChange({ ...data, ...patch })
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [uploadState, setUploadState] = useState<"idle" | "uploading" | "error">("idle")
  const fileInputRef = useRef<HTMLInputElement>(null)

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    // Unpin previous IPFS upload if being replaced
    if (data.imageUrl.startsWith("ipfs://")) {
      fetch(`${API_URL}/metadata/unpin/${data.imageUrl.slice(7)}`, { method: "DELETE" }).catch(() => {})
    }

    const localUrl = URL.createObjectURL(file)
    setImagePreview(localUrl)
    setUploadState("uploading")
    set({ imageUrl: "" })

    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(((reader.result as string).split(",")[1]) ?? "")
        reader.onerror = reject
        reader.readAsDataURL(file)
      })

      const res = await fetch(`${API_URL}/metadata/upload-image`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ base64, mimeType: file.type, filename: file.name }),
      })

      if (!res.ok) throw new Error("Upload failed")
      const { imageUrl } = await res.json()
      set({ imageUrl, imagePreviewUrl: localUrl })
      setUploadState("idle")
    } catch {
      setUploadState("error")
      URL.revokeObjectURL(localUrl)
      setImagePreview(null)
    }
    // Reset file input so same file can be re-selected
    e.target.value = ""
  }

  const addReference = () =>
    set({ references: [...data.references, { type: "Link", label: "", uri: "" }] })

  const updateReference = (i: number, patch: Partial<{ type: string; label: string; uri: string }>) =>
    set({
      references: data.references.map((r, idx) => (idx === i ? { ...r, ...patch } : r)),
    })

  const removeReference = (i: number) =>
    set({ references: data.references.filter((_, idx) => idx !== i) })

  const canProceedStep1 = data.givenName.trim().length > 0

  if (step === 1) {
    return (
      <div className="space-y-5">
        {/* givenName */}
        <div>
          <label className="block text-sm font-medium text-text-secondary mb-1.5">
            Tên DRep <span className="text-danger">*</span>
          </label>
          <input
            className="input w-full"
            placeholder="Ví dụ: Tempo.Vote"
            maxLength={80}
            value={data.givenName}
            onChange={e => set({ givenName: e.target.value })}
          />
          <p className="text-text-muted text-xs mt-1">
            Tên hiển thị trong ví và các công cụ quản trị Cardano. Tối đa 80 ký tự.
          </p>
        </div>

        {/* imageUrl — URL input or local file upload */}
        <div>
          <label className="block text-sm font-medium text-text-secondary mb-1.5">
            Ảnh đại diện
          </label>

          {/* Preview */}
          {(imagePreview || data.imageUrl) && (
            <div className="flex items-center gap-3 mb-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={imagePreview || data.imageUrl}
                alt="preview"
                className="w-14 h-14 rounded-full object-cover border border-border-subtle"
              />
              {uploadState === "uploading" && (
                <div className="flex items-center gap-2 text-text-muted text-xs">
                  <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  Đang upload lên IPFS...
                </div>
              )}
              {uploadState === "idle" && data.imageUrl && (
                <p className="text-text-muted text-xs break-all line-clamp-2">{data.imageUrl}</p>
              )}
            </div>
          )}

          {/* Input row */}
          <div className="flex gap-2">
            <input
              className="input flex-1 text-sm"
              placeholder="https://example.com/avatar.png"
              value={data.imageUrl}
              onChange={e => {
                const newUrl = e.target.value
                if (data.imageUrl.startsWith("ipfs://") && !newUrl.startsWith("ipfs://")) {
                  fetch(`${API_URL}/metadata/unpin/${data.imageUrl.slice(7)}`, { method: "DELETE" }).catch(() => {})
                }
                set({ imageUrl: newUrl, imagePreviewUrl: "" })
                setImagePreview(null)
                setUploadState("idle")
              }}
              disabled={uploadState === "uploading"}
            />
            <button
              type="button"
              className="btn-outline text-xs px-3 shrink-0"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadState === "uploading"}
            >
              {uploadState === "uploading" ? "Đang tải..." : "Tải tệp lên"}
            </button>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileSelect}
          />
          {uploadState === "error" && (
            <p className="text-danger text-xs mt-1">
              Upload thất bại. Vui lòng thử lại hoặc dán URL trực tiếp.
            </p>
          )}
        </div>

        {/* paymentAddress */}
        <div>
          <label className="block text-sm font-medium text-text-secondary mb-1.5">
            Địa chỉ nhận phí (tùy chọn)
          </label>
          <input
            className="input w-full font-mono text-xs"
            placeholder="addr1..."
            value={data.paymentAddress}
            onChange={e => set({ paymentAddress: e.target.value })}
          />
          <p className="text-text-muted text-xs mt-1">
            Địa chỉ Cardano để nhận phần thưởng từ delegators (nếu có trong tương lai).
          </p>
        </div>

        {/* doNotList */}
        <label className="flex items-center gap-3 cursor-pointer select-none">
          <div
            className={`w-10 h-5 rounded-full transition-colors relative ${data.doNotList ? "bg-accent" : "bg-bg-elevated"}`}
            onClick={() => set({ doNotList: !data.doNotList })}
          >
            <div
              className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${data.doNotList ? "translate-x-5" : "translate-x-0.5"}`}
            />
          </div>
          <div>
            <p className="text-sm font-medium text-text-primary">Ẩn khỏi danh sách công khai</p>
            <p className="text-xs text-text-muted">
              DRep ID vẫn hoạt động on-chain nhưng không hiển thị trong danh sách DRep.
            </p>
          </div>
        </label>

        <div className="pt-2">
          <button
            className="btn-primary w-full"
            disabled={!canProceedStep1}
            onClick={onNext}
          >
            Tiếp theo →
          </button>
        </div>
      </div>
    )
  }

  // Step 2
  return (
    <div className="space-y-5">
      {/* motivations */}
      <div>
        <label className="block text-sm font-medium text-text-secondary mb-1.5">
          Động lực
        </label>
        <textarea
          className="input w-full resize-none"
          rows={3}
          placeholder="Tại sao bạn muốn trở thành DRep?"
          value={data.motivations}
          onChange={e => set({ motivations: e.target.value })}
        />
      </div>

      {/* objectives */}
      <div>
        <label className="block text-sm font-medium text-text-secondary mb-1.5">
          Mục tiêu
        </label>
        <textarea
          className="input w-full resize-none"
          rows={3}
          placeholder="Bạn muốn đạt được gì khi là DRep?"
          value={data.objectives}
          onChange={e => set({ objectives: e.target.value })}
        />
      </div>

      {/* qualifications */}
      <div>
        <label className="block text-sm font-medium text-text-secondary mb-1.5">
          Kinh nghiệm & Năng lực
        </label>
        <textarea
          className="input w-full resize-none"
          rows={3}
          placeholder="Kinh nghiệm, kỹ năng hoặc chuyên môn liên quan..."
          value={data.qualifications}
          onChange={e => set({ qualifications: e.target.value })}
        />
      </div>

      {/* references */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm font-medium text-text-secondary">
            Liên kết tham chiếu
          </label>
          <button
            className="text-accent text-xs font-medium hover:text-accent-light transition-colors"
            onClick={addReference}
          >
            + Thêm liên kết
          </button>
        </div>

        {data.references.length === 0 ? (
          <p className="text-text-muted text-xs">
            Thêm website, Twitter, GitHub... để delegators hiểu rõ hơn về bạn.
          </p>
        ) : (
          <div className="space-y-3">
            {data.references.map((ref, i) => (
              <div key={i} className="bg-bg-elevated rounded-lg p-3 space-y-2">
                <div className="flex gap-2">
                  <select
                    className="input text-sm w-28 shrink-0"
                    value={ref.type}
                    onChange={e => updateReference(i, { type: e.target.value })}
                  >
                    <option value="Link">Link</option>
                    <option value="GovernanceMetadata">Governance</option>
                    <option value="Identity">Identity</option>
                  </select>
                  <input
                    className="input text-sm flex-1"
                    placeholder="Nhãn (vd: Twitter)"
                    value={ref.label}
                    onChange={e => updateReference(i, { label: e.target.value })}
                  />
                  <button
                    className="text-text-muted hover:text-danger transition-colors shrink-0 text-lg leading-none"
                    onClick={() => removeReference(i)}
                    title="Xóa"
                  >
                    ×
                  </button>
                </div>
                <input
                  className="input text-sm w-full"
                  placeholder="https://..."
                  value={ref.uri}
                  onChange={e => updateReference(i, { uri: e.target.value })}
                />
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex gap-3 pt-2">
        <button className="btn-outline flex-1" onClick={onBack}>
          ← Quay lại
        </button>
        <button className="btn-primary flex-1" onClick={onNext}>
          Xem trước →
        </button>
      </div>
    </div>
  )
}
