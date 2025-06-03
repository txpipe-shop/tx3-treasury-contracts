import { Blaze, Provider, Wallet } from "@blaze-cardano/sdk";
import { input } from "@inquirer/prompts";
import { getBlazeInstance, getConfigs, getOutputs, maybeInput, transactionDialog } from "cli/shared";
import { Treasury } from "src";
import { IInitialize } from "src/metadata/initialize-reorganize";

export async function withdraw(blazeInstance: Blaze<Provider, Wallet> | undefined = undefined): Promise<void> {
    if (!blazeInstance) {
        blazeInstance = await getBlazeInstance();
    }
    const { treasuryConfig, ...rest } = await getConfigs();

    const metadata = {
        event: "initialize",
        reason: await maybeInput({
            message: "Enter a reason for the withdrawal (optional)",
        }),
        outputs: await getOutputs(0),
    } as IInitialize;

    const amount = BigInt(await input({
        message: "Enter the amount to withdraw (in lovelace)",
        validate: (value) => {
            const num = BigInt(value);
            return num > 0 ? true : "Amount must be greater than 0";
        }
    }));
    const tx = await (await Treasury.withdraw(treasuryConfig, amount, metadata, blazeInstance)).complete();
    await transactionDialog(tx.toCbor(), false);
}