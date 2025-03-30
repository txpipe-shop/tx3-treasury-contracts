import { beforeEach, describe, test } from "bun:test";
import {
  Blaze,
  Core,
  HotWallet,
  makeValue,
  TxBuilder,
} from "@blaze-cardano/sdk";
import * as Data from "@blaze-cardano/data";
import { Emulator, EmulatorProvider } from "@blaze-cardano/emulator";
import { withdraw } from "../../treasury/withdraw";
import {
  expectScriptFailure,
  makeExpectTxValid,
  sampleTreasuryConfig,
  setupBlaze,
} from "../utilities.test";
import { loadTreasuryScript } from "../../shared";

describe("When withdrawing", () => {
  const amount = 340_000_000_000_000n;
  const { rewardAccount, scriptAddress, script: treasuryScript } = loadTreasuryScript(
    Core.NetworkId.Testnet,
    sampleTreasuryConfig(),
  );

  let emulator: Emulator;
  let blaze: Blaze<EmulatorProvider, HotWallet>;
  let refInput: Core.TransactionUnspentOutput;
  let expectTxValid: (tx: TxBuilder) => Promise<void>;
  beforeEach(async () => {
    let setup = await setupBlaze();
    emulator = setup.emulator;
    blaze = setup.blaze;
    emulator.accounts.set(rewardAccount, amount);
    refInput = (await blaze.provider.resolveScriptRef(treasuryScript.Script))!;
    expectTxValid = makeExpectTxValid(blaze, emulator);
  });

  describe("anyone", () => {
    test("can withdraw and lock funds at the script address", async () => {
      expectTxValid(await withdraw(sampleTreasuryConfig(), amount, blaze));
    });
    test("can split funds across multiple script outputs", async () => {
      expectTxValid(
        blaze
          .newTransaction()
          .addWithdrawal(rewardAccount, amount, Data.Void())
          .addReferenceInput(refInput!)
          .lockLovelace(scriptAddress, amount / 2n, Data.Void())
          .lockLovelace(scriptAddress, amount / 2n, Data.Void()),
      );
    });
    test("can attach native assets while locking", async () => {
      expectTxValid(
        blaze
          .newTransaction()
          .addWithdrawal(rewardAccount, amount, Data.Void())
          .addReferenceInput(refInput!)
          .lockAssets(
            scriptAddress,
            makeValue(amount, ["a".repeat(64), 1n]),
            Data.Void(),
          ),
      );
    });
    test("can attach any datum", async () => {
      expectTxValid(
        blaze
          .newTransaction()
          .addWithdrawal(rewardAccount, amount, Data.Void())
          .addReferenceInput(refInput!)
          .lockLovelace(scriptAddress, amount, Data.Void()),
      );
    });
  });

  describe("a malicious user", () => {
    test("cannot withdraw funds to some other address", async () => {
      expectScriptFailure(
        blaze
          .newTransaction()
          .addWithdrawal(rewardAccount, amount, Data.Void())
          .addReferenceInput(refInput!)
          .payLovelace(blaze.wallet.address, amount, Data.Void()),
      );
    });
    test("cannot steal funds by splitting them between destinations", async () => {
      expectScriptFailure(
        blaze
          .newTransaction()
          .addWithdrawal(rewardAccount, amount, Data.Void())
          .addReferenceInput(refInput!)
          .lockLovelace(scriptAddress, amount / 2n, Data.Void())
          .payLovelace(blaze.wallet.address, amount / 2n, Data.Void()),
      );
    });
    test("cannot attach a staking address", async () => {
      let fullAddress = new Core.Address({
        type: Core.AddressType.BasePaymentScriptStakeKey,
        networkId: Core.NetworkId.Testnet,
        paymentPart: {
          type: Core.CredentialType.ScriptHash,
          hash: treasuryScript.Script.hash(),
        },
        delegationPart: {
          type: Core.CredentialType.KeyHash,
          hash: treasuryScript.Script.hash(), // Just use an arbitrary hash
        },
      });
      expectScriptFailure(
        blaze
          .newTransaction()
          .addWithdrawal(rewardAccount, amount, Data.Void())
          .addReferenceInput(refInput!)
          .lockLovelace(fullAddress, amount, Data.Void()),
      );
    });
    test("cannot spend from treasury script while withdrawing", async () => {
      const scriptUtxo = new Core.TransactionUnspentOutput(
        new Core.TransactionInput(Core.TransactionId("0".repeat(64)), 0n),
        new Core.TransactionOutput(scriptAddress, makeValue(5_000_000_000n)),
      );
      emulator.addUtxo(scriptUtxo);
      expectTxValid(
        blaze
          .newTransaction()
          .addWithdrawal(rewardAccount, amount)
          .addReferenceInput(refInput!)
          .addInput(scriptUtxo)
          .lockLovelace(scriptAddress, amount + 5_000_000_000n, Data.Void()),
      );
    });
  });
});
