/**
 * Copy text to clipboard with fallback for non-secure contexts (HTTP over LAN).
 * navigator.clipboard is only available on HTTPS or localhost.
 */
export function copyToClipboard(text: string): void {
  if (navigator.clipboard) {
    navigator.clipboard.writeText(text)
    return
  }
  const el = document.createElement("textarea")
  el.value = text
  el.style.position = "fixed"
  el.style.opacity = "0"
  document.body.appendChild(el)
  el.select()
  document.execCommand("copy")
  document.body.removeChild(el)
}
