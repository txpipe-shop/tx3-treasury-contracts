import {
  AssetId,
  AuxiliaryData,
  Ed25519KeyHashHex,
  toHex,
} from "@blaze-cardano/core";
import * as Data from "@blaze-cardano/data";
import {
  TxBuilder,
  type Blaze,
  type Provider,
  type Wallet,
} from "@blaze-cardano/sdk";

import { ITransactionMetadata, toTxMetadata } from "../../metadata/shared.js";
import { IInitialize } from "../../metadata/types/initialize-reorganize.js";
import {
  loadConfigsAndScripts,
  TConfigsOrScripts,
} from "../../shared/index.js";

export interface IWithdrawArgs<P extends Provider, W extends Wallet> {
  configsOrScripts: TConfigsOrScripts;
  amounts: bigint[];
  blaze: Blaze<P, W>;
  metadata?: ITransactionMetadata<IInitialize>;
  withdrawAmount?: bigint;
}

export async function withdraw<P extends Provider, W extends Wallet>({
  configsOrScripts,
  amounts,
  blaze,
  metadata,
  withdrawAmount = undefined,
}: IWithdrawArgs<P, W>): Promise<TxBuilder> {
  const { configs, scripts } = loadConfigsAndScripts(blaze, configsOrScripts);
  const { script, rewardAccount, scriptAddress } = scripts.treasuryScript;
  const registryInput = await blaze.provider.getUnspentOutputByNFT(
    AssetId(configs.treasury.registry_token + toHex(Buffer.from("REGISTRY"))),
  );
  const refInput = await blaze.provider.resolveScriptRef(script.Script.hash());
  if (!refInput)
    throw new Error("Could not find treasury script reference on-chain");

  const amount = amounts.reduce((acc, val) => acc + val, BigInt(0));

  let txBuilder = blaze
    .newTransaction()
    .addWithdrawal(
      rewardAccount!,
      withdrawAmount !== undefined ? withdrawAmount : amount,
      Data.Void(),
    )
    .addReferenceInput(refInput)
    .addReferenceInput(registryInput);

  if (metadata) {
    if (amounts.length !== Object.keys(metadata.body.outputs).length)
      throw new Error(
        "Number of amounts must match number of outputs in metadata",
      );
    const auxData = new AuxiliaryData();
    auxData.setMetadata(toTxMetadata(metadata));
    txBuilder = txBuilder
      .setAuxiliaryData(auxData)
      .addRequiredSigner(Ed25519KeyHashHex(metadata.txAuthor));
  }

  amounts.forEach((amt) => {
    txBuilder.lockLovelace(scriptAddress, amt, Data.Void());
  });

  return txBuilder;
}
