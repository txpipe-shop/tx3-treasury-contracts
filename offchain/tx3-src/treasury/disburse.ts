import { Address, AssetId, toHex } from "@blaze-cardano/core";
import { Blaze, Provider, Wallet } from "@blaze-cardano/sdk";
import { loadTreasuryScript } from "src/shared";
import { protocol } from "tx3-src/gen/typescript/protocol";
import { toPreviewBlockSlot } from "tx3-src/utils/numbers";
import { getConfigs } from "tx3-src/utils/shared";
import { getCollateralUtxo, UtxoToRef } from "tx3-src/utils/utxo";

export const treasuryDisburse = async (
  blaze: Blaze<Provider, Wallet>,
  user: string,
  treasuryScriptRef: string | undefined,
  outputAddress: string,
  amount: number = 1000000, // Default amount set to 1 ADA
) => {
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

  const { tx } = await protocol.treasuryDisburseTx({
    treasuryscript: {
      type: "String",
      value: `0x${treasuryScriptAddress.toBytes()}`,
    },
    person: { type: "String", value: Address.fromBech32(user).toBytes() },
    registryref: { type: "String", value: UtxoToRef(registryInput) },
    treasuryref: { type: "String", value: scriptRef },
    collateralinput: { type: "String", value: UtxoToRef(collateralUtxo) },
    outputaddress: { type: "String", value: outputAddress },
    am: { type: "Int", value: BigInt(amount) },
    until: {
      type: "Int",
      value: toPreviewBlockSlot(Date.now() + 1000 * 60 * 60), // 1 hour from now
    },
  });
  return tx;
};
