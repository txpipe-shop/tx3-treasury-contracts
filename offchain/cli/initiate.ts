import {
  AssetName,
  Datum,
  PolicyId,
  TransactionId,
  TransactionInput,
  TransactionOutput,
} from "@blaze-cardano/core";
import { serialize, Void } from "@blaze-cardano/data";
import { Blaze, Core } from "@blaze-cardano/sdk";
import { input, select } from "@inquirer/prompts";
import { contractsValueToCoreValue } from "../src/shared";
import {
  OneshotOneshotMint,
  ScriptHashRegistry,
  TreasuryTreasurySpend,
  VendorVendorSpend,
} from "../src/types/contracts";
import {
  getProvider,
  getTreasuryConfig,
  getVendorConfig,
  getWallet,
  transactionDialog,
} from "./shared";

export async function initiate(): Promise<void> {
  const utxo = await input({
    message:
      "Enter some transaction output (txId#idx) to spend to ensure the registry NFT is unique ",
    validate: function (value) {
      return (
        /[0-9A-Fa-f]{64}#[0-9]+/.test(value) ||
        "Should be in the format txId#idx"
      );
    },
  });
  const bootstrapUtxo = {
    transaction_id: utxo.split("#")[0],
    output_index: BigInt(utxo.split("#")[1]),
  };

  const oneshotScript = new OneshotOneshotMint(bootstrapUtxo);

  const registry_token = oneshotScript.Script;
  console.log(`Registry token policy ID: ${registry_token.hash()}`);

  const treasuryConfig = await getTreasuryConfig(registry_token.hash());

  const treasuryScript = new TreasuryTreasurySpend(treasuryConfig).Script;
  console.log(`Treasury script policy ID: ${treasuryScript.hash()}`);

  const vendorConfig = await getVendorConfig(
    registry_token.hash(),
    new Date(Number(treasuryConfig.payout_upperbound)),
  );

  const vendorScript = new VendorVendorSpend(vendorConfig).Script;
  console.log(`Vendor script policy ID: ${vendorScript.hash()}`);

  const choice = await select({
    message: "What would you like to do next?",
    choices: [
      { name: "Create registry transaction", value: "registry" },
      { name: "Create publish script reference", value: "publish" },
      { name: "Exit", value: "exit" },
    ],
  });

  switch (choice) {
    case "registry":
      console.log("Creating transaction to publish the script registry...");
      const registryDatum: ScriptHashRegistry = {
        treasury: {
          Script: [treasuryScript.hash()],
        },
        vendor: {
          Script: [vendorScript.hash()],
        },
      };
      const policyId = oneshotScript.Script.hash();
      const assetName = Core.toHex(Buffer.from("REGISTRY"));
      console.log(`Asset name: ${assetName}`);
      const provider = await getProvider();
      const wallet = await getWallet(provider);
      const blazeInstance = await Blaze.from(provider, wallet);
      const oneshotAddress = new Core.Address({
        type: Core.AddressType.EnterpriseScript,
        networkId: provider.network,
        paymentPart: {
          type: Core.CredentialType.ScriptHash,
          hash: policyId,
        },
      });
      const oneshotOutput = new TransactionOutput(
        oneshotAddress,
        contractsValueToCoreValue({ [policyId]: { [assetName]: BigInt(1) } }),
      );
      oneshotOutput.setDatum(
        Datum.fromCore(serialize(ScriptHashRegistry, registryDatum).toCore()),
      );
      const bootstrapUtxoObj = await provider.resolveUnspentOutputs([
        new TransactionInput(
          TransactionId(bootstrapUtxo.transaction_id),
          bootstrapUtxo.output_index,
        ),
      ]);
      const tx = await blazeInstance
        .newTransaction()
        .addInput(bootstrapUtxoObj[0])
        .addOutput(oneshotOutput)
        .addMint(
          PolicyId(policyId),
          new Map<AssetName, bigint>([[AssetName(assetName), BigInt(1)]]),
          Void(),
        )
        .provideScript(oneshotScript.Script)
        .complete();
      await transactionDialog(tx.toCbor().toString(), false);
      return;
    case "exit":
      console.log("Exiting...");
      return;
    default:
      console.log("Invalid choice");
      return;
  }
}
