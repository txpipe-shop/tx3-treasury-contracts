import { AssetId, toHex, TransactionUnspentOutput } from "@blaze-cardano/core";
import * as Data from "@blaze-cardano/data";
import {
  TxBuilder,
  Value,
  type Blaze,
  type Provider,
  type Wallet,
} from "@blaze-cardano/sdk";

import { VendorSpendRedeemer } from "../../generated-types/contracts.js";
import {
  loadConfigsAndScripts,
  TConfigsOrScripts,
} from "../../shared/index.js";

export interface ISweepMalformedArgs<P extends Provider, W extends Wallet> {
  configsOrScripts: TConfigsOrScripts;
  inputs: TransactionUnspentOutput[];
  blaze: Blaze<P, W>;
}

export async function sweep_malformed<P extends Provider, W extends Wallet>({
  configsOrScripts,
  inputs,
  blaze,
}: ISweepMalformedArgs<P, W>): Promise<TxBuilder> {
  const { configs, scripts } = loadConfigsAndScripts(blaze, configsOrScripts);
  const { scriptAddress: treasuryScriptAddress } = scripts.treasuryScript;
  const { script: vendorScript } = scripts.vendorScript;
  const registryInput = await blaze.provider.getUnspentOutputByNFT(
    AssetId(configs.treasury.registry_token + toHex(Buffer.from("REGISTRY"))),
  );
  const refInput = await blaze.provider.resolveScriptRef(
    vendorScript.Script.hash(),
  );
  if (!refInput)
    throw new Error("Could not find vendor script reference on-chain");
  let tx = blaze
    .newTransaction()
    .addReferenceInput(registryInput)
    .addReferenceInput(refInput);

  let value = Value.zero();
  for (const input of inputs) {
    tx = tx.addInput(input, Data.serialize(VendorSpendRedeemer, "Malformed"));
    value = Value.merge(value, input.output().amount());
  }

  tx = tx.lockAssets(treasuryScriptAddress, value, Data.Void());

  return tx;
}
