#!/usr/bin/env bash
set -euo pipefail

here="$(cd "$(dirname "$0")" && pwd)"
if ! command -v node >/dev/null 2>&1 || ! command -v npm >/dev/null 2>&1; then
  echo "Node 20.11+ and npm are required." >&2
  exit 1
fi
if ! node -e 'const [major,minor]=process.versions.node.split(".").map(Number); process.exit(major>20||(major===20&&minor>=11)?0:1)'; then
  echo "Node 20.11+ is required." >&2
  exit 1
fi

(
  cd "$here"
  npm ci --no-audit --no-fund
  npm run --silent build
)
if [[ ! -s "${here}/dist/pr-lens.iife.js" ]]; then
  echo "Renderer bundle is missing." >&2
  exit 1
fi

smoke="$(mktemp -d)"
trap 'rm -rf "$smoke"' EXIT
node "${here}/walkthrough-svg.mjs" "${here}/../examples/checkout.graph.json" "${smoke}/walkthrough.svg"
node "${here}/build-viewer.mjs" "${here}/../examples/checkout.graph.json" "${smoke}/viewer.html"
if [[ ! -s "${smoke}/walkthrough.svg" || ! -s "${smoke}/viewer.html" ]]; then
  echo "Example build failed." >&2
  exit 1
fi
printf 'Ready: SVG and interactive viewer built from the fictional example.\n'
