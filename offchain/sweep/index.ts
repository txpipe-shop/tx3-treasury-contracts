import {
  makeValue,
  TxBuilder,
  type Blaze,
  type Provider,
  type Wallet,
} from "@blaze-cardano/sdk";
import { Slot, TransactionUnspentOutput } from "@blaze-cardano/core";
import * as Data from "@blaze-cardano/data";
import { loadScript } from "../shared";
import { Configuration, SpendRedeemer } from "../types/contracts";

export async function sweep<P extends Provider, W extends Wallet>(
  config: Configuration,
  input: TransactionUnspentOutput,
  blaze: Blaze<P, W>,
  amount?: bigint,
): Promise<TxBuilder> {
  const { scriptAddress, treasuryScript } = loadScript(
    blaze.provider.network,
    config,
  );
  const refInput = await blaze.provider.resolveScriptRef(treasuryScript.Script);
  if (!refInput)
    throw new Error("Could not find treasury script reference on-chain");
  let tx = blaze
    .newTransaction()
    .addInput(input, Data.serialize(SpendRedeemer, "Sweep"))
    .setValidFrom(Slot(Number(config.expiration)))
    .addReferenceInput(refInput)
    .setDonation(amount ?? input.output().amount().coin());
  if (!!amount) {
    tx = tx.lockAssets(
      scriptAddress,
      makeValue(input.output().amount().coin() - amount),
      Data.Void(),
    );
  }
  return tx;
}
