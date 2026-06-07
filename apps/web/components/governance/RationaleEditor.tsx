"use client"

import { useState } from "react"

interface Props {
  value: string
  onChange: (v: string) => void
}

const MAX_CHARS = 2000

export function RationaleEditor({ value, onChange }: Props) {
  const [showPreview, setShowPreview] = useState(false)
  const remaining = MAX_CHARS - value.length
  const isOver = remaining < 0

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-text-secondary">
          Lý do bỏ phiếu
          <span className="ml-1.5 text-xs text-text-muted font-normal">(Markdown)</span>
        </label>
        <button
          type="button"
          onClick={() => setShowPreview((p) => !p)}
          className="text-xs text-accent-light hover:underline"
        >
          {showPreview ? "Chỉnh sửa" : "Xem trước"}
        </button>
      </div>

      {showPreview ? (
        <div className="min-h-[140px] bg-bg-secondary rounded-xl px-4 py-3 text-sm text-text-primary prose-preview whitespace-pre-wrap break-words">
          {value.trim() ? value : (
            <span className="text-text-muted italic">Không có nội dung</span>
          )}
        </div>
      ) : (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Nhập lý do bỏ phiếu của bạn...&#10;&#10;Hỗ trợ Markdown: **đậm**, *nghiêng*, # tiêu đề"
          rows={6}
          maxLength={MAX_CHARS + 50}
          className={`w-full bg-bg-secondary border rounded-xl px-4 py-3 text-sm text-text-primary placeholder:text-text-muted resize-none focus:outline-none focus:ring-2 transition-colors ${
            isOver
              ? "border-danger/50 focus:ring-danger/30"
              : "border-border-subtle focus:ring-accent/30"
          }`}
        />
      )}

      <div className="flex items-center justify-between text-xs">
        <p className="text-text-muted/70">
          Rationale sẽ được lưu trên IPFS và gắn vào giao dịch vote.
        </p>
        <span className={isOver ? "text-danger font-medium" : "text-text-muted"}>
          {remaining.toLocaleString()} ký tự còn lại
        </span>
      </div>
    </div>
  )
}
