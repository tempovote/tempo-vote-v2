import { NextRequest, NextResponse } from "next/server"

const MAX_BODY_BYTES = 512 * 1024 // 512 KB

export async function GET(req: NextRequest) {
  const rawUrl = req.nextUrl.searchParams.get("url")
  if (!rawUrl) {
    return NextResponse.json({ error: "missing url" }, { status: 400 })
  }

  let parsed: URL
  try {
    parsed = new URL(rawUrl)
  } catch {
    return NextResponse.json({ error: "invalid url" }, { status: 400 })
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return NextResponse.json({ error: "invalid scheme" }, { status: 400 })
  }

  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 12_000)

    const upstream = await fetch(rawUrl, {
      signal: controller.signal,
      headers: { Accept: "application/json, text/plain, */*" },
      redirect: "follow",
    })
    clearTimeout(timer)

    if (!upstream.ok) {
      return NextResponse.json({ error: "upstream error" }, { status: 502 })
    }

    const buffer = await upstream.arrayBuffer()
    if (buffer.byteLength > MAX_BODY_BYTES) {
      return NextResponse.json({ error: "response too large" }, { status: 502 })
    }

    const text = new TextDecoder().decode(buffer)
    let json: unknown
    try {
      json = JSON.parse(text)
    } catch {
      return NextResponse.json({ error: "not json" }, { status: 502 })
    }

    return NextResponse.json(json)
  } catch {
    return NextResponse.json({ error: "fetch failed" }, { status: 502 })
  }
}
