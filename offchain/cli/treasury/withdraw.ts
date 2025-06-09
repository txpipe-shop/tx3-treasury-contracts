import { Blaze, Provider, Wallet } from "@blaze-cardano/sdk";
import { input } from "@inquirer/prompts";
import {
  getBlazeInstance,
  getConfigs,
  getOptional,
  getOutputs,
  getTransactionMetadata,
  maybeInput,
  transactionDialog,
} from "../shared";
import { Treasury } from "../../src";
import { type IInitialize } from "../../src/metadata/initialize-reorganize";

export async function withdraw(
  blazeInstance: Blaze<Provider, Wallet> | undefined = undefined,
): Promise<void> {
  if (!blazeInstance) {
    blazeInstance = await getBlazeInstance();
  }
  const { treasuryConfig } = await getConfigs();

  const { amounts, outputs } = await getOutputs();

  const body: IInitialize = {
    event: "initialize",
    reason: await maybeInput({
      message: "Enter a reason for the withdrawal (optional)",
    }),
    outputs,
  };

  const withdrawAmountOpt = await getOptional(
    "Do you want to specify a withdrawal amount? (optional)",
    { message: "Enter withdrawal amount in lovelace:" },
    input,
  );
  const withdrawAmount =
    withdrawAmountOpt !== undefined
      ? BigInt(parseInt(withdrawAmountOpt))
      : undefined;
  const txMetadata = await getTransactionMetadata(
    treasuryConfig.registry_token,
    body,
  );

  const tx = await Treasury.withdraw(
    treasuryConfig,
    amounts,
    blazeInstance,
    txMetadata,
    withdrawAmount,
  );
  const finalTx = await tx.complete();
  await transactionDialog(finalTx.toCbor().toString(), false);
}
