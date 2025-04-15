import { beforeEach, describe, test } from "bun:test";
import { Core, makeValue } from "@blaze-cardano/sdk";
import {
  Address,
  Ed25519KeyHashHex,
  RewardAccount,
  Slot,
} from "@blaze-cardano/core";
import { Emulator } from "@blaze-cardano/emulator";
import * as Data from "@blaze-cardano/data";
import {
  Funder,
  fund_key,
  reorganize_key,
  sampleTreasuryConfig,
  sampleVendorConfig,
  setupEmulator,
} from "../utilities.test";
import { loadTreasuryScript, slot_to_unix, unix_to_slot } from "../../shared";
import { reorganize } from "../../treasury/reorganize";
import {
  MultisigScript,
  TreasurySpendRedeemer,
  VendorConfiguration,
  type TreasuryConfiguration,
  type TreasuryTreasuryWithdraw,
} from "../../types/contracts";
import { fund } from "../../treasury/fund";

describe("When funding", () => {
  const amount = 340_000_000_000_000n;

  let emulator: Emulator;
  let configs: { treasury: TreasuryConfiguration; vendor: VendorConfiguration };
  let scriptInput: Core.TransactionUnspentOutput;
  let secondScriptInput: Core.TransactionUnspentOutput;
  let thirdScriptInput: Core.TransactionUnspentOutput;
  let refInput: Core.TransactionUnspentOutput;
  let rewardAccount: RewardAccount;
  let treasuryScript: TreasuryTreasuryWithdraw;
  let scriptAddress: Address;
  beforeEach(async () => {
    emulator = await setupEmulator();
    const treasuryConfig = await sampleTreasuryConfig(emulator);
    const vendorConfig = sampleVendorConfig();
    const treasury = loadTreasuryScript(Core.NetworkId.Testnet, treasuryConfig);
    configs = { treasury: treasuryConfig, vendor: vendorConfig };
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

    thirdScriptInput = new Core.TransactionUnspentOutput(
      new Core.TransactionInput(Core.TransactionId("1".repeat(64)), 2n),
      new Core.TransactionOutput(
        scriptAddress,
        makeValue(500_000n, ["a".repeat(64), 1n]), // Below minUTxO to test equals_plus_min_ada
      ),
    );
    // TODO: update blaze to allow spending null datums for plutus v3
    thirdScriptInput.output().setDatum(Core.Datum.newInlineData(Data.Void()));
    emulator.addUtxo(thirdScriptInput);

    refInput = emulator.lookupScript(treasuryScript.Script);
  });

  describe("the treasury oversight committee", () => {
    test("can fund a new project", async () => {
      let vendor: MultisigScript = {
        Signature: {
          key_hash: await reorganize_key(emulator),
        },
      };
      await emulator.as(Funder, async (blaze) => {
        await emulator.expectValidTransaction(
          blaze,
          await fund(
            configs,
            blaze,
            scriptInput,
            vendor,
            [
              {
                date: new Date(Number(slot_to_unix(Slot(1000)))),
                amount: makeValue(500_000_000_000n),
              },
            ],
            [Ed25519KeyHashHex(await fund_key(emulator))],
          ),
        );
      });
    });
  });
});
