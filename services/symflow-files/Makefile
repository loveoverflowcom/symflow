.PHONY: build run test fmt check

build:
	cargo build --manifest-path Cargo.toml --release

run:
	cargo run --manifest-path Cargo.toml

test:
	cargo test --manifest-path Cargo.toml -- --nocapture

fmt:
	cargo fmt --manifest-path Cargo.toml

check:
	cargo clippy --manifest-path Cargo.toml -- -D warnings
