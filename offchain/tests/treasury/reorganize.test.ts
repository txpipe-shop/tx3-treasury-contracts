import { beforeEach, describe, test } from "bun:test";
import { Core, makeValue } from "@blaze-cardano/sdk";
import { Address, Ed25519KeyHashHex, RewardAccount } from "@blaze-cardano/core";
import { Emulator } from "@blaze-cardano/emulator";
import * as Data from "@blaze-cardano/data";
import {
  reorganize_key,
  Reorganizer,
  sampleTreasuryConfig,
  setupEmulator,
} from "../utilities.test";
import { loadTreasuryScript } from "../../shared";
import { reorganize } from "../../treasury/reorganize";
import type {
  TreasuryConfiguration,
  TreasuryTreasuryWithdraw,
} from "../../types/contracts";

describe("When reorganizing", () => {
  const amount = 340_000_000_000_000n;

  let emulator: Emulator;
  let config: TreasuryConfiguration;
  let scriptInput: Core.TransactionUnspentOutput;
  let secondScriptInput: Core.TransactionUnspentOutput;
  let refInput: Core.TransactionUnspentOutput;
  let rewardAccount: RewardAccount;
  let treasuryScript: TreasuryTreasuryWithdraw;
  let scriptAddress: Address;
  beforeEach(async () => {
    emulator = await setupEmulator();
    config = await sampleTreasuryConfig(emulator);
    const treasury = loadTreasuryScript(Core.NetworkId.Testnet, config);
    rewardAccount = treasury.rewardAccount;
    treasuryScript = treasury.script;
    scriptAddress = treasury.scriptAddress;

    emulator.accounts.set(rewardAccount, amount);

    scriptInput = new Core.TransactionUnspentOutput(
      new Core.TransactionInput(Core.TransactionId("1".repeat(64)), 0n),
      new Core.TransactionOutput(scriptAddress, makeValue(500_000_000_000n)),
    );
    scriptInput.output().setDatum(Core.Datum.newInlineData(Data.Void()));
    emulator.addUtxo(scriptInput);

    secondScriptInput = new Core.TransactionUnspentOutput(
      new Core.TransactionInput(Core.TransactionId("1".repeat(64)), 1n),
      new Core.TransactionOutput(scriptAddress, makeValue(100_000_000_000n)),
    );
    secondScriptInput.output().setDatum(Core.Datum.newInlineData(Data.Void()));
    emulator.addUtxo(secondScriptInput);

    refInput = emulator.lookupScript(treasuryScript.Script);
  });

  describe("the treasury oversight committee", () => {
    test("can split a UTxO", async () => {
      await emulator.as(Reorganizer, async (blaze) => {
        await emulator.expectValidTransaction(
          blaze,
          await reorganize(
            config,
            blaze,
            [scriptInput],
            [makeValue(100_000_000_000n), makeValue(400_000_000_000n)],
            [Ed25519KeyHashHex(await reorganize_key(emulator))],
          ),
        );
      });
    });

    test("can merge UTxOs", async () => {
      await emulator.as(Reorganizer, async (blaze) => {
        await emulator.expectValidTransaction(
          blaze,
          await reorganize(
            config,
            blaze,
            [scriptInput, secondScriptInput],
            [makeValue(600_000_000_000n)],
            [Ed25519KeyHashHex(await reorganize_key(emulator))],
          ),
        );
      });
    });

    test("can rebalance UTxOs", async () => {
      await emulator.as(Reorganizer, async (blaze) => {
        await emulator.expectValidTransaction(
          blaze,
          await reorganize(
            config,
            blaze,
            [scriptInput, secondScriptInput],
            [
              makeValue(200_000_000_000n),
              makeValue(200_000_000_000n),
              makeValue(200_000_000_000n),
            ],
            [Ed25519KeyHashHex(await reorganize_key(emulator))],
          ),
        );
      });
    });
  });
});
