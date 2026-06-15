"use client"

import { marked } from "marked"
import { useAnchorMetadata } from "@/hooks/useAnchorMetadata"
import { resolveAnchorUrl } from "@/lib/governance"
import { useT } from "@/i18n/useT"

function MarkdownSection({ text }: { text: string }) {
  const html = marked.parse(text, { async: false }) as string
  return (
    <div
      // anchor content is fetched from IPFS/anchor URLs — not user-supplied input
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: html }}
      className="prose-metadata text-sm text-text-secondary leading-relaxed"
    />
  )
}

export function GaMetadataTab({ anchorUrl }: { anchorUrl: string }) {
  const t = useT()
  const { data, loading, error } = useAnchorMetadata(anchorUrl)

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-4 bg-bg-elevated rounded w-1/4" />
        <div className="space-y-2">
          <div className="h-3 bg-bg-elevated rounded w-full" />
          <div className="h-3 bg-bg-elevated rounded w-5/6" />
          <div className="h-3 bg-bg-elevated rounded w-4/6" />
        </div>
        <div className="h-4 bg-bg-elevated rounded w-1/4 mt-4" />
        <div className="space-y-2">
          <div className="h-3 bg-bg-elevated rounded w-full" />
          <div className="h-3 bg-bg-elevated rounded w-3/4" />
        </div>
      </div>
    )
  }

  if (error || !data) {
    const resolvedUrl = resolveAnchorUrl(anchorUrl)
    return (
      <div className="space-y-2 py-2">
        <p className="text-sm text-text-muted">
          {t("governance.metadata.loadError")}
        </p>
        {resolvedUrl && (
          <a
            href={resolvedUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-accent-light hover:underline inline-flex items-center gap-1"
          >
            {t("governance.metadata.viewDirect")}
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
              <polyline points="15 3 21 3 21 9" />
              <line x1="10" y1="14" x2="21" y2="3" />
            </svg>
          </a>
        )}
      </div>
    )
  }

  const sections: { key: keyof typeof data; label: string }[] = [
    { key: "abstract",   label: t("governance.metadata.abstract") },
    { key: "motivation", label: t("governance.metadata.motivation") },
    { key: "rationale",  label: t("governance.metadata.rationale") },
  ]

  return (
    <div className="space-y-5">
      {sections.map(({ key, label }) => {
        const text = data[key] as string | undefined
        if (!text) return null
        return (
          <div key={key} className="space-y-2">
            <h3 className="text-sm font-semibold text-text-primary">{label}</h3>
            <MarkdownSection text={text} />
          </div>
        )
      })}

      {data.references && data.references.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-text-primary">{t("governance.metadata.references")}</h3>
          <ul className="space-y-1">
            {data.references.map((ref, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                <span className="text-text-muted mt-0.5">•</span>
                <a
                  href={ref.uri}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-accent-light hover:underline break-all"
                >
                  {/* Show the raw URL. Older proposals stored a useless "Reference N"
                      label; fall back to it only if a URI is somehow missing. */}
                  {ref.uri || ref.label}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
