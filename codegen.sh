#! /usr/bin/env bash
set -e

mkdir -p offchain/src/generated-types/
aiken build -t silent # verbose
bunx @blaze-cardano/blueprint plutus.json -o ./offchain/src/generated-types/contracts.ts
