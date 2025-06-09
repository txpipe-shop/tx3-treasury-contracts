#! /usr/bin/env bash
set -e

mkdir -p offchain/src/types/
aiken build -t verbose
bunx @blaze-cardano/blueprint plutus.json -o ./offchain/src/types/contracts.ts
