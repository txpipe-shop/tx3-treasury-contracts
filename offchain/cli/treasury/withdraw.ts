import { Transaction } from "@blaze-cardano/core";
import { Blaze, Provider, Wallet } from "@blaze-cardano/sdk";
import { input } from "@inquirer/prompts";
import { getBlazeInstance, getTreasuryConfig } from "cli/shared";
import { Treasury } from "src";

export async function withdraw(blazeInstance: Blaze<Provider, Wallet> | undefined = undefined): Promise<Transaction> {
    if (!blazeInstance) {
        blazeInstance = await getBlazeInstance();
    }
    const treasuryConfig = await getTreasuryConfig(undefined, {
        reorganize: "reorganize",
        sweep: "reorganize",
        fund: "reorganize",
        disburse: "reorganize",
        pause: "reorganize",
        resume: "reorganize",
        modify: "reorganize"
    });
    const amount = BigInt(await input({
        message: "Enter the amount to withdraw (in lovelace)",
        validate: (value) => {
            const num = BigInt(value);
            return num > 0 ? true : "Amount must be greater than 0";
        }
    }));
    return (await Treasury.withdraw(treasuryConfig, amount, blazeInstance)).complete()
}