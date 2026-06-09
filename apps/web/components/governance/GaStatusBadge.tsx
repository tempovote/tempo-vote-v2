const STATUS_CONFIG: Record<string, { cls: string; label: string }> = {
  active:    { cls: "badge-active",   label: "Active" },
  ratified:  { cls: "badge-ratified", label: "Ratified" },
  expired:   { cls: "badge-expired",  label: "Expired" },
  enacted:   { cls: "badge-enacted",  label: "Enacted" },
  dropped:   { cls: "badge-dropped",  label: "Dropped" },
}

const FALLBACK = { cls: "badge-active", label: "Active" }

export function GaStatusBadge({ status }: { status: string }) {
  const { cls, label } = STATUS_CONFIG[status] ?? FALLBACK
  return <span className={`badge ${cls}`}>{label}</span>
}
