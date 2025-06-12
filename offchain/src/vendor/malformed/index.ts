import { AssetId, toHex, TransactionUnspentOutput } from "@blaze-cardano/core";
import * as Data from "@blaze-cardano/data";
import {
  TxBuilder,
  Value,
  type Blaze,
  type Provider,
  type Wallet,
} from "@blaze-cardano/sdk";
import {
  TreasuryConfiguration,
  VendorConfiguration,
  VendorSpendRedeemer,
} from "../../generated-types/contracts";
import { loadTreasuryScript, loadVendorScript } from "../../shared";

export async function sweep_malformed<P extends Provider, W extends Wallet>(
  configs: { treasury: TreasuryConfiguration; vendor: VendorConfiguration },
  inputs: TransactionUnspentOutput[],
  blaze: Blaze<P, W>,
  trace?: boolean,
): Promise<TxBuilder> {
  const { scriptAddress: treasuryScriptAddress } = loadTreasuryScript(
    blaze.provider.network,
    configs.treasury,
    trace,
  );
  const { script: vendorScript } = loadVendorScript(
    blaze.provider.network,
    configs.vendor,
    trace,
  );
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
