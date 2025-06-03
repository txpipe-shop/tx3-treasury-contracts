import { Blaze, Provider, Wallet } from "@blaze-cardano/sdk";
import { getBlazeInstance, getConfigs, getOutputs, maybeInput, transactionDialog } from "cli/shared";
import { Treasury } from "src";
import { IInitialize } from "src/metadata/initialize-reorganize";

export async function withdraw(blazeInstance: Blaze<Provider, Wallet> | undefined = undefined): Promise<void> {
    if (!blazeInstance) {
        blazeInstance = await getBlazeInstance();
    }
    const { treasuryConfig, ...rest } = await getConfigs();

    const { amounts, outputs } = await getOutputs();

    const metadata = {
        event: "initialize",
        reason: await maybeInput({
            message: "Enter a reason for the withdrawal (optional)",
        }),
        outputs: outputs,
    } as IInitialize;

    const tx = await (await Treasury.withdraw(treasuryConfig, amounts, metadata, blazeInstance)).complete();
    await transactionDialog(tx.toCbor(), false);
}