import { beforeEach, describe, test } from "bun:test";
import { Core, makeValue } from "@blaze-cardano/sdk";
import * as Data from "@blaze-cardano/data";
import { Emulator } from "@blaze-cardano/emulator";
import {
  deployScripts,
  findRegistryInput,
  sampleTreasuryConfig,
  sampleVendorConfig,
  scriptOutput,
  setupEmulator,
} from "../utilities";
import { loadScripts, unix_to_slot } from "../../src/shared";
import {
  TreasurySpendRedeemer,
  VendorSpendRedeemer,
} from "../../src/types/contracts";

describe("MLabs Audit Findings", () => {
  let emulator: Emulator;
  beforeEach(async () => {
    emulator = await setupEmulator(undefined, false);
  });

  describe("3.4", () => {
    test("can steal funds meant to be swept through double satisfaction", async () => {
      const treasuryConfig1 = loadScripts(
        Core.NetworkId.Testnet,
        await sampleTreasuryConfig(emulator, 1),
        await sampleVendorConfig(emulator, 1),
      );
      const treasuryConfig2 = loadScripts(
        Core.NetworkId.Testnet,
        await sampleTreasuryConfig(emulator, 2),
        await sampleVendorConfig(emulator, 2),
      );
      const treasury1Input = scriptOutput(
        emulator,
        treasuryConfig1.treasuryScript,
        makeValue(500_000_000_000n),
        Data.Void(),
      );

      const treasury2Input = scriptOutput(
        emulator,
        treasuryConfig2.treasuryScript,
        makeValue(500_000_000_000n),
        Data.Void(),
      );

      await deployScripts(emulator, treasuryConfig1);
      await deployScripts(emulator, treasuryConfig2);
      const treasury1RefInput = emulator.lookupScript(
        treasuryConfig1.treasuryScript.script.Script,
      );
      const treasury2RefInput = emulator.lookupScript(
        treasuryConfig2.treasuryScript.script.Script,
      );
      const registryInput1 = findRegistryInput(emulator, 1);
      const registryInput2 = findRegistryInput(emulator, 2);

      emulator.stepForwardToUnix(
        treasuryConfig1.treasuryScript.config.expiration + 1n,
      );

      await emulator.as("MaliciousUser", async (blaze) => {
        await emulator.expectScriptFailure(
          blaze
            .newTransaction()
            // Sweep
            .addReferenceInput(treasury1RefInput)
            .addReferenceInput(treasury2RefInput)
            .addReferenceInput(registryInput1)
            .addReferenceInput(registryInput2)
            .addInput(
              treasury1Input,
              Data.serialize(TreasurySpendRedeemer, "SweepTreasury"),
            )
            .addInput(
              treasury2Input,
              Data.serialize(TreasurySpendRedeemer, "SweepTreasury"),
            )
            .setValidFrom(
              unix_to_slot(
                treasuryConfig1.treasuryScript.config.expiration + 1000n,
              ),
            )
            .setDonation(500_000_000_000n),
          /trace expect\s*inputs\s*|> list.all\(\s*fn\(input\) {\s*when input.output.address.payment_credential is {/,
        );
      });
    });
  });

  describe("3.5", () => {
    test("can steal funds meant to be swept through double satisfaction", async () => {
      const treasuryConfig = loadScripts(
        Core.NetworkId.Testnet,
        await sampleTreasuryConfig(emulator),
        await sampleVendorConfig(emulator),
      );
      const treasuryInput = scriptOutput(
        emulator,
        treasuryConfig.treasuryScript,
        makeValue(500_000_000_000n),
        Data.Void(),
      );

      await deployScripts(emulator, treasuryConfig);
      const treasuryRefInput = emulator.lookupScript(
        treasuryConfig.treasuryScript.script.Script,
      );
      const vendorRefInput = emulator.lookupScript(
        treasuryConfig.vendorScript.script.Script,
      );
      const registryInput = findRegistryInput(emulator);
      const vendorInput = scriptOutput(
        emulator,
        treasuryConfig.vendorScript,
        makeValue(500_000_000_000n),
        Data.Void(),
      );
      emulator.stepForwardToUnix(
        treasuryConfig.treasuryScript.config.expiration + 1n,
      );
      await emulator.as("MaliciousUser", async (blaze) => {
        await emulator.expectScriptFailure(
          blaze
            .newTransaction()
            // Sweep
            .addInput(
              treasuryInput,
              Data.serialize(TreasurySpendRedeemer, "SweepTreasury"),
            )
            .setValidFrom(
              unix_to_slot(
                treasuryConfig.treasuryScript.config.expiration + 1000n,
              ),
            )
            .addReferenceInput(treasuryRefInput)
            .setDonation(500_000_000_000n)
            // Malformed
            .addReferenceInput(registryInput)
            .addReferenceInput(vendorRefInput)
            .addInput(
              vendorInput,
              Data.serialize(VendorSpendRedeemer, "Malformed"),
            )
            .lockAssets(
              treasuryConfig.treasuryScript.scriptAddress,
              vendorInput.output().amount(),
              Data.Void(),
            ),
          /expect\s*option.is_none\(\s*inputs\s*|> list.find\(\s*fn(input) { input.address.payment_credential == registry.treasury }/,
        );
      });
    });
  });

  describe("3.6", () => {
    test("can steal from the treasury reward account through double satisfaction", async () => {
      const config = loadScripts(
        Core.NetworkId.Testnet,
        await sampleTreasuryConfig(emulator),
        await sampleVendorConfig(emulator),
      );
      await deployScripts(emulator, config);

      const withdrawAmount = 340_000_000_000n;
      emulator.accounts.set(
        config.treasuryScript.rewardAccount!,
        withdrawAmount,
      );

      const vendorInput = scriptOutput(
        emulator,
        config.vendorScript,
        makeValue(500_000_000_000n),
        Data.Void(),
      );

      const treasuryRefInput = emulator.lookupScript(
        config.treasuryScript.script.Script,
      );
      const vendorRefInput = emulator.lookupScript(
        config.vendorScript.script.Script,
      );
      const registryInput = findRegistryInput(emulator);
      await emulator.as("MaliciousUser", async (blaze, addr) => {
        await emulator.expectScriptFailure(
          blaze
            .newTransaction()
            // Sweep
            .addWithdrawal(
              config.treasuryScript.rewardAccount!,
              withdrawAmount,
              Data.Void(),
            )
            .addReferenceInput(treasuryRefInput)
            .payLovelace(addr, withdrawAmount, Data.Void())
            // Malformed
            .addReferenceInput(registryInput)
            .addReferenceInput(vendorRefInput)
            .addInput(
              vendorInput,
              Data.serialize(VendorSpendRedeemer, "Malformed"),
            )
            .lockAssets(
              config.treasuryScript.scriptAddress,
              vendorInput.output().amount(),
              Data.Void(),
            ),
          /Trace expect None =\s*inputs\s*|> list.find\(\s*fn\(input\) {\s*or {\s*input.address.payment_credential == registry.treasury,/,
        );
      });
    });
  });
});
