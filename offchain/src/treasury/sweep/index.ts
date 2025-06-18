import { AssetId, toHex, TransactionUnspentOutput } from "@blaze-cardano/core";
import * as Data from "@blaze-cardano/data";
import {
  makeValue,
  TxBuilder,
  Value,
  type Blaze,
  type Provider,
  type Wallet,
} from "@blaze-cardano/sdk";

import { TreasurySpendRedeemer } from "../../generated-types/contracts.js";
import {
  loadConfigsAndScripts,
  TConfigsOrScripts,
} from "../../shared/index.js";

export interface ISweepArgs<P extends Provider, W extends Wallet> {
  configsOrScripts: TConfigsOrScripts;
  input: TransactionUnspentOutput;
  blaze: Blaze<P, W>;
  amount?: bigint;
}

export async function sweep<P extends Provider, W extends Wallet>({
  configsOrScripts,
  input,
  blaze,
  amount,
}: ISweepArgs<P, W>): Promise<TxBuilder> {
  const { configs, scripts } = loadConfigsAndScripts(blaze, configsOrScripts);
  amount ??= input.output().amount().coin();
  const { script, scriptAddress } = scripts.treasuryScript;
  const registryInput = await blaze.provider.getUnspentOutputByNFT(
    AssetId(configs.treasury.registry_token + toHex(Buffer.from("REGISTRY"))),
  );
  const refInput = await blaze.provider.resolveScriptRef(script.Script.hash());
  if (!refInput)
    throw new Error("Could not find treasury script reference on-chain");
  let tx = blaze
    .newTransaction()
    .addInput(input, Data.serialize(TreasurySpendRedeemer, "SweepTreasury"))
    .setValidFrom(
      blaze.provider.unixToSlot(Number(configs.treasury.expiration + 1000n)),
    )
    .addReferenceInput(registryInput)
    .addReferenceInput(refInput)
    .setDonation(amount);

  const remainder = Value.merge(input.output().amount(), makeValue(-amount));
  if (remainder !== Value.zero()) {
    tx = tx.lockAssets(scriptAddress, remainder, Data.Void());
  }

  return tx;
}
