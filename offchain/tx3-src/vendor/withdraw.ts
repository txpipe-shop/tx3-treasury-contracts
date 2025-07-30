import { Address, AssetId, toHex } from "@blaze-cardano/core";
import { Blaze, Provider, Wallet } from "@blaze-cardano/sdk";
import { loadVendorScript } from "src/shared";
import { protocol } from "tx3-src/gen/typescript/protocol";
import { toPreviewBlockSlot } from "tx3-src/utils/numbers";
import { getConfigs } from "tx3-src/utils/shared";
import { getCollateralUtxo, UtxoToRef } from "tx3-src/utils/utxo";

interface IVendorWithdraw {
  blaze: Blaze<Provider, Wallet>;
  vendor: string;
  user: string;
  vendorUtxo: string;
  treasuryScriptRef?: string;
}

export const vendorWithdraw = async ({
  blaze,
  vendor,
  user,
  vendorUtxo,
  treasuryScriptRef,
}: IVendorWithdraw) => {
  const { configs, scripts } = await getConfigs(blaze);
  const utxos = await blaze.provider.getUnspentOutputs(
    Address.fromBech32(vendor),
  );

  const { scriptAddress: vendorScriptAddress } = loadVendorScript(
    blaze.provider.network,
    configs.vendor,
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

  const { tx } = await protocol.vendorWithdrawTx({
    vendorscript: {
      type: "String",
      value: `0x${vendorScriptAddress.toBytes()}`,
    },
    vendor: { type: "String", value: Address.fromBech32(vendor).toBytes() },
    person: {
      type: "String",
      value: Address.fromBech32(user).toBytes(),
    },
    registryref: { type: "String", value: UtxoToRef(registryInput) },
    vendorutxo: { type: "String", value: vendorUtxo },
    vendorref: { type: "String", value: scriptRef },
    collateralinput: { type: "String", value: UtxoToRef(collateralUtxo) },
    since: {
      type: "Int",
      value: toPreviewBlockSlot(Date.now() - 1000 * 60),
    },
  });
  return tx;
};
