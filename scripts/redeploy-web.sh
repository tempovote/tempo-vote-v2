#!/usr/bin/env bash
#
# redeploy-web.sh — build lại + restart web (apps/web) ở chế độ production.
#
# Dùng cho server public (vd dev.blueocean.sg chạy qua Cloudflare Tunnel).
# Production server KHÔNG auto-reload khi đổi code, nên sau mỗi lần sửa/git pull
# có thay đổi phần web thì chạy script này.
#
#   ./scripts/redeploy-web.sh
#
# Local dev vẫn dùng `pnpm dev` như bình thường — script này chỉ cho server prod.
#
set -euo pipefail

# Repo root = thư mục cha của scripts/ (chạy được từ bất kỳ đâu)
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

PORT="${PORT:-3000}"
LOG="$ROOT/apps/web/.next-start.log"

echo "▶ [1/4] Dừng web server cũ trên :$PORT (nếu có)…"
# Dùng ss để tìm pid giữ port (lsof không hoạt động ổn trên máy này)
PORT_PID=$(ss -tlnp "sport = :$PORT" 2>/dev/null | awk 'NR>1 {match($0,/pid=([0-9]+)/,a); if(a[1]) print a[1]}' | head -1)
if [ -n "$PORT_PID" ]; then
  echo "   Kill pid $PORT_PID (giữ :$PORT)…"
  kill -9 "$PORT_PID" 2>/dev/null || true
fi
# Fallback: fuser nếu ss không tìm được
fuser -k "${PORT}/tcp" 2>/dev/null || true
sleep 2

echo "▶ [2/4] Build production (NEXT_PUBLIC_* được inline lúc này)…"
pnpm --filter web build

echo "▶ [3/4] Khởi động next start (detached, log → $LOG)…"
# nohup + disown để server sống tiếp sau khi script kết thúc
nohup pnpm --filter web start >"$LOG" 2>&1 &
START_PID=$!
disown "$START_PID" 2>/dev/null || true

echo "▶ [4/4] Chờ server sẵn sàng…"
for _ in $(seq 1 60); do
  if curl -s -o /dev/null "http://localhost:$PORT" 2>/dev/null; then
    code="$(curl -s -o /dev/null -w '%{http_code}' "http://localhost:$PORT" --max-time 10)"
    echo "✅ Web production đang chạy tại http://localhost:$PORT (HTTP $code)"
    echo "   Log: $LOG"
    exit 0
  fi
  sleep 1
done

echo "❌ Server chưa phản hồi sau 60s. Xem log: $LOG"
tail -20 "$LOG" || true
exit 1
