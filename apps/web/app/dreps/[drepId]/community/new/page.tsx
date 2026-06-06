"use client"

import { use, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { useWalletStore } from "@/store/wallet"

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080"

// ─── Default dates (start = now, end = 7 days from now) ─────────────────────

function toDatetimeLocal(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function CreatePollPage({
  params,
}: {
  params: Promise<{ drepId: string }>
}) {
  const { drepId } = use(params)
  const network = useWalletStore((s) => s.selectedNetwork)
  const router = useRouter()

  const now = new Date()
  const weekLater = new Date(now.getTime() + 7 * 24 * 3600 * 1000)

  const [title, setTitle] = useState("")
  const [abstract, setAbstract] = useState("")
  const [startsAt, setStartsAt] = useState(toDatetimeLocal(now))
  const [endsAt, setEndsAt] = useState(toDatetimeLocal(weekLater))
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const networkParam = network !== "mainnet" ? `?network=${network}` : ""

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) return
    if (new Date(endsAt) <= new Date(startsAt)) {
      setError("Thời gian kết thúc phải sau thời gian bắt đầu")
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      const res = await fetch(`${API_URL}/communities/${drepId}/polls`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          network,
          title: title.trim(),
          abstract: abstract.trim() || undefined,
          startsAt: new Date(startsAt).toISOString(),
          endsAt: new Date(endsAt).toISOString(),
        }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error((err as Record<string, string>).error ?? "Tạo poll thất bại")
      }

      router.push(`/dreps/${drepId}/community${networkParam}`)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Đã xảy ra lỗi")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="page-container py-10">
      <div className="max-w-lg mx-auto">

        {/* Back link */}
        <Link
          href={`/dreps/${drepId}/community${networkParam}`}
          className="inline-flex items-center gap-1.5 text-sm text-text-muted hover:text-text-primary transition-colors mb-8"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          DRep Community
        </Link>

        <h1 className="text-2xl font-bold mb-6">Tạo Internal Poll</h1>

        <form onSubmit={handleSubmit} className="card-static space-y-5">

          {/* Title */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-text-secondary">
              Tiêu đề <span className="text-danger">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ví dụ: Có nên hỗ trợ proposal X không?"
              maxLength={255}
              required
              className="w-full bg-bg-elevated border border-border-subtle rounded-lg px-3 py-2.5 text-sm text-text-primary placeholder-text-muted outline-none focus:border-accent/50 transition-colors"
            />
            <p className="text-xs text-text-muted text-right">{title.length}/255</p>
          </div>

          {/* Abstract */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-text-secondary">
              Mô tả
            </label>
            <textarea
              value={abstract}
              onChange={(e) => setAbstract(e.target.value)}
              placeholder="Mô tả chi tiết về poll này..."
              rows={5}
              className="w-full bg-bg-elevated border border-border-subtle rounded-lg px-3 py-2.5 text-sm text-text-primary placeholder-text-muted outline-none focus:border-accent/50 transition-colors resize-none"
            />
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-text-secondary">
                Bắt đầu
              </label>
              <input
                type="datetime-local"
                value={startsAt}
                onChange={(e) => setStartsAt(e.target.value)}
                required
                className="w-full bg-bg-elevated border border-border-subtle rounded-lg px-3 py-2.5 text-sm text-text-primary outline-none focus:border-accent/50 transition-colors"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-text-secondary">
                Kết thúc
              </label>
              <input
                type="datetime-local"
                value={endsAt}
                onChange={(e) => setEndsAt(e.target.value)}
                required
                className="w-full bg-bg-elevated border border-border-subtle rounded-lg px-3 py-2.5 text-sm text-text-primary outline-none focus:border-accent/50 transition-colors"
              />
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="notice-warning rounded-lg p-3 text-sm">
              {error}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-1">
            <Link
              href={`/dreps/${drepId}/community${networkParam}`}
              className="btn-outline flex-1 text-center"
            >
              Hủy
            </Link>
            <button
              type="submit"
              disabled={isSubmitting || !title.trim()}
              className="btn-primary flex-1"
            >
              {isSubmitting ? "Đang tạo..." : "Tạo Poll"}
            </button>
          </div>
        </form>
      </div>
    </main>
  )
}
