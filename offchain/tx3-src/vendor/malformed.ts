import { Address, AssetId, toHex } from "@blaze-cardano/core";
import { Blaze, Provider, Wallet } from "@blaze-cardano/sdk";
import { loadTreasuryScript, loadVendorScript } from "src/shared";
import { protocol } from "tx3-src/gen/typescript/protocol";
import { getConfigs } from "tx3-src/utils/shared";
import { getCollateralUtxo, UtxoToRef } from "tx3-src/utils/utxo";

interface IVendorSweep {
  blaze: Blaze<Provider, Wallet>;
  vendor: string;
  user: string;
  vendorUtxo: string;
  vendorScriptRef?: string;
}

export const vendorMalformed = async ({
  blaze,
  vendor,
  user,
  vendorUtxo,
  vendorScriptRef,
}: IVendorSweep) => {
  const { configs, scripts } = await getConfigs(blaze);
  if (configs.vendor.expiration > Date.now())
    throw new Error("Vendor script has not expired yet.");
  const utxos = await blaze.provider.getUnspentOutputs(
    Address.fromBech32(vendor),
  );

  const { scriptAddress: vendorScriptAddress } = loadVendorScript(
    blaze.provider.network,
    configs.vendor,
  );

  const { scriptAddress: treasuryScriptAddress } = loadTreasuryScript(
    blaze.provider.network,
    configs.treasury,
  );
  const collateralUtxo = await getCollateralUtxo(utxos);

  const registryInput = await blaze.provider.getUnspentOutputByNFT(
    AssetId(configs.treasury.registry_token + toHex(Buffer.from("REGISTRY"))),
  );

  let scriptRef = vendorScriptRef;

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

  const { tx } = await protocol.vendorMalformedTx({
    vendorscript: {
      type: "String",
      value: `0x${vendorScriptAddress.toBytes()}`,
    },
    treasuryscript: {
      type: "String",
      value: `0x${treasuryScriptAddress.toBytes()}`,
    },
    person: {
      type: "String",
      value: Address.fromBech32(user).toBytes(),
    },
    registryref: { type: "String", value: UtxoToRef(registryInput) },
    vendorref: { type: "String", value: scriptRef },
    vendorutxo: { type: "String", value: vendorUtxo },
    collateralinput: { type: "String", value: UtxoToRef(collateralUtxo) },
  });
  return tx;
};
