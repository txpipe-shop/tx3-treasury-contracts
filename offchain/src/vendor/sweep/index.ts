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
  VendorDatum,
  VendorSpendRedeemer,
} from "../../generated-types/contracts.js";
import {
  contractsValueToCoreValue,
  loadTreasuryScript,
  loadVendorScript,
} from "../../shared/index.js";

export async function sweep<P extends Provider, W extends Wallet>(
  configs: { treasury: TreasuryConfiguration; vendor: VendorConfiguration },
  now: Date,
  inputs: TransactionUnspentOutput[],
  blaze: Blaze<P, W>,
  trace?: boolean,
): Promise<TxBuilder> {
  const { scriptAddress: treasuryScriptAddress } = loadTreasuryScript(
    blaze.provider.network,
    configs.treasury,
    trace,
  );
  const { scriptAddress: vendorScriptAddress, script: vendorScript } =
    loadVendorScript(blaze.provider.network, configs.vendor, trace);
  const registryInput = await blaze.provider.getUnspentOutputByNFT(
    AssetId(configs.treasury.registry_token + toHex(Buffer.from("REGISTRY"))),
  );
  const refInput = await blaze.provider.resolveScriptRef(
    vendorScript.Script.hash(),
  );
  if (!refInput)
    throw new Error("Could not find vendor script reference on-chain");
  const thirtSixHours = 36 * 60 * 60 * 1000; // 36 hours in milliseconds
  let tx = blaze
    .newTransaction()
    .addReferenceInput(registryInput)
    .addReferenceInput(refInput)
    .setValidFrom(blaze.provider.unixToSlot(now.valueOf()))
    .setValidUntil(blaze.provider.unixToSlot(now.valueOf() + thirtSixHours));

  let value = Value.zero();
  for (const input of inputs) {
    tx = tx.addInput(input, Data.serialize(VendorSpendRedeemer, "SweepVendor"));
    const datum = Data.parse(
      VendorDatum,
      input.output().datum()!.asInlineData()!,
    );
    datum.payouts = datum.payouts.filter(
      (p) => p.maturation < now.valueOf() && p.status === "Active",
    );
    const carryThrough = Value.sum(
      datum.payouts.map((p) => contractsValueToCoreValue(p.value)),
    );
    const remainder = Value.merge(
      input.output().amount(),
      Value.negate(carryThrough),
    );
    if (!Value.empty(carryThrough)) {
      tx.lockAssets(
        vendorScriptAddress,
        carryThrough,
        Data.serialize(VendorDatum, datum),
      );
    }
    value = Value.merge(value, remainder);
  }

  if (!Value.empty(value)) {
    tx = tx.lockAssets(treasuryScriptAddress, value, Data.Void());
  }
  return tx;
}
