"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useWalletStore } from "@/store/wallet"
import { createAlliance } from "@/hooks/useAlliance"
import { useT } from "@/i18n/useT"

const TAG_OPTIONS = ["fiscal", "tech", "social", "environment", "education"]

export default function CreateAlliancePage() {
  const t = useT()
  const router = useRouter()
  const { isConnected, isDrepRegistered, selectedNetwork, jwt } = useWalletStore()

  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [charter, setCharter] = useState("")
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [customTagInput, setCustomTagInput] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function toggleTag(tag: string) {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    )
  }

  function addCustomTags() {
    const newTags = customTagInput
      .split(",")
      .map((t) => t.trim().toLowerCase())
      .filter((t) => t.length > 0 && !selectedTags.includes(t))
    setSelectedTags((prev) => [...prev, ...newTags])
    setCustomTagInput("")
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!jwt) { setError("Not authenticated"); return }
    if (!name.trim()) { setError("Alliance name is required"); return }

    setIsSubmitting(true)
    setError(null)
    try {
      const result = await createAlliance(
        {
          name: name.trim(),
          description: description.trim() || undefined,
          charter: charter.trim() || undefined,
          tags: selectedTags,
          network: selectedNetwork,
        },
        jwt,
      )
      router.push(`/alliances/${result.id}`)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed"
      if (msg.includes("already taken") || msg.includes("already a member")) {
        setError(msg.includes("already a member") ? t("alliance.create.alreadyMember") : t("alliance.create.nameTaken"))
      } else if (msg.includes("not registered")) {
        setError(t("alliance.create.notDrep"))
      } else {
        setError(msg)
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!isConnected || !isDrepRegistered) {
    return (
      <div className="page-container py-16 flex flex-col items-center gap-4">
        <p className="text-text-muted">{t("alliance.create.notDrep")}</p>
      </div>
    )
  }

  return (
    <div className="page-container py-8 max-w-2xl">
      <h1 className="text-2xl font-bold text-text-primary mb-6">{t("alliance.create.title")}</h1>

      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        {/* Name */}
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-text-secondary">
            {t("alliance.create.namePlaceholder")} *
          </label>
          <input
            className="input-base"
            placeholder={t("alliance.create.namePlaceholder")}
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={100}
            required
          />
        </div>

        {/* Description */}
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-text-secondary">Description</label>
          <textarea
            className="input-base resize-none"
            rows={3}
            placeholder={t("alliance.create.descPlaceholder")}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        {/* Charter */}
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-text-secondary">Charter</label>
          <textarea
            className="input-base resize-y font-mono text-sm"
            rows={6}
            placeholder={t("alliance.create.charterPlaceholder")}
            value={charter}
            onChange={(e) => setCharter(e.target.value)}
          />
        </div>

        {/* Tags */}
        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-text-secondary">Tags</label>
          <div className="flex flex-wrap gap-2">
            {TAG_OPTIONS.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => toggleTag(tag)}
                className={`px-3 py-1 rounded-full text-xs transition-colors ${
                  selectedTags.includes(tag)
                    ? "bg-accent text-white"
                    : "bg-bg-card text-text-muted hover:bg-bg-card-hover border border-border-subtle"
                }`}
              >
                {t(`alliance.tags.${tag}` as Parameters<typeof t>[0])}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              className="input-base flex-1 text-sm"
              placeholder={t("alliance.create.tagsPlaceholder")}
              value={customTagInput}
              onChange={(e) => setCustomTagInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCustomTags() } }}
            />
            <button
              type="button"
              onClick={addCustomTags}
              className="px-3 py-1.5 rounded-lg bg-bg-card text-text-muted text-sm hover:bg-bg-card-hover border border-border-subtle"
            >
              Add
            </button>
          </div>
          {selectedTags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {selectedTags.map((tag) => (
                <span
                  key={tag}
                  className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-accent/20 text-accent-light"
                >
                  {tag}
                  <button
                    type="button"
                    onClick={() => setSelectedTags((prev) => prev.filter((t) => t !== tag))}
                    className="hover:text-danger"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Network */}
        <div className="flex items-center gap-2 text-sm text-text-muted">
          <span>{t("alliance.create.networkLabel")}:</span>
          <span className="px-2 py-0.5 rounded bg-bg-card-hover text-text-secondary capitalize">
            {selectedNetwork}
          </span>
        </div>

        {error && <div className="notice-warning text-sm">{error}</div>}

        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={isSubmitting || !name.trim()}
            className="btn-primary px-6 py-2 disabled:opacity-50"
          >
            {isSubmitting ? t("alliance.create.submitting") : t("alliance.create.submit")}
          </button>
          <button
            type="button"
            onClick={() => router.back()}
            className="px-4 py-2 rounded-lg text-sm text-text-muted hover:text-text-primary transition-colors"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  )
}
