#! /usr/bin/env bash
set -e

mkdir -p offchain/src/types/
aiken build -t verbose
npx ~/proj/blaze-cardano/packages/blaze-blueprint plutus.json -o ./offchain/src/types/contracts.ts
