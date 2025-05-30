import { Address, CredentialType, HexBlob, PlutusData, Script, Transaction } from "@blaze-cardano/core";
import { parse } from "@blaze-cardano/data";
import { Blaze, Blockfrost, ColdWallet, Core, Maestro, Wallet, type Provider } from "@blaze-cardano/sdk";
import { input, password, select } from "@inquirer/prompts";
import clipboard from "clipboardy";
import { MultisigScript, TreasuryConfiguration, VendorConfiguration } from "../src/types/contracts";

export async function getMultiSigScript(title: string): Promise<MultisigScript> {
    console.log(`\n${title}`);
    const msigType = await select({
        message: "Select the multisig type",
        choices: [
            { name: "Signature", value: "signature" },
            { name: "Script", value: "script" },
            { name: "Threshold", value: "threshold" },
            { name: "All", value: "all" },
            { name: "Any", value: "any" },
            { name: "Before", value: "before" },
            { name: "After", value: "after" },
        ]
    })

    switch (msigType) {
        case "signature":
            const address = await input({
                message: "Enter the address of the signature",
            });
            return await addressToMultisigScript(address);
        case "script":
            const script = await input({
                message: "Enter the script of the multisig",
            });
            return await addressToMultisigScript(script);
        case "threshold":
            const threshold = await input({
                message: "Enter the threshold of the multisig",
            });
            return { AtLeast: { required: BigInt(threshold), scripts: (await getMultisigscriptList("Enter list of multisigscripts")) } };
        case "all":
            const allScripts = await getMultisigscriptList("Enter list of multisigscripts");
            return { AllOf: { scripts: allScripts } };
        case "any":
            const anyScripts = await getMultisigscriptList("Enter list of multisigscripts");
            return { AnyOf: { scripts: anyScripts } };
        case "before":
            const beforeTime = await input({
                message: "Enter the time before which the multisig is valid (in seconds since epoch)",
            });
            return { Before: { time: BigInt(beforeTime) } };
        case "after":
            const afterTime = await input({
                message: "Enter the time after which the multisig is valid (in seconds since epoch)",
            });
            return { After: { time: BigInt(afterTime) } };
        default:
            throw new Error("Invalid multisig type");
    }
}

export async function addressToMultisigScript(address_str: string): Promise<MultisigScript> {
    const address = Address.fromBech32(address_str);
    switch (address.getProps().paymentPart!.type) {
        case CredentialType.KeyHash:
            return { Signature: { key_hash: address.getProps().paymentPart!.hash } };
        case CredentialType.ScriptHash:
            return { Script: { script_hash: address.getProps().paymentPart!.hash } };
        default:
            throw new Error("Invalid multisig type");
    }
}

export async function getMultisigscriptList(title: string): Promise<MultisigScript[]> {
    console.log(`${title}`);
    const entryMethod = await select({
        message: "Method to create multisig list:",
        choices: [
            { name: "Comma separated address list", value: "csl" },
            { name: "One by one", value: "obo" },
        ]
    })

    switch (entryMethod) {
        case "csl":
            const addresses = await input({
                message: "Enter the addresses of the signature, separated by comma's",
            });
            const addressList = addresses.split(",").map((address) => address.trim());
            var msigList: MultisigScript[] = [];
            for (const address of addressList) {
                msigList.push(await addressToMultisigScript(address));
            }
            return msigList;
        case "script":
            var msigList: MultisigScript[] = [];
            var addMore = true;
            while (addMore) {
                const msig = await getMultiSigScript("Next multisig");
                msigList.push(msig);
                addMore = await select({
                    message: "Add more multisig?",
                    choices: [
                        { name: "Yes", value: true },
                        { name: "No", value: false },
                    ]
                });
            }
            return msigList;
    }

    return [];
}

export async function transactionDialog(
    txCbor: string,
    expanded: boolean,
): Promise<void> {
    const choices = [
        { name: "Copy tx cbor", value: "copy" },
        { name: "Back", value: "back" },
    ];
    if (expanded) {
        console.log("Transaction cbor: ", txCbor);
    } else {
        console.log("Transaction cbor: ", `${txCbor.slice(0, 50)}...`);
        choices.push({ name: "Expand", value: "expand" });
    }
    const choice = await select({
        message: "Select an option",
        choices: choices,
    });
    switch (choice) {
        case "copy":
            clipboard.writeSync(txCbor);
            await select({
                message: "Transaction cbor copied to clipboard.",
                choices: [{ name: "Press enter to continue.", value: "continue" }],
            });
            break;
        case "back":
            return;
        case "expand":
            await transactionDialog(txCbor, true);
            break;
    }
}

export async function getProvider(): Promise<Provider> {
    const providerType = await select({
        message: "Select the provider type",
        choices: [
            { name: "Blockfrost", value: "blockfrost" },
            { name: "Maestro", value: "maestro" },
        ]
    });
    switch (providerType) {
        case "blockfrost":
            const bfNetwork: "cardano-mainnet" | "cardano-preview" = await select({
                message: "Select the network",
                choices: [
                    { name: "Mainnet", value: "cardano-mainnet" },
                    { name: "Preview", value: "cardano-preview" },
                ],
            });
            return new Blockfrost({
                network: bfNetwork,
                projectId: await password({
                    message: "Enter the Blockfrost project ID",
                }),
            });
        case "maestro":
            const mNetwork: "mainnet" | "preview" = await select({
                message: "Select the network",
                choices: [
                    { name: "Mainnet", value: "mainnet" },
                    { name: "Preview", value: "preview" },
                ],
            });
            return new Maestro({
                network: mNetwork,
                apiKey: await password({
                    message: "Enter the Maestro API key",
                }),
            });
        default:
            throw new Error("Invalid provider type");
    }
}

export async function getWallet(
    provider: Provider,
): Promise<Wallet> {
    const address = Core.Address.fromBech32(await input({
        message: "Enter the address of the wallet",
    }));
    const wallet = new ColdWallet(address, provider.network, provider);
    return wallet;
}

export async function getTreasuryConfig(registry_token_policy: string | undefined): Promise<TreasuryConfiguration> {
    switch (await select({
        message: "Enter CBOR or configure treasury configuration interactively?",
        choices: [
            { name: "CBOR", value: "cbor" },
            { name: "Interactive", value: "interactive" },
        ]
    })) {
        case "cbor":
            const cbor = await input({
                message: "Enter the treasury configuration CBOR",
            });
            return parse(TreasuryConfiguration, PlutusData.fromCbor(HexBlob(cbor)));
        case "interactive":
            if (!registry_token_policy) {
                registry_token_policy = await input({
                    message: "Enter the registry token policy ID",
                });
            }
            return {
                registry_token: registry_token_policy!,
                permissions: {
                    reorganize: await getMultiSigScript("Multisig for treasury reorganize"),
                    sweep: await getMultiSigScript("Multisig for treasury sweep"),
                    fund: await getMultiSigScript("Multisig for treasury fund"),
                    disburse: await getMultiSigScript("Multisig for treasury disburse"),
                },
                expiration: BigInt(await input({
                    message: "Enter the expiration time (in seconds since epoch)",
                })),
                payout_upperbound: BigInt(await input({
                    message: "Enter the payout upper bound (in lovelace)",
                })),
            };
        default:
            throw new Error("Invalid choice for treasury configuration");
    };
}

export async function getVendorConfig(registry_token_policy: string | undefined): Promise<VendorConfiguration> {
    switch (await select({
        message: "Enter CBOR or configure vendor configuration interactively?",
        choices: [
            { name: "CBOR", value: "cbor" },
            { name: "Interactive", value: "interactive" },
        ]
    })) {
        case "cbor":
            const cbor = await input({
                message: "Enter the vendor configuration CBOR",
            });
            return parse(VendorConfiguration, PlutusData.fromCbor(HexBlob(cbor)));
        case "interactive":
            if (!registry_token_policy) {
                registry_token_policy = await input({
                    message: "Enter the registry token policy ID",
                });
            }
            return {
                registry_token: registry_token_policy!,
                permissions: {
                    pause: await getMultiSigScript("Multisig for vendor pause"),
                    resume: await getMultiSigScript("Multisig for vendor resume"),
                    modify: await getMultiSigScript("Multisig for vendor modify"),
                },
                expiration: BigInt(await input({
                    message: "Enter the expiration time (in seconds since epoch)",
                })),
            };
        default:
            throw new Error("Invalid choice for vendor configuration");
    };
}

export async function deployTransaction<P extends Provider, W extends Wallet>(blazeInstance: Blaze<P, W>, script: Script): Promise<Transaction> {
    return blazeInstance.newTransaction().deployScript(script).complete();
}

export async function getBlazeInstance(): Promise<Blaze<Provider, Wallet>> {
    const provider = await getProvider();
    const wallet = await getWallet(provider);
    return await Blaze.from(provider, wallet);
}