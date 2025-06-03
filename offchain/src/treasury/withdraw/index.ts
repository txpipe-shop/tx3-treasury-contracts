import { AuxiliaryData } from "@blaze-cardano/core";
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
  amount: bigint,
  metadata: IInitialize,
  blaze: Blaze<P, W>,
): Promise<TxBuilder> {
  const { script, rewardAccount, scriptAddress } = loadTreasuryScript(
    blaze.provider.network,
    config,
  );
  const refInput = await blaze.provider.resolveScriptRef(script.Script);
  if (!refInput)
    throw new Error("Could not find treasury script reference on-chain");

  const txMetadata: ITransactionMetadata = {
    "@context": "",
    hashAlgorithm: "blake2b-256",
    body: metadata,
  };
  const auxData = new AuxiliaryData();
  auxData.setMetadata(toMetadata(txMetadata));

  return blaze
    .newTransaction()
    .addWithdrawal(rewardAccount, amount, Data.Void())
    .addReferenceInput(refInput)
    .lockLovelace(scriptAddress, amount, Data.Void())
    .setAuxiliaryData(auxData);
}
