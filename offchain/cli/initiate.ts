import { AssetName, Datum, PolicyId, TransactionId, TransactionInput, TransactionOutput } from "@blaze-cardano/core";
import { serialize, Void } from "@blaze-cardano/data";
import { Core } from "@blaze-cardano/sdk";
import { input, select } from "@inquirer/prompts";
import { contractsValueToCoreValue } from "../src/shared";
import { OneshotOneshotMint, ScriptHashRegistry, TreasuryConfiguration, TreasuryTreasurySpend, VendorConfiguration, VendorVendorSpend } from "../src/types/contracts";
import { deployTransaction, getBlazeInstance, getTreasuryConfig, getVendorConfig, transactionDialog } from "./shared";

export async function initiate(): Promise<void> {
    const bootstrapUtxo = {
        transaction_id: await input({
            message: "Enter the transaction ID of the bootstrap UTXO",
        }),
        output_index: BigInt(await input({
            message: "Enter the output index of the bootstrap UTXO",
        })),
    };

    const oneshotScript = new OneshotOneshotMint(bootstrapUtxo);

    const registry_token = oneshotScript.Script;
    console.log(`Registry token policy ID: ${registry_token.hash()}`);

    const treasuryConfig = await getTreasuryConfig(registry_token.hash());

    const treasuryScript = new TreasuryTreasurySpend(treasuryConfig).Script;
    console.log(`Treasury script policy ID: ${treasuryScript.hash()}`);

    const vendorConfig = await getVendorConfig(registry_token.hash());

    const vendorScript = new VendorVendorSpend(vendorConfig).Script;
    console.log(`Vendor script policy ID: ${vendorScript.hash()}`);

    let blazeInstance = undefined;

    while (true) {

        switch (await select({
            message: "Next action",
            choices: [
                { name: "Show generated data", value: "show_data" },
                { name: "Publish Script Hash Registry", value: "create" },
                { name: "Deploy Treasury Script", value: "deploy_treasury" },
                { name: "Deploy Vendor Script", value: "deploy_vendor" },
                { name: "Exit", value: "exit" },
            ]
        })) {
            case "show_data":
                console.log("Generated data:");
                console.log(`Registry token policy ID: ${registry_token.hash()}`);
                console.log(`Treasury script hash: ${treasuryScript.hash()}`);
                console.log(`Vendor script hash: ${vendorScript.hash()}`);
                console.log(`Bootstrap UTXO: ${bootstrapUtxo.transaction_id}#${bootstrapUtxo.output_index}`);
                console.log("TreasuryConfiguration:", treasuryConfig);
                console.log("TreasuryConfigurationCbor:", serialize(TreasuryConfiguration, treasuryConfig).toCbor());
                console.log("VendorConfiguration:", vendorConfig);
                console.log("VendorConfigurationCbor:", serialize(VendorConfiguration, vendorConfig).toCbor());
                break;
            case "create":
                console.log("Creating transaction...");
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
                if (!blazeInstance) {
                    blazeInstance = await getBlazeInstance();
                }
                const oneshotAddress = new Core.Address({
                    type: Core.AddressType.EnterpriseScript,
                    networkId: blazeInstance.provider.network,
                    paymentPart: {
                        type: Core.CredentialType.ScriptHash,
                        hash: policyId,
                    },
                });
                const oneshotOutput = new TransactionOutput(oneshotAddress, contractsValueToCoreValue({ [policyId]: { [assetName]: BigInt(1) } }));
                oneshotOutput.setDatum(Datum.fromCore(serialize(ScriptHashRegistry, registryDatum).toCore()));
                const bootstrapUtxoObj = await blazeInstance.provider.resolveUnspentOutputs([new TransactionInput(TransactionId(bootstrapUtxo.transaction_id), bootstrapUtxo.output_index)]);
                const tx = await blazeInstance.newTransaction()
                    .addInput(bootstrapUtxoObj[0])
                    .addOutput(oneshotOutput)
                    .addMint(PolicyId(policyId), (new Map<AssetName, bigint>([[AssetName(assetName), BigInt(1)]])), Void())
                    .provideScript(oneshotScript.Script)
                    .complete()
                await transactionDialog(tx.toCbor().toString(), false);
                break;
            case "deploy_treasury":
                console.log("Deploying Treasury Script...");
                if (!blazeInstance) {
                    blazeInstance = await getBlazeInstance();
                }
                await transactionDialog((await deployTransaction(blazeInstance, treasuryScript)).toCbor().toString(), false);
                break;
            case "deploy_vendor":
                console.log("Deploying Vendor Script...");
                if (!blazeInstance) {
                    blazeInstance = await getBlazeInstance();
                }
                await transactionDialog((await deployTransaction(blazeInstance, vendorScript)).toCbor().toString(), false);
                break;
            case "exit":
                console.log("Exiting...");
                return;
            default:
                console.log("Invalid choice");
                return;
        }
    }
}