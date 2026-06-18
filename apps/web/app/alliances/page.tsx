"use client"

import { useState } from "react"
import Link from "next/link"
import { useWalletStore } from "@/store/wallet"
import { useAllianceList, type AllianceItem } from "@/hooks/useAlliance"
import { useT } from "@/i18n/useT"

const TAG_OPTIONS = ["fiscal", "tech", "social", "environment", "education"]

const IPFS_GATEWAY = "https://gateway.pinata.cloud/ipfs/"

function resolveLogoSrc(url: string): string {
  if (url.startsWith("ipfs://")) return IPFS_GATEWAY + url.slice(7)
  return url
}

function AllianceCard({ alliance }: { alliance: AllianceItem }) {
  const t = useT()
  return (
    <Link
      href={`/alliances/${alliance.id}`}
      className="card-static flex flex-col gap-3 p-5 hover:border-border-hover transition-colors"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          {alliance.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={resolveLogoSrc(alliance.logoUrl)}
              alt={alliance.name}
              className="w-10 h-10 rounded-lg object-cover border border-border-subtle shrink-0"
            />
          ) : (
            <div className="w-10 h-10 rounded-lg bg-bg-card-hover shrink-0 flex items-center justify-center text-text-muted text-lg font-bold">
              {alliance.name.charAt(0).toUpperCase()}
            </div>
          )}
          <div className="min-w-0">
            <h3 className="font-semibold text-text-primary truncate">{alliance.name}</h3>
            {alliance.description && (
              <p className="text-sm text-text-muted mt-0.5 line-clamp-2">{alliance.description}</p>
            )}
          </div>
        </div>
        <span className="text-xs text-text-muted whitespace-nowrap shrink-0">
          {alliance.memberCount === 1
            ? t("alliance.member")
            : t("alliance.members", { n: alliance.memberCount })}
        </span>
      </div>

      {alliance.tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {alliance.tags.map((tag) => (
            <span
              key={tag}
              className="px-2 py-0.5 rounded-full text-xs bg-bg-card-hover text-text-muted"
            >
              {tag}
            </span>
          ))}
        </div>
      )}
    </Link>
  )
}

function SkeletonCard() {
  return (
    <div className="card-static p-5 flex flex-col gap-3">
      <div className="flex justify-between">
        <div className="h-5 w-40 rounded bg-bg-card-hover animate-pulse" />
        <div className="h-4 w-20 rounded bg-bg-card-hover animate-pulse" />
      </div>
      <div className="h-4 w-3/4 rounded bg-bg-card-hover animate-pulse" />
      <div className="flex gap-1">
        <div className="h-5 w-16 rounded-full bg-bg-card-hover animate-pulse" />
        <div className="h-5 w-12 rounded-full bg-bg-card-hover animate-pulse" />
      </div>
    </div>
  )
}

export default function AlliancesPage() {
  const t = useT()
  const { selectedNetwork, isConnected, isDrepRegistered } = useWalletStore()
  const [activeTag, setActiveTag] = useState<string | undefined>()
  const [page] = useState(1)

  const { data, isLoading, error } = useAllianceList(selectedNetwork, page, activeTag)

  return (
    <div className="page-container py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">{t("alliance.title")}</h1>
          <p className="text-sm text-text-muted mt-1">{t("alliance.subtitle")}</p>
        </div>
      </div>

      {/* Tag filters */}
      <div className="flex flex-wrap gap-2 mb-6">
        <button
          onClick={() => setActiveTag(undefined)}
          className={`px-3 py-1 rounded-full text-xs transition-colors ${
            !activeTag
              ? "bg-accent text-white"
              : "bg-bg-card text-text-muted hover:bg-bg-card-hover"
          }`}
        >
          All
        </button>
        {TAG_OPTIONS.map((tag) => (
          <button
            key={tag}
            onClick={() => setActiveTag(tag === activeTag ? undefined : tag)}
            className={`px-3 py-1 rounded-full text-xs transition-colors ${
              activeTag === tag
                ? "bg-accent text-white"
                : "bg-bg-card text-text-muted hover:bg-bg-card-hover"
            }`}
          >
            {t(`alliance.tags.${tag}` as Parameters<typeof t>[0])}
          </button>
        ))}
      </div>

      {/* Content */}
      {error ? (
        <div className="notice-warning text-sm">{t("alliance.loadError")}</div>
      ) : isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => <SkeletonCard key={i} />)}
        </div>
      ) : !data || data.items.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-16 text-text-muted">
          <span className="text-lg">{t("alliance.empty")}</span>
          <span className="text-sm">{t("alliance.emptyHint")}</span>
          {isConnected && isDrepRegistered && (
            <Link href="/alliances/new" className="btn-primary text-sm px-4 py-2 mt-4">
              {t("alliance.createBtn")}
            </Link>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {data.items.map((a) => (
            <AllianceCard key={a.id} alliance={a} />
          ))}
        </div>
      )}
    </div>
  )
}
