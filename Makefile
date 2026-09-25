.PHONY: up down logs migrate build typecheck lint check test-task e2e-task e2e test-ops

TEST_COMPOSE = docker compose -f compose.test.yaml
TEST_PROJECT = taskio-test-$$(date +%s)-$$$$

up:
	docker compose up --build -d --wait db
	docker compose run --rm roles
	docker compose run --rm migrate
	docker compose up --build -d --wait api web

down:
	docker compose down

logs:
	docker compose logs -f

migrate:
	docker compose up --build -d --wait db
	docker compose run --rm roles
	docker compose run --rm migrate

build:
	npm run build

typecheck:
	npm run typecheck

lint:
	npm run lint

test-task:
	@project=$(TEST_PROJECT); trap '$(TEST_COMPOSE) -p $$project down -v >/dev/null 2>&1' EXIT INT TERM; \
	$(TEST_COMPOSE) -p $$project up -d --wait db; \
	if [ '$(TASK)' = 'T01' ]; then $(TEST_COMPOSE) -p $$project run --rm migrate && $(TEST_COMPOSE) -p $$project up -d --wait api web; fi; \
	$(TEST_COMPOSE) -p $$project run --rm -e TASK='$(TASK)' -e TASKIO_COMPOSE_PROJECT=$$project tools sh -c 'npm ci --no-audit --no-fund && node scripts/test-task.mjs'

test-ops:
	@project=$(TEST_PROJECT); trap '$(TEST_COMPOSE) -p $$project down -v >/dev/null 2>&1' EXIT INT TERM; \
	$(TEST_COMPOSE) -p $$project up -d --wait db; \
	if [ '$(TASK)' = 'T01' ]; then $(TEST_COMPOSE) -p $$project run --rm migrate && $(TEST_COMPOSE) -p $$project up -d --wait api web; fi; \
	$(TEST_COMPOSE) -p $$project run --rm -e TASK='$(TASK)' -e TASKIO_COMPOSE_PROJECT=$$project tools sh -c 'npm ci --no-audit --no-fund && node scripts/test-task.mjs --ops'

check:
	@project=$(TEST_PROJECT); trap '$(TEST_COMPOSE) -p $$project down -v >/dev/null 2>&1' EXIT INT TERM; \
	$(TEST_COMPOSE) -p $$project up -d --wait db; \
	$(TEST_COMPOSE) -p $$project run --rm tools sh -c 'npm ci --no-audit --no-fund && node scripts/check.mjs'

e2e-task:
	@project=$(TEST_PROJECT); trap '$(TEST_COMPOSE) -p $$project --profile e2e down -v >/dev/null 2>&1' EXIT INT TERM; \
	$(TEST_COMPOSE) -p $$project up -d --wait db; \
	$(TEST_COMPOSE) -p $$project run --rm migrate; \
	$(TEST_COMPOSE) -p $$project up -d --wait api web; \
	$(TEST_COMPOSE) -p $$project run --rm tools npm ci --no-audit --no-fund; \
	$(TEST_COMPOSE) -p $$project --profile e2e run --rm -e TASK='$(TASK)' playwright node scripts/test-task.mjs --e2e

e2e:
	@project=$(TEST_PROJECT); trap '$(TEST_COMPOSE) -p $$project --profile e2e down -v >/dev/null 2>&1' EXIT INT TERM; \
	$(TEST_COMPOSE) -p $$project up -d --wait db; \
	$(TEST_COMPOSE) -p $$project run --rm migrate; \
	$(TEST_COMPOSE) -p $$project up -d --wait api web; \
	$(TEST_COMPOSE) -p $$project run --rm tools npm ci --no-audit --no-fund; \
	$(TEST_COMPOSE) -p $$project --profile e2e run --rm playwright npx playwright test
