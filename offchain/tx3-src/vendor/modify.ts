import {
  Address,
  AssetId,
  PlutusData,
  toHex,
  TransactionId,
  TransactionInput,
} from "@blaze-cardano/core";
import { parse } from "@blaze-cardano/data";
import { Blaze, Provider, Wallet } from "@blaze-cardano/sdk";
import { loadTreasuryScript, loadVendorScript } from "src/shared";
import { protocol } from "tx3-src/gen/typescript/protocol";
import { toPreviewBlockSlot } from "tx3-src/utils/numbers";
import { getConfigs } from "tx3-src/utils/shared";
import { getCollateralUtxo, UtxoToRef } from "tx3-src/utils/utxo";
import { VendorDatum } from "../../src/generated-types/contracts.js";

interface IVendorAdjudicate {
  blaze: Blaze<Provider, Wallet>;
  vendor: string;
  user: string;
  vendorUtxo: string;
  vendorScriptRef?: string;
  amount?: bigint;
}

export const vendorModify = async ({
  blaze,
  vendor,
  user,
  vendorUtxo,
  vendorScriptRef,
  amount = 5000000n,
}: IVendorAdjudicate) => {
  const { configs, scripts } = await getConfigs(blaze);
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

  const [vendorInput] = await blaze.provider.resolveUnspentOutputs([
    TransactionInput.fromCore({
      txId: TransactionId(vendorUtxo.split("#")[0]),
      index: parseInt(vendorUtxo.split("#")[1]),
    }),
  ]);
  const datum = vendorInput.toCore()[1].datum;

  const maturationDatum = BigInt(
    parse(VendorDatum, PlutusData.fromCore(datum!)).payouts[0].maturation,
  );

  const policyInput = Object.keys(
    parse(VendorDatum, PlutusData.fromCore(datum!)).payouts[0].value,
  )[0];
  const tokenName = Object.keys(
    parse(VendorDatum, PlutusData.fromCore(datum!)).payouts[0].value[
      policyInput
    ],
  )[0];

  const remainingAmount = BigInt(
    parse(VendorDatum, PlutusData.fromCore(datum!)).payouts[0].value[
      policyInput
    ][tokenName] - amount,
  );

  const pausedDatum =
    parse(VendorDatum, PlutusData.fromCore(datum!)).payouts[0].status ===
    "Paused";

  const { tx } = await protocol.vendorModifyTx({
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
    vendor: {
      type: "String",
      value: Address.fromBech32(vendor).toBytes(),
    },
    registryref: { type: "String", value: UtxoToRef(registryInput) },
    vendorref: { type: "String", value: scriptRef },
    vendorutxo: { type: "String", value: vendorUtxo },
    policyinput: { type: "Bytes", value: Buffer.from(policyInput, "hex") },
    tokenname: { type: "Bytes", value: Buffer.from(tokenName, "hex") },
    am: { type: "Int", value: amount },
    maturationdatum: { type: "Int", value: maturationDatum },
    pauseddatum: { type: "Bool", value: pausedDatum },
    remainingamount: { type: "Int", value: remainingAmount },
    collateralinput: { type: "String", value: UtxoToRef(collateralUtxo) },
    since: {
      type: "Int",
      value: toPreviewBlockSlot(Date.now() - 1000 * 60),
    },
    until: {
      type: "Int",
      value: toPreviewBlockSlot(Date.now() + 1000 * 60 * 60),
    },
  });
  return tx;
};
