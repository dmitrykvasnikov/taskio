#!/bin/sh
set -eu

if [ -n "${ADMIN_DATABASE_URL:-}" ]; then
  set -- "$ADMIN_DATABASE_URL"
else
  set -- --username "$POSTGRES_USER" --dbname "$POSTGRES_DB"
fi

psql -v ON_ERROR_STOP=1 "$@" \
  --set=migrator_password="${MIGRATOR_PASSWORD:?}" \
  --set=app_password="${APP_DB_PASSWORD:?}" <<'SQL'
SELECT format('CREATE ROLE taskio_migrator LOGIN PASSWORD %L', :'migrator_password')
WHERE NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'taskio_migrator') \gexec
SELECT format('ALTER ROLE taskio_migrator PASSWORD %L', :'migrator_password') \gexec

SELECT format('CREATE ROLE taskio_app LOGIN PASSWORD %L', :'app_password')
WHERE NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'taskio_app') \gexec
SELECT format('ALTER ROLE taskio_app PASSWORD %L', :'app_password') \gexec

GRANT CONNECT ON DATABASE :DBNAME TO taskio_migrator, taskio_app;
ALTER SCHEMA public OWNER TO taskio_migrator;
GRANT USAGE ON SCHEMA public TO taskio_app;
ALTER DEFAULT PRIVILEGES FOR ROLE taskio_migrator IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO taskio_app;
ALTER DEFAULT PRIVILEGES FOR ROLE taskio_migrator IN SCHEMA public
  GRANT USAGE, SELECT, UPDATE ON SEQUENCES TO taskio_app;
SQL
