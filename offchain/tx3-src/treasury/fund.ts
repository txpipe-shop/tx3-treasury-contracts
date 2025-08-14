import { Address, AssetId, toHex } from "@blaze-cardano/core";
import { Blaze, Provider, Wallet } from "@blaze-cardano/sdk";
import { loadTreasuryScript, loadVendorScript } from "src/shared";
import { protocol } from "tx3-src/gen/typescript/protocol";
import { toPreviewBlockSlot } from "tx3-src/utils/numbers";
import { getConfigs } from "tx3-src/utils/shared";
import { getCollateralUtxo, UtxoToRef } from "tx3-src/utils/utxo";

interface ITreasuryFund {
  blaze: Blaze<Provider, Wallet>;
  user: string;
  vendorKeyHash: string;
  treasuryScriptRef?: string;
  maturation?: number;
  policy?: string;
  tokenName?: string;
  amount?: number;
}

export const treasuryFund = async ({
  blaze,
  user,
  vendorKeyHash,
  treasuryScriptRef,
  maturation = Date.now() + 1000 * 60 * 60 * 24 * 30, // Default maturation set to 30 days
  policy = "",
  tokenName = "",
  amount = 5000000, // Default amount set to 5 ADA
}: ITreasuryFund) => {
  const { configs, scripts } = await getConfigs(blaze);
  const utxos = await blaze.provider.getUnspentOutputs(
    Address.fromBech32(user),
  );

  const { scriptAddress: treasuryScriptAddress } = loadTreasuryScript(
    blaze.provider.network,
    configs.treasury,
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

  const { tx } = await protocol.treasuryFundTx({
    treasuryscript: {
      type: "String",
      value: `0x${treasuryScriptAddress.toBytes()}`,
    },
    vendorscript: {
      type: "String",
      value: `0x${vendorScriptAddress.toBytes()}`,
    },
    vendorkeyhash: {
      type: "Bytes",
      value: Buffer.from(vendorKeyHash, "hex"),
    },
    collateralinput: { type: "String", value: UtxoToRef(collateralUtxo) },
    registryref: { type: "String", value: UtxoToRef(registryInput) },
    person: { type: "String", value: Address.fromBech32(user).toBytes() },
    policyinput: { type: "Bytes", value: Buffer.from(policy, "hex") },
    tokenname: { type: "Bytes", value: Buffer.from(tokenName, "hex") },
    am: { type: "Int", value: BigInt(amount) },
    mat: { type: "Int", value: BigInt(maturation) },
    until: {
      type: "Int",
      value: toPreviewBlockSlot(Date.now() + 1000 * 60 * 60), // 1 hour from now
    },
    treasuryref: { type: "String", value: scriptRef },
  });
  return tx;
};
