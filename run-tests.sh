#!/usr/bin/env bash
# Comprehensive feature test — starts dev server and tests all features in one process.
set -u
cd /home/z/my-project
pkill -f "next dev" 2>/dev/null
sleep 1
rm -f dev.log
nohup bun run dev > dev.log 2>&1 &
SRV=$!
echo "[test] dev server PID $SRV"

# Wait for ready (max 30s)
for i in $(seq 1 30); do
  if curl -s -o /dev/null http://localhost:3000/ 2>/dev/null; then
    echo "[test] server ready after ${i}s"
    break
  fi
  sleep 1
done

BASE=http://localhost:3000
pass=0; fail=0
ok() { echo "  ✅ $1"; pass=$((pass+1)); }
no() { echo "  ❌ $1"; fail=$((fail+1)); }

echo "=== TEST 1: Home page renders ==="
code=$(curl -s -o /dev/null -w "%{http_code}" $BASE/)
[ "$code" = "200" ] && ok "GET / -> 200" || no "GET / -> $code"

echo "=== TEST 2: Capture text memory (auto-tagging) ==="
r=$(curl -s -X POST $BASE/api/capture -F "text=Had a great meeting with the design team about the new project dashboard. We discussed the sprint timeline and React component architecture." --max-time 30)
echo "  response: $(echo "$r" | head -c 400)"
echo "$r" | grep -q '"success":true' && ok "capture text saved" || no "capture text failed"
echo "$r" | grep -q '"tags"' && ok "tags field present" || no "no tags field"
mid=$(echo "$r" | grep -o '"id":"[^"]*"' | head -1 | sed 's/"id":"//;s/"//')
echo "  memory id: $mid"

echo "=== TEST 3: Capture a link ==="
r2=$(curl -s -X POST $BASE/api/capture -F "url=https://example.com" -F "text=Interesting article about AI" --max-time 30)
echo "  response: $(echo "$r2" | head -c 300)"
echo "$r2" | grep -q '"success":true' && ok "capture link saved" || no "capture link failed"

echo "=== TEST 4: Fetch memories (verify persisted + fields) ==="
r3=$(curl -s $BASE/api/memories --max-time 15)
cnt=$(echo "$r3" | grep -o '"id":"' | wc -l)
echo "  memories count: $cnt"
[ "$cnt" -ge 1 ] && ok "memories persisted" || no "no memories returned"
echo "$r3" | grep -q 'deepInsight' && ok "deepInsight field present" || no "deepInsight missing"
echo "$r3" | grep -q 'imageUrl' && ok "imageUrl field present" || no "imageUrl missing"

echo "=== TEST 5: AI Chat (Groq streaming) ==="
r4=$(curl -s -X POST $BASE/api/ai/chat -H "Content-Type: application/json" -d '{"message":"What did I recently capture?"}' --max-time 40)
echo "  chat response (first 300 chars): $(echo "$r4" | head -c 300)"
[ -n "$r4" ] && ok "chat returned content" || no "chat empty"

echo "=== TEST 6: Recap ==="
r5=$(curl -s "$BASE/api/recap?hours=24" --max-time 30)
echo "  recap (first 250 chars): $(echo "$r5" | head -c 250)"
echo "$r5" | grep -q '"recap"' && ok "recap generated" || no "recap failed"

echo "=== TEST 7: Brain connections ==="
r6=$(curl -s "$BASE/api/brain" --max-time 30)
echo "  brain (first 200 chars): $(echo "$r6" | head -c 200)"
echo "$r6" | grep -q 'connections' && ok "brain connections returned" || no "brain failed"

echo "=== TEST 8: Image generation (z-ai) ==="
r7=$(curl -s -X POST $BASE/api/ai/image -H "Content-Type: application/json" -d '{"prompt":"a calm purple gradient orb"}' --max-time 60)
echo "  image response (first 150 chars): $(echo "$r7" | head -c 150)"
echo "$r7" | grep -q 'base64\|url' && ok "image generated" || no "image gen failed"

echo "=== TEST 9: Tags generation (Groq) ==="
r8=$(curl -s -X POST $BASE/api/ai/tags -H "Content-Type: application/json" -d '{"content":"Learning about machine learning models and neural networks for a new AI project"}' --max-time 20)
echo "  tags response: $(echo "$r8" | head -c 250)"
echo "$r8" | grep -q 'tags' && ok "tags generated" || no "tags gen failed"

echo ""
echo "=== RESULTS: $pass passed, $fail failed ==="
echo "=== dev log (errors/warnings) ==="
grep -iE "error|warn|fail" dev.log | grep -v "deprecated" | tail -15

# Cleanup
kill $SRV 2>/dev/null
pkill -f "next dev" 2>/dev/null
echo "[test] done"
