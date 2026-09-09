.PHONY: setup fmt lint test build dev demo e2e docker-build docker-up docker-down release-check clean

setup:
	cargo fetch --locked
	pnpm install --frozen-lockfile
	python -m pip install -e 'apps/api[dev]'
	pnpm --filter @releasetruth/browser-adapter exec playwright install chromium

fmt:
	cargo fmt --all
	pnpm format:ts
	ruff format apps/api

lint:
	cargo fmt --all -- --check
	cargo clippy --locked --workspace --all-targets --all-features -- -D warnings
	pnpm lint:ts
	ruff check apps/api

test:
	cargo test --locked --workspace
	pnpm test:ts
	pytest -q apps/api

build:
	cargo build --locked --workspace --release
	pnpm build:ts

dev:
	docker compose up postgres api dashboard

demo:
	./scripts/demo.sh

e2e:
	./scripts/e2e.sh

docker-build:
	docker compose build

docker-up:
	docker compose up -d

docker-down:
	docker compose down

release-check:
	./scripts/release-check.sh

clean:
	cargo clean
	rm -rf .releasetruth
	find apps adapters packages -type d \( -name dist -o -name .next \) -prune -exec rm -rf {} +
