#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
BACKEND_DIR="$ROOT_DIR/backend-ci"
API_DIR="$BACKEND_DIR/v09"
PORT="${GEORGE_TEST_PORT:-18099}"
BASE="http://127.0.0.1:${PORT}/george-reuniao/v09"
TMP_DIR="$(mktemp -d)"
TEST_DOCROOT="$TMP_DIR/www"
COOKIE_JAR="$TMP_DIR/cookies.txt"
SERVER_LOG="$TMP_DIR/php-server.log"
SERVER_PID=''

cleanup() {
  if [[ -n "$SERVER_PID" ]]; then kill "$SERVER_PID" 2>/dev/null || true; fi
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT

mkdir -p "$BACKEND_DIR/storage/v09" "$ROOT_DIR/assistant"
cp "$ROOT_DIR/tests/fixtures/common.php" "$ROOT_DIR/assistant/common.php"

cat > "$BACKEND_DIR/config.local.php" <<PHP
<?php
return [
  'test_mode' => true,
  'storage_dir' => '$BACKEND_DIR/storage/v09',
  'openai_api_key' => '',
  'agenda_backend' => 'json',
  'allowed_origins' => ['http://127.0.0.1:$PORT'],
];
PHP
mkdir -p "$TEST_DOCROOT/george-reuniao"
ln -s "$API_DIR" "$TEST_DOCROOT/george-reuniao/v09"
php -S "127.0.0.1:$PORT" -t "$TEST_DOCROOT" >"$SERVER_LOG" 2>&1 &
SERVER_PID=$!
for _ in {1..40}; do curl -sS "$BASE/api.php" >/dev/null 2>&1 && break || sleep 0.1; done

request_json() {
  local name="$1" body="$2" csrf="${3:-}"
  local headers="$TMP_DIR/$name.headers" response="$TMP_DIR/$name.json"
  local args=(-sS -D "$headers" -o "$response" -c "$COOKIE_JAR" -b "$COOKIE_JAR" -H 'Content-Type: application/json' -H 'X-Forwarded-Proto: https')
  if [[ -n "$csrf" ]]; then args+=(-H "X-George-CSRF: $csrf"); fi
  curl "${args[@]}" --data "$body" "$BASE/api.php"
  grep -Eiq '^Content-Type: application/json' "$headers" || { echo "$name: Content-Type inválido"; cat "$headers"; cat "$response"; exit 1; }
  jq -e 'type=="object" and has("ok")' "$response" >/dev/null || { echo "$name: JSON inválido"; cat "$response"; exit 1; }
  if grep -Eiq '<!doctype|<html|warning:|fatal error:|notice:' "$response"; then echo "$name: saída PHP contaminada"; cat "$response"; exit 1; fi
  cat "$response"
}

session_json="$(request_json session '{"action":"session"}')"
csrf="$(jq -r '.csrf' <<<"$session_json")"
[[ "$(jq -r '.authenticated' <<<"$session_json")" == 'false' ]]

login_json="$(request_json login '{"action":"login","email":"ci@erpimpar.invalid","password":"Teste-CI-George-2026"}' "$csrf")"
csrf="$(jq -r '.csrf' <<<"$login_json")"
jq -e '.ok==true and .user.id=="ci-user"' <<<"$login_json" >/dev/null

new_json="$(request_json conversation_new '{"action":"conversation_new"}' "$csrf")"
record_id="$(jq -r '.record_id' <<<"$new_json")"
[[ "$record_id" =~ ^g09_[a-f0-9]{32}$ ]]

resume_json="$(request_json resume '{"action":"resume"}' "$csrf")"
jq -e --arg id "$record_id" '.ok==true and .record_id==$id and (.turns|type)=="array"' <<<"$resume_json" >/dev/null

echo 'PHP API smoke: session, login, conversation_new e resume retornaram JSON válido.'

