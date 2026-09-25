#!/bin/sh
set -eu

cd "$(dirname "$0")/../.."

base_url="http://localhost:9090"
work_dir="$(mktemp -d)"
db_stopped=0
cleanup() {
  if [ "$db_stopped" -eq 1 ]; then
    docker compose start db >/dev/null
  fi
  docker compose exec -T db psql -U taskio -d taskio -c 'DROP TABLE IF EXISTS t01_volume_probe' >/dev/null 2>&1 || true
  rm -r "$work_dir"
}
trap cleanup EXIT INT TERM

curl -fsS "$base_url/" -o "$work_dir/index.html"
grep -q '<div id="root"></div>' "$work_dir/index.html"
asset_path="$(sed -n 's/.*src="\([^"]*\.js\)".*/\1/p' "$work_dir/index.html" | head -n 1)"
test -n "$asset_path"
curl -fsS "$base_url$asset_path" -o "$work_dir/app.js"
grep -q 'Taskio' "$work_dir/app.js"

curl -fsS "$base_url/api/v1/health" -o "$work_dir/health.json"
node -e 'const h=require(process.argv[1]); if(h.status!=="ok"||h.database!=="ready") process.exit(1)' "$work_dir/health.json"

docker compose config --format json > "$work_dir/compose.json"
node -e 'const c=require(process.argv[1]); if(c.services.api.ports?.length||c.services.db.ports?.length) process.exit(1); if(c.services.web.ports?.length!==1||c.services.web.ports[0].published!=="9090") process.exit(1)' "$work_dir/compose.json"

docker compose exec -T db psql -U taskio -d taskio -v ON_ERROR_STOP=1 -c 'CREATE TABLE t01_volume_probe (value integer NOT NULL); INSERT INTO t01_volume_probe VALUES (42)' >/dev/null
docker compose stop db >/dev/null
db_stopped=1
status="$(curl -sS -o "$work_dir/unavailable.json" -w '%{http_code}' "$base_url/api/v1/health")"
test "$status" = 503
node -e 'const h=require(process.argv[1]); if(h.status!=="unavailable"||Object.keys(h).length!==1) process.exit(1)' "$work_dir/unavailable.json"

docker compose start db >/dev/null
db_stopped=0
attempt=0
until curl -fsS "$base_url/api/v1/health" -o "$work_dir/recovered.json" 2>/dev/null; do
  attempt=$((attempt + 1))
  test "$attempt" -lt 30
  sleep 1
done
value="$(docker compose exec -T db psql -U taskio -d taskio -At -c 'SELECT value FROM t01_volume_probe')"
test "$value" = 42
echo 'T01 smoke checks passed'
