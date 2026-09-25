#!/bin/sh
set -eu

cd "$(dirname "$0")/../.."
: "${TEST_MIGRATION_DATABASE_URL:?}"
: "${TEST_DATABASE_URL:?}"

first="$(DATABASE_URL="$TEST_MIGRATION_DATABASE_URL" npm run migrate --workspace apps/api)"
second="$(DATABASE_URL="$TEST_MIGRATION_DATABASE_URL" npm run migrate --workspace apps/api)"
printf '%s' "$first" | grep -q '0001_migration_baseline.sql'
printf '%s' "$second" | grep -q 'No pending migrations'

node -e 'const {Pool}=require("pg"); (async()=>{for(const [url,want] of [[process.env.TEST_MIGRATION_DATABASE_URL,"taskio_migrator"],[process.env.TEST_DATABASE_URL,"taskio_app"]]){const p=new Pool({connectionString:url}); try {const r=await p.query("SELECT current_user"); if(r.rows[0].current_user!==want) throw new Error("unexpected role") } finally {await p.end()}}})()'
node -e 'const {Pool}=require("pg"); (async()=>{const p=new Pool({connectionString:process.env.TEST_DATABASE_URL}); for(const sql of ["CREATE TABLE forbidden_ddl(id integer)","DELETE FROM schema_migrations"]){try {await p.query(sql); process.exitCode=1} catch(e) {if(e.code!=="42501") throw e}} await p.end()})()'
node -e 'const {Pool}=require("pg"); (async()=>{const m=new Pool({connectionString:process.env.TEST_MIGRATION_DATABASE_URL}); const a=new Pool({connectionString:process.env.TEST_DATABASE_URL}); try {await m.query("CREATE TABLE t02_app_dml(id integer PRIMARY KEY, value text NOT NULL)"); await a.query("INSERT INTO t02_app_dml VALUES (1, $1)",["created"]); await a.query("UPDATE t02_app_dml SET value = $1 WHERE id = 1",["updated"]); const r=await a.query("SELECT value FROM t02_app_dml WHERE id = 1"); if(r.rows[0]?.value!=="updated") throw new Error("application DML failed"); await a.query("DELETE FROM t02_app_dml WHERE id = 1")} finally {await m.query("DROP TABLE IF EXISTS t02_app_dml"); await a.end(); await m.end()}})()'

echo 'T02 operations checks passed'
