import { beforeEach, describe, test } from "bun:test";
import { Core, makeValue } from "@blaze-cardano/sdk";
import * as Data from "@blaze-cardano/data";
import { Emulator } from "@blaze-cardano/emulator";
import {
  deployScripts,
  sampleTreasuryConfig,
  sampleVendorConfig,
  setupEmulator,
  treasuryOutput,
} from "../utilities.test";
import {
  loadScripts,
  loadTreasuryScript,
  unix_to_slot,
  type CompiledScript,
} from "../../shared";
import { sweep } from "../../treasury/sweep";
import {
  TreasuryConfiguration,
  TreasurySpendRedeemer,
  TreasuryTreasuryWithdraw,
} from "../../types/contracts";
import { Address, Script } from "@blaze-cardano/core";

describe("TxPipe Audit Findings", () => {
  let emulator: Emulator;
  let config: TreasuryConfiguration;
  beforeEach(async () => {
    emulator = await setupEmulator(undefined, false);
  });

  describe("TRC-001", () => {
    describe("anyone", () => {
      test("cannot sweep multiple treasury scripts and steal ADA", async () => {
        const scripts_1 = loadScripts(
          Core.NetworkId.Testnet,
          await sampleTreasuryConfig(emulator, 1),
          await sampleVendorConfig(emulator, 1),
        );
        await deployScripts(emulator, scripts_1);
        const scripts_2 = loadScripts(
          Core.NetworkId.Testnet,
          await sampleTreasuryConfig(emulator, 2),
          await sampleVendorConfig(emulator, 2),
        );
        await deployScripts(emulator, scripts_2);

        const refInput_1 = emulator.lookupScript(
          scripts_1.treasuryScript.script.Script,
        );
        const refInput_2 = emulator.lookupScript(
          scripts_2.treasuryScript.script.Script,
        );

        const amount = 100_000_000n;
        const inputA = treasuryOutput(
          emulator,
          scripts_1.treasuryScript,
          makeValue(amount),
          Data.Void(),
        );
        const inputB = treasuryOutput(
          emulator,
          scripts_2.treasuryScript,
          makeValue(amount),
          Data.Void(),
        );

        const future = scripts_1.treasuryScript.config.expiration * 2n;
        emulator.stepForwardToSlot(future);

        await emulator.as("Anyone", async (blaze, address) => {
          await emulator.expectScriptFailure(
            blaze
              .newTransaction()
              .addInput(
                inputA,
                Data.serialize(TreasurySpendRedeemer, "SweepTreasury"),
              )
              .addInput(
                inputB,
                Data.serialize(TreasurySpendRedeemer, "SweepTreasury"),
              )
              .setValidFrom(unix_to_slot(future))
              .addReferenceInput(refInput_1)
              .addReferenceInput(refInput_2)
              .setDonation(amount)
              .payLovelace(address, amount),
            /adsfadsf/,
          );
        });
      });
    });
  });
});
