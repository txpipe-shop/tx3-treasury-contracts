import { AuxiliaryData, Ed25519KeyHashHex } from "@blaze-cardano/core";
import * as Data from "@blaze-cardano/data";
import {
  TxBuilder,
  type Blaze,
  type Provider,
  type Wallet,
} from "@blaze-cardano/sdk";
import { IInitialize } from "src/metadata/initialize-reorganize";
import { ITransactionMetadata, toMetadata } from "src/metadata/shared";
import { loadTreasuryScript } from "../../shared";
import type { TreasuryConfiguration } from "../../types/contracts";

export async function withdraw<P extends Provider, W extends Wallet>(
  config: TreasuryConfiguration,
  amounts: bigint[],
  metadata: ITransactionMetadata<IInitialize>,
  blaze: Blaze<P, W>,
): Promise<TxBuilder> {
  const { script, rewardAccount, scriptAddress } = loadTreasuryScript(
    blaze.provider.network,
    config,
  );
  const refInput = await blaze.provider.resolveScriptRef(script.Script);
  if (!refInput)
    throw new Error("Could not find treasury script reference on-chain");

  if (amounts.length !== Object.keys(metadata.body.outputs).length)
    throw new Error(
      "Number of amounts must match number of outputs in metadata",
    );
  const amount = amounts.reduce((acc, val) => acc + val, BigInt(0));

  const auxData = new AuxiliaryData();
  auxData.setMetadata(toMetadata(metadata));

  const txBuilder = blaze
    .newTransaction()
    .addWithdrawal(rewardAccount, amount, Data.Void())
    .addReferenceInput(refInput)
    .setAuxiliaryData(auxData);

  amounts.forEach((amt) => {
    txBuilder
      .lockLovelace(scriptAddress, amt, Data.Void());
  });

  return txBuilder.addRequiredSigner(Ed25519KeyHashHex(metadata.txAuthor));

}
