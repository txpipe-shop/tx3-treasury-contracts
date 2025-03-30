#! /usr/bin/env bash
set -e

mkdir -p offchain/types/
aiken build
npx @blaze-cardano/blueprint@latest plutus.json -o ./offchain/types/contracts.ts
