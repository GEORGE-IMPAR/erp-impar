#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
TMP_DIR="$(mktemp -d)"
BACKEND_DIR="$TMP_DIR/backend-ci/v09"

cleanup() {
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT

: "${AGENDA_TEST_DB_DSN:?AGENDA_TEST_DB_DSN não informado}"
: "${AGENDA_TEST_DB_USER:?AGENDA_TEST_DB_USER não informado}"
: "${AGENDA_TEST_DB_PASSWORD:?AGENDA_TEST_DB_PASSWORD não informado}"

mkdir -p "$TMP_DIR/backend-ci" "$TMP_DIR/assistant"
cp -R "$ROOT_DIR/backend-ci/v09" "$BACKEND_DIR"
cp "$ROOT_DIR/tests/fixtures/agenda_common.php" "$TMP_DIR/assistant/common.php"
export GEORGE_AGENDA_DATA_DIR="$TMP_DIR/agenda-data"

cat > "$TMP_DIR/backend-ci/config.local.php" <<PHP
<?php
return [
  'test_mode' => true,
  'storage_dir' => '$TMP_DIR/backend-ci/storage/v09',
  'agenda_backend' => 'sql',
  'company_id' => 1,
  'company_code' => 'AGENDA_MYSQL_CI',
  'company_name' => 'Empresa Agenda MySQL CI',
  'allowed_origins' => [],
];
PHP

php "$ROOT_DIR/tests/agenda_mysql_regression.php" "$BACKEND_DIR" "$ROOT_DIR/tests/fixtures/agenda_mysql_schema.sql"
