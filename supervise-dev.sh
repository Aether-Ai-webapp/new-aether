#!/usr/bin/env bash
# Check if dev server on :3000 is alive; if not, start it detached.
set -u
cd /home/z/my-project
PORT_OK=$(ss -tln 2>/dev/null | rg -c ':3000' || echo 0)
if [ "$PORT_OK" = "0" ]; then
  pkill -f "next dev -p 3000" 2>/dev/null
  sleep 1
  nohup bun run dev > /home/z/my-project/dev.log 2>&1 &
  disown 2>/dev/null || true
fi
