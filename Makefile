.PHONY: up down logs build typecheck

up:
	docker compose up --build -d --wait

down:
	docker compose down

logs:
	docker compose logs -f

build:
	npm run build

typecheck:
	npm run typecheck
