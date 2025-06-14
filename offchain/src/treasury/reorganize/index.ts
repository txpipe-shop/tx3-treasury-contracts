import {
  AssetId,
  Ed25519KeyHashHex,
  Slot,
  toHex,
  TransactionUnspentOutput,
  Value,
} from "@blaze-cardano/core";
import * as Data from "@blaze-cardano/data";
import {
  TxBuilder,
  type Blaze,
  type Provider,
  type Wallet,
} from "@blaze-cardano/sdk";
import {
  TreasuryConfiguration,
  TreasurySpendRedeemer,
} from "../../generated-types/contracts";
import { loadTreasuryScript } from "../../shared";

export async function reorganize<P extends Provider, W extends Wallet>(
  config: TreasuryConfiguration,
  blaze: Blaze<P, W>,
  inputs: TransactionUnspentOutput[],
  outputAmounts: Value[],
  signers: Ed25519KeyHashHex[],
  trace?: boolean,
): Promise<TxBuilder> {
  const { script, scriptAddress } = loadTreasuryScript(
    blaze.provider.network,
    config,
    trace,
  );
  const registryInput = await blaze.provider.getUnspentOutputByNFT(
    AssetId(config.registry_token + toHex(Buffer.from("REGISTRY"))),
  );
  const refInput = await blaze.provider.resolveScriptRef(script.Script.hash());
  if (!refInput)
    throw new Error("Could not find treasury script reference on-chain");
  let tx = blaze
    .newTransaction()
    .setValidUntil(Slot(Number(config.expiration / 1000n) - 1))
    .addReferenceInput(registryInput)
    .addReferenceInput(refInput);

  for (const signer of signers) {
    tx = tx.addRequiredSigner(signer);
  }

  for (const input of inputs) {
    tx = tx.addInput(
      input,
      Data.serialize(TreasurySpendRedeemer, "Reorganize"),
    );
  }

  for (const outputAmount of outputAmounts) {
    tx = tx.lockAssets(scriptAddress, outputAmount, Data.Void());
  }

  return tx;
}
