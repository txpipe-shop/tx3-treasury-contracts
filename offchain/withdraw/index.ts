import {
  TxBuilder,
  type Blaze,
  type Provider,
  type Wallet,
} from "@blaze-cardano/sdk";
import { loadScript } from "../shared";
import type { Configuration } from "../types/contracts";
import { HexBlob, PlutusData } from "@blaze-cardano/core";

export async function withdraw<P extends Provider, W extends Wallet>(
  config: Configuration,
  amount: bigint,
  blaze: Blaze<P, W>,
): Promise<TxBuilder> {
  const { rewardAccount, scriptAddress, treasuryScript } = loadScript(
    blaze.provider.network,
    config,
  );
  const refInput = await blaze.provider.resolveScriptRef(treasuryScript.Script);
  if (!refInput)
    throw new Error("Could not find treasury script reference on-chain");
  return blaze
    .newTransaction()
    .addWithdrawal(rewardAccount, amount, PlutusData.fromCbor(HexBlob("00")))
    .addReferenceInput(refInput)
    .lockLovelace(scriptAddress, amount, PlutusData.fromCbor(HexBlob("00")));
}
