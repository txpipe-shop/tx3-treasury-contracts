import { Blaze, Provider, Wallet } from "@blaze-cardano/sdk";
import { input } from "@inquirer/prompts";
import { getBlazeInstance, getConfigs, getOptional, getOutputs, getTransactionMetadata, maybeInput, transactionDialog } from "cli/shared";
import { Treasury } from "src";
import { IInitialize } from "src/metadata/initialize-reorganize";

export async function withdraw(blazeInstance: Blaze<Provider, Wallet> | undefined = undefined): Promise<void> {
    if (!blazeInstance) {
        blazeInstance = await getBlazeInstance();
    }
    const { treasuryConfig, metadata, ...rest } = await getConfigs();

    const { amounts, outputs } = await getOutputs();

    const body = {
        event: "initialize",
        instance: metadata.identifier,
        reason: await maybeInput({
            message: "Enter a reason for the withdrawal (optional)",
        }),
        outputs: outputs,
    } as IInitialize;

    const withdrawAmountOpt = await getOptional("Do you want to specify a withdrawal amount? (optional)", { "message": "Enter withdrawal amount in lovelace:", }, input);;
    const withdrawAmount = withdrawAmountOpt !== undefined ? BigInt(parseInt(withdrawAmountOpt)) : undefined;
    const txMetadata = await getTransactionMetadata(body);

    const tx = await (await Treasury.withdraw(treasuryConfig, amounts, txMetadata, blazeInstance, withdrawAmount)).complete();
    await transactionDialog(tx.toCbor().toString(), false);
}