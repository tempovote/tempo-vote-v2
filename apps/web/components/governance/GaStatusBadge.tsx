"use client"

import { useT } from "@/i18n/useT"

const STATUS_CLS: Record<string, string> = {
  active:   "badge-active",
  ratified: "badge-ratified",
  expired:  "badge-expired",
  enacted:  "badge-enacted",
  dropped:  "badge-dropped",
}

export function GaStatusBadge({ status }: { status: string }) {
  const t = useT()
  const cls = STATUS_CLS[status] ?? "badge-active"
  const key = status in STATUS_CLS ? status : "active"
  return <span className={`badge ${cls}`}>{t(`common.status.${key}`)}</span>
}
