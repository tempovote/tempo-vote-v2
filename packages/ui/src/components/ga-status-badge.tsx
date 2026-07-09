import { Badge, type BadgeProps } from "./badge"

const STATUS_VARIANT = {
  active: "status-active",
  ratified: "status-ratified",
  expired: "status-expired",
  enacted: "status-enacted",
  dropped: "status-dropped",
} as const satisfies Record<string, BadgeProps["variant"]>

/** Map status GA → Badge variant; status lạ fallback "status-active" (hành vi bản gốc). */
export function gaStatusToVariant(status: string): BadgeProps["variant"] {
  return STATUS_VARIANT[status as keyof typeof STATUS_VARIANT] ?? "status-active"
}

export interface GaStatusBadgeProps {
  status: string
  /** Text đã dịch — app truyền (i18n-free) */
  label: string
  className?: string
}

export function GaStatusBadge({ status, label, className }: GaStatusBadgeProps) {
  return (
    <Badge variant={gaStatusToVariant(status)} className={className}>
      {label}
    </Badge>
  )
}
