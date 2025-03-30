import { beforeEach, describe, test } from "bun:test";
import { Blaze, Core, HotWallet, makeValue, TxBuilder } from "@blaze-cardano/sdk";
import { Credential, Ed25519KeyHashHex } from "@blaze-cardano/core";
import { Emulator, EmulatorProvider } from "@blaze-cardano/emulator";
import * as Data from "@blaze-cardano/data";
import {
  expectScriptFailure,
  makeExpectTxInvalid,
  makeExpectTxValid,
  reorganize_key,
  sampleTreasuryConfig,
  setupBlaze,
} from "../utilities.test";
import { loadTreasuryScript } from "../../shared";
import { reorganize } from "../../treasury/reorganize";

describe("When reorganizing", () => {
  const amount = 340_000_000_000_000n;
  const { rewardAccount, credential, script: treasuryScript, scriptAddress } = loadTreasuryScript(
    Core.NetworkId.Testnet,
    sampleTreasuryConfig(),
  );

  let emulator: Emulator;
  let blaze: Blaze<EmulatorProvider, HotWallet>;
  let scriptInput: Core.TransactionUnspentOutput;
  let secondScriptInput: Core.TransactionUnspentOutput;
  let refInput: Core.TransactionUnspentOutput;
  let expectTxValid: (tx: TxBuilder) => Promise<void>;
  let expectTxInvalid: (tx: TxBuilder) => Promise<void>;
  beforeEach(async () => {
    let setup = await setupBlaze();
    emulator = setup.emulator;
    blaze = setup.blaze;
    emulator.accounts.set(rewardAccount, amount);

    scriptInput = new Core.TransactionUnspentOutput(
      new Core.TransactionInput(Core.TransactionId("1".repeat(64)), 0n),
      new Core.TransactionOutput(scriptAddress, makeValue(500_000_000_000n)),
    );
    scriptInput
      .output()
      .setDatum(
        Core.Datum.newInlineData(Data.Void()),
      );
    emulator.addUtxo(scriptInput);

    secondScriptInput = new Core.TransactionUnspentOutput(
      new Core.TransactionInput(Core.TransactionId("1".repeat(64)), 1n),
      new Core.TransactionOutput(scriptAddress, makeValue(100_000_000_000n)),
    );
    secondScriptInput
      .output()
      .setDatum(
        Core.Datum.newInlineData(Data.Void()),
      );
    emulator.addUtxo(secondScriptInput);

    refInput = (await blaze.provider.resolveScriptRef(treasuryScript.Script))!;
    expectTxValid = makeExpectTxValid(blaze, emulator);
    expectTxInvalid = makeExpectTxInvalid(blaze, emulator);
  });

  describe("the treasury oversight committee", () => {
    test("can split a UTxO", async () => {
      expectTxValid(await reorganize(
        sampleTreasuryConfig(),
        blaze,
        [scriptInput],
        [makeValue(100_000_000_000n),makeValue(400_000_000_000n)],
        [Ed25519KeyHashHex(reorganize_key)],
      ));
    });

    test("can merge UTxOs", async () => {
      expectTxValid(await reorganize(
        sampleTreasuryConfig(),
        blaze,
        [scriptInput, secondScriptInput],
        [makeValue(600_000_000_000n)],
        [Ed25519KeyHashHex(reorganize_key)],
      ));
    });

    test("can rebalance UTxOs", async () => {
      expectTxValid(await reorganize(
        sampleTreasuryConfig(),
        blaze,
        [scriptInput, secondScriptInput],
        [makeValue(200_000_000_000n), makeValue(200_000_000_000n), makeValue(200_000_000_000n)],
        [Ed25519KeyHashHex(reorganize_key)],
      ));
    });
  })
});
