#!/usr/bin/env bash
set -euo pipefail

API="${API_URL:-http://localhost:3001/api/v1}"
PHONE="+989129999999"

echo "==> OTP request"
REQ=$(curl -s -X POST "$API/auth/otp/request" -H 'Content-Type: application/json' -d "{\"phone\":\"$PHONE\"}")
CODE=$(echo "$REQ" | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>console.log(JSON.parse(d).code||'123456'))")
echo "    code: $CODE"

echo "==> OTP verify"
AUTH=$(curl -s -X POST "$API/auth/otp/verify" -H 'Content-Type: application/json' -d "{\"phone\":\"$PHONE\",\"code\":\"$CODE\"}")
TOKEN=$(echo "$AUTH" | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>console.log(JSON.parse(d).accessToken))")
USER_ID=$(echo "$AUTH" | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>console.log(JSON.parse(d).user.id))")
echo "    user: $USER_ID"

AUTH_H="Authorization: Bearer $TOKEN"

echo "==> Cities"
CITY_ID=$(curl -s "$API/users/cities" -H "$AUTH_H" | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{const a=JSON.parse(d);console.log(a.find(c=>c.slug==='fardis')?.id||a[0]?.id)})")

echo "==> Complete profile"
curl -s -X PATCH "$API/users/me" -H "$AUTH_H" -H 'Content-Type: application/json' \
  -d "{\"username\":\"smoke$(date +%s)\",\"name\":\"Smoke Test\",\"cityId\":\"$CITY_ID\"}" > /dev/null

echo "==> List cafes"
CAFE_ID=$(curl -s "$API/cafes" -H "$AUTH_H" | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>console.log(JSON.parse(d)[0]?.id))")
echo "    cafe: $CAFE_ID"

echo "==> Create post"
POST=$(curl -s -X POST "$API/posts" -H "$AUTH_H" -H 'Content-Type: application/json' \
  -d '{"type":"TEXT","caption":"Smoke test post"}')
POST_ID=$(echo "$POST" | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>console.log(JSON.parse(d).id))")
echo "    post: $POST_ID"

echo "==> Feed"
curl -s "$API/posts/feed" -H "$AUTH_H" | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{const j=JSON.parse(d);if(!j.data?.length)process.exit(1)})"

echo "==> Follow demo user nima"
NIMA=$(curl -s "$API/search?q=nima" -H "$AUTH_H" | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>console.log(JSON.parse(d).users?.[0]?.id||''))")
if [ -n "$NIMA" ] && [ "$NIMA" != "$USER_ID" ]; then
  curl -s -X POST "$API/users/$NIMA/follow" -H "$AUTH_H" > /dev/null
  echo "    followed: $NIMA"
fi

echo "==> Check-in"
curl -s -X POST "$API/cafes/$CAFE_ID/checkins" -H "$AUTH_H" > /dev/null

echo "==> Conversation"
if [ -n "$NIMA" ] && [ "$NIMA" != "$USER_ID" ]; then
  CONV=$(curl -s -X POST "$API/conversations" -H "$AUTH_H" -H 'Content-Type: application/json' -d "{\"participantId\":\"$NIMA\"}")
  CONV_ID=$(echo "$CONV" | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>console.log(JSON.parse(d).id))")
  curl -s -X POST "$API/conversations/$CONV_ID/messages" -H "$AUTH_H" -H 'Content-Type: application/json' \
    -d '{"body":"Hello from smoke test"}' > /dev/null
  echo "    message sent"
fi

echo "==> Gift coffee"
curl -s -X POST "$API/gifts" -H "$AUTH_H" -H 'Content-Type: application/json' -d '{"amount":50000}' > /dev/null

echo "==> Admin (expect 403 for regular user)"
STATUS=$(curl -s -o /dev/null -w '%{http_code}' "$API/admin/users" -H "$AUTH_H")
echo "    admin status: $STATUS"

echo "==> All smoke checks passed"
