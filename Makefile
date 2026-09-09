.PHONY: setup fmt lint test build demo clean

setup:
	cargo fetch
	pnpm install --no-frozen-lockfile

fmt:
	cargo fmt --all
	pnpm format:ts

lint:
	cargo fmt --all -- --check
	cargo clippy --workspace --all-targets --all-features -- -D warnings
	pnpm lint:ts

test:
	cargo test --workspace
	pnpm test:ts

build:
	cargo build --workspace --release
	pnpm build:ts

demo:
	./scripts/demo.sh

clean:
	cargo clean
	rm -rf .releasetruth
	find apps adapters packages -type d \( -name dist -o -name .next \) -prune -exec rm -rf {} +
