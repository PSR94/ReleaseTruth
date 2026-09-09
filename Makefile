.PHONY: setup fmt lint test build demo clean

setup:
	cargo fetch

fmt:
	cargo fmt --all

lint:
	cargo fmt --all -- --check
	cargo clippy --workspace --all-targets --all-features -- -D warnings

test:
	cargo test --workspace

build:
	cargo build --workspace --release

demo:
	./scripts/demo.sh

clean:
	cargo clean
	rm -rf .releasetruth
