import type { Metadata } from "next"
import "./globals.css"

export const metadata: Metadata = {
  title: "Tempo — Cardano Governance for DReps",
  description:
    "Governance tool for DReps on Cardano. Vote on governance actions, manage your DRep profile, and engage with your community.",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
