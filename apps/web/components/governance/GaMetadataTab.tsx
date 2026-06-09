"use client"

import { useAnchorMetadata } from "@/hooks/useAnchorMetadata"
import { resolveAnchorUrl } from "@/lib/governance"

export function GaMetadataTab({ anchorUrl }: { anchorUrl: string }) {
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
          Không thể tải nội dung từ anchor. Có thể do CORS hoặc tài liệu chưa có sẵn.
        </p>
        {resolvedUrl && (
          <a
            href={resolvedUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-accent-light hover:underline inline-flex items-center gap-1"
          >
            Xem trực tiếp
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
    { key: "abstract",   label: "Abstract" },
    { key: "motivation", label: "Motivation" },
    { key: "rationale",  label: "Rationale" },
  ]

  return (
    <div className="space-y-5">
      {sections.map(({ key, label }) => {
        const text = data[key] as string | undefined
        if (!text) return null
        return (
          <div key={key} className="space-y-2">
            <h3 className="text-sm font-semibold text-text-primary">{label}</h3>
            <p className="text-sm text-text-secondary leading-relaxed whitespace-pre-wrap">{text}</p>
          </div>
        )
      })}

      {data.references && data.references.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-text-primary">References</h3>
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
                  {ref.label}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
