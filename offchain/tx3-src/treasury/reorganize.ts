import { Address, AssetId, toHex } from "@blaze-cardano/core";
import { Blaze, Provider, Wallet } from "@blaze-cardano/sdk";
import { loadTreasuryScript } from "src/shared";
import { protocol } from "tx3-src/gen/typescript/protocol";
import { toPreviewBlockSlot } from "tx3-src/utils/numbers";
import { getConfigs } from "tx3-src/utils/shared";
import { getCollateralUtxo, UtxoToRef } from "tx3-src/utils/utxo";

interface IFragment {
  utxoToReorganize: string;
  amount: number;
  policy?: string;
  tokenName?: string;
}

interface IMerge {
  utxoToReorganize1: string;
  utxoToReorganize2: string;
}

interface ITreasuryReorganize {
  blaze: Blaze<Provider, Wallet>;
  user: string;
  reorganizeParams: IFragment | IMerge;
  treasuryScriptRef?: string;
}

export const treasuryReorganize = async ({
  blaze,
  user,
  reorganizeParams,
  treasuryScriptRef,
}: ITreasuryReorganize) => {
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

  if (reorganizeParams.hasOwnProperty("utxoToReorganize")) {
    const {
      utxoToReorganize,
      policy = "",
      tokenName = "",
      amount,
    } = reorganizeParams as IFragment;

    const { tx } = await protocol.treasuryFragmentTx({
      registryref: { type: "String", value: UtxoToRef(registryInput) },
      treasuryref: { type: "String", value: scriptRef },
      treasuryscript: {
        type: "String",
        value: `0x${treasuryScriptAddress.toBytes()}`,
      },
      treasuryinput: { type: "String", value: utxoToReorganize },
      person: { type: "String", value: Address.fromBech32(user).toBytes() },
      policyinput: { type: "Bytes", value: Buffer.from(policy, "hex") },
      tokenname: { type: "Bytes", value: Buffer.from(tokenName, "hex") },
      am: { type: "Int", value: BigInt(amount) },
      until: {
        type: "Int",
        value: toPreviewBlockSlot(Date.now() + 1000 * 60 * 60), // 1 hour from now
      },
      collateralinput: { type: "String", value: UtxoToRef(collateralUtxo) },
    });
    return tx;
  } else {
    const { utxoToReorganize1, utxoToReorganize2 } = reorganizeParams as IMerge;
    const { tx } = await protocol.treasuryMergeTx({
      registryref: { type: "String", value: UtxoToRef(registryInput) },
      treasuryref: { type: "String", value: scriptRef },
      treasuryscript: {
        type: "String",
        value: `0x${treasuryScriptAddress.toBytes()}`,
      },
      treasuryinput1: { type: "String", value: utxoToReorganize1 },
      treasuryinput2: { type: "String", value: utxoToReorganize2 },
      person: { type: "String", value: Address.fromBech32(user).toBytes() },
      until: {
        type: "Int",
        value: toPreviewBlockSlot(Date.now() + 1000 * 60 * 60), // 1 hour from now
      },
      collateralinput: { type: "String", value: UtxoToRef(collateralUtxo) },
    });
    return tx;
  }
};
