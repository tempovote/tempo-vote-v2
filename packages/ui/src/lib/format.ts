/** Format lovelace thành chuỗi ADA gọn: 1.23B · 595.01M · 1.5K · 999. */
export function formatAda(lovelace: number): string {
  const ada = lovelace / 1_000_000
  if (ada >= 1_000_000_000) return `${(ada / 1_000_000_000).toFixed(2)}B`
  if (ada >= 1_000_000) return `${(ada / 1_000_000).toFixed(2)}M`
  if (ada >= 1_000) return `${(ada / 1_000).toFixed(1)}K`
  return ada.toFixed(0)
}

/** Format số ĐÃ là ADA (không chia 1e6): 1.5B · 23M · 999,999. */
export function formatCompact(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(0)}M`
  return n.toLocaleString()
}

/** Format phần trăm: 0 → "0", dưới 1% giữ 1 số lẻ, còn lại làm tròn. */
export function formatPct(pct: number): string {
  if (pct === 0) return "0"
  if (pct < 1) return pct.toFixed(1)
  return Math.round(pct).toString()
}

/** Rút gọn giữa chuỗi: "4b10e57932…b6c4e2". Chuỗi ngắn hơn head+tail+1 giữ nguyên. */
export function truncateMiddle(s: string, head = 10, tail = 6): string {
  if (s.length <= head + tail + 1) return s
  return `${s.slice(0, head)}…${s.slice(-tail)}`
}
