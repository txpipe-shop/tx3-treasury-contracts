import {
  Address,
  AssetId,
  toHex,
  TransactionId,
  TransactionInput,
} from "@blaze-cardano/core";
import { Blaze, Provider, Wallet } from "@blaze-cardano/sdk";
import { loadTreasuryScript } from "src/shared";
import { protocol } from "tx3-src/gen/typescript/protocol";
import { toPreviewBlockSlot } from "tx3-src/utils/numbers";
import { getConfigs } from "tx3-src/utils/shared";
import { getCollateralUtxo, UtxoToRef } from "tx3-src/utils/utxo";

interface ITreasurySweep {
  blaze: Blaze<Provider, Wallet>;
  user: string;
  treasuryToSweep: string;
  treasuryScriptRef?: string;
}

export const treasurySweep = async ({
  blaze,
  user,
  treasuryToSweep,
  treasuryScriptRef,
}: ITreasurySweep) => {
  const { configs, scripts } = await getConfigs(blaze);
  const utxos = await blaze.provider.getUnspentOutputs(
    Address.fromBech32(user),
  );

  const { scriptAddress: treasuryScriptAddress } = loadTreasuryScript(
    blaze.provider.network,
    configs.treasury,
  );
  const collateralUtxo = await getCollateralUtxo(utxos);

  const registryInput = await blaze.provider.getUnspentOutputByNFT(
    AssetId(configs.treasury.registry_token + toHex(Buffer.from("REGISTRY"))),
  );

  let scriptRef = treasuryScriptRef;

  if (!scriptRef) {
    try {
      console.log("Looking for reference input...");
      const treasuryRef = await blaze.provider.resolveScriptRef(
        scripts.treasuryScript.script.Script,
      );
      scriptRef = UtxoToRef(treasuryRef!);
      console.log("Found script reference:", scriptRef);
    } catch (error) {
      throw new Error(
        "Could not resolve script reference for treasury script.",
      );
    }
  }

  const [treasuryInput] = await blaze.provider.resolveUnspentOutputs([
    TransactionInput.fromCore({
      txId: TransactionId(treasuryToSweep.split("#")[0]),
      index: parseInt(treasuryToSweep.split("#")[1]),
    }),
  ]);
  const values = treasuryInput.toCore()[1].value;

  const { tx } = await protocol.treasurySweepTx({
    treasuryscript: {
      type: "String",
      value: `0x${treasuryScriptAddress.toBytes()}`,
    },
    person: { type: "String", value: Address.fromBech32(user).toBytes() },
    registryref: { type: "String", value: UtxoToRef(registryInput) },
    treasuryref: { type: "String", value: scriptRef },
    treasuryinput: { type: "String", value: treasuryToSweep },
    collateralinput: { type: "String", value: UtxoToRef(collateralUtxo) },
    sweepamount: { type: "Int", value: values.coins },
    since: {
      type: "Int",
      value: toPreviewBlockSlot(Date.now() - 1000 * 60),
    },
  });
  return tx;
};
